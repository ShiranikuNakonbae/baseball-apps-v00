-- Baseball Club Management — schema, RLS, and calculated views.
-- Run as a migration (supabase db push / SQL editor) on a fresh project.
-- Requires PostgreSQL 15+ (views use security_invoker so RLS applies to them).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE public.user_role AS ENUM ('admin', 'coach', 'parent');
CREATE TYPE public.division_type AS ENUM ('tball', 'minor', 'major', 'youth');
CREATE TYPE public.event_type AS ENUM ('practice', 'game', 'meeting', 'event');
CREATE TYPE public.rsvp_status AS ENUM ('attending', 'not_attending', 'tentative');
CREATE TYPE public.attendance_status AS ENUM ('present', 'excused', 'unexcused', 'late');
CREATE TYPE public.side_type AS ENUM ('right', 'left', 'switch');

-- ─── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role user_role NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    division division_type NOT NULL,
    season TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.team_coaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_head_coach BOOLEAN DEFAULT FALSE,
    UNIQUE(team_id, user_id)
);

CREATE TABLE public.athletes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    jersey_number INT,
    primary_position TEXT,
    secondary_position TEXT,
    bats side_type DEFAULT 'right',
    throws side_type DEFAULT 'right',
    date_of_birth DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.parent_athletes (
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'Parent',
    PRIMARY KEY (parent_id, athlete_id)
);

CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type event_type NOT NULL DEFAULT 'practice',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location_name TEXT NOT NULL,
    location_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time)
);

CREATE TABLE public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    status rsvp_status NOT NULL DEFAULT 'tentative',
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, athlete_id)
);

CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'present',
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, athlete_id)
);

CREATE TABLE public.game_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    pa INT NOT NULL DEFAULT 0 CHECK (pa >= 0),
    ab INT NOT NULL DEFAULT 0 CHECK (ab >= 0),
    singles INT NOT NULL DEFAULT 0 CHECK (singles >= 0),
    doubles INT NOT NULL DEFAULT 0 CHECK (doubles >= 0),
    triples INT NOT NULL DEFAULT 0 CHECK (triples >= 0),
    hr INT NOT NULL DEFAULT 0 CHECK (hr >= 0),
    r INT NOT NULL DEFAULT 0 CHECK (r >= 0),
    rbi INT NOT NULL DEFAULT 0 CHECK (rbi >= 0),
    bb INT NOT NULL DEFAULT 0 CHECK (bb >= 0),
    k INT NOT NULL DEFAULT 0 CHECK (k >= 0),
    hbp INT NOT NULL DEFAULT 0 CHECK (hbp >= 0),
    sf INT NOT NULL DEFAULT 0 CHECK (sf >= 0),
    pitch_count INT DEFAULT 0 CHECK (pitch_count >= 0),
    innings_pitched NUMERIC(4, 1) DEFAULT 0.0 CHECK (innings_pitched >= 0),
    earned_runs INT DEFAULT 0 CHECK (earned_runs >= 0),
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, athlete_id),
    -- A hit is always an at-bat, and PA must cover everything it can contain.
    CHECK (singles + doubles + triples + hr <= ab),
    CHECK (ab + bb + hbp + sf <= pa)
);

CREATE INDEX idx_team_coaches_user ON public.team_coaches(user_id);
CREATE INDEX idx_athletes_team ON public.athletes(team_id);
CREATE INDEX idx_parent_athletes_athlete ON public.parent_athletes(athlete_id);
CREATE INDEX idx_events_team_start ON public.events(team_id, start_time);
CREATE INDEX idx_rsvps_athlete ON public.event_rsvps(athlete_id);
CREATE INDEX idx_attendance_athlete ON public.attendance(athlete_id);
CREATE INDEX idx_game_stats_athlete ON public.game_stats(athlete_id);

-- ─── Auth plumbing ───────────────────────────────────────────────────────────
-- Defined first: the role guard below depends on it.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Self-signup always lands as `parent`. Promotion to coach/admin is an explicit
-- admin action, so a signup payload cannot grant itself a privileged role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
        'parent'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Guard the role column: only an admin may change anyone's role (including their own).
-- auth.uid() IS NULL means there is no JWT at all — the SQL editor, a migration, or the
-- service role. Policing that case would make it impossible to create the first admin.
CREATE OR REPLACE FUNCTION public.protect_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND auth.uid() IS NOT NULL
       AND NOT public.is_admin()
    THEN
        RAISE EXCEPTION 'Only an admin may change a user role'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_role_guard
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_role_change();

-- ─── RLS helpers (SECURITY DEFINER so policies never recurse) ────────────────
CREATE OR REPLACE FUNCTION public.is_team_coach(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p_team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_coaches
        WHERE team_id = p_team_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.athlete_team(p_athlete_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT team_id FROM athletes WHERE id = p_athlete_id;
$$;

CREATE OR REPLACE FUNCTION public.event_team(p_event_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT team_id FROM events WHERE id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of(p_athlete_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM parent_athletes
        WHERE athlete_id = p_athlete_id AND parent_id = auth.uid()
    );
$$;

-- True when the signed-in parent has at least one athlete on the team.
CREATE OR REPLACE FUNCTION public.is_parent_in_team(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p_team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM parent_athletes pa
        JOIN athletes a ON a.id = pa.athlete_id
        WHERE pa.parent_id = auth.uid() AND a.team_id = p_team_id
    );
$$;

-- Can the caller see this account? Own profile, admins, fellow coaches on a shared
-- team, and coaches viewing the parents of athletes on their own team (directory).
CREATE OR REPLACE FUNCTION public.can_view_profile(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p_user_id IS NOT NULL AND (
        p_user_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM team_coaches mine
            JOIN team_coaches theirs ON theirs.team_id = mine.team_id
            WHERE mine.user_id = auth.uid() AND theirs.user_id = p_user_id
        )
        OR EXISTS (
            SELECT 1 FROM parent_athletes pa
            JOIN athletes a ON a.id = pa.athlete_id
            JOIN team_coaches tc ON tc.team_id = a.team_id
            WHERE pa.parent_id = p_user_id AND tc.user_id = auth.uid()
        )
    );
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_coaches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_stats      ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT USING (public.can_view_profile(id));

CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- teams: every signed-in club member can read; only management writes.
CREATE POLICY teams_select ON public.teams
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY teams_admin_write ON public.teams
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- team_coaches
CREATE POLICY team_coaches_select ON public.team_coaches
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY team_coaches_admin_write ON public.team_coaches
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- athletes
CREATE POLICY athletes_select ON public.athletes
    FOR SELECT USING (
        public.is_admin()
        OR public.is_team_coach(team_id)
        OR public.is_parent_of(id)
    );
CREATE POLICY athletes_admin_write ON public.athletes
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
-- A coach manages their own roster, may re-assign an athlete to a team they
-- coach (or clear the assignment), but cannot move them onto a foreign team.
CREATE POLICY athletes_coach_write ON public.athletes
    FOR UPDATE USING (public.is_team_coach(team_id))
    WITH CHECK (public.is_team_coach(team_id) OR team_id IS NULL);

-- parent_athletes: linking is management-only, otherwise a parent could attach
-- themselves to any child in the club.
CREATE POLICY parent_athletes_select ON public.parent_athletes
    FOR SELECT USING (
        public.is_admin()
        OR parent_id = auth.uid()
        OR public.is_team_coach(public.athlete_team(athlete_id))
    );
CREATE POLICY parent_athletes_admin_write ON public.parent_athletes
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- events
CREATE POLICY events_select ON public.events
    FOR SELECT USING (
        public.is_admin()
        OR public.is_team_coach(team_id)
        OR public.is_parent_in_team(team_id)
    );
-- Events are fully managed by the club admin; coaches view and work around them.
CREATE POLICY events_insert ON public.events
    FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY events_update ON public.events
    FOR UPDATE USING (public.is_admin())
    WITH CHECK (public.is_admin());
CREATE POLICY events_delete ON public.events
    FOR DELETE USING (public.is_admin());

-- event_rsvps: coaches/admins read the headcount, parents write for their athlete.
CREATE POLICY event_rsvps_select ON public.event_rsvps
    FOR SELECT USING (
        public.is_admin()
        OR public.is_team_coach(public.event_team(event_id))
        OR public.is_parent_of(athlete_id)
    );
CREATE POLICY event_rsvps_parent_write ON public.event_rsvps
    FOR ALL USING (public.is_admin() OR public.is_parent_of(athlete_id))
    WITH CHECK (public.is_admin() OR public.is_parent_of(athlete_id));

-- attendance
CREATE POLICY attendance_select ON public.attendance
    FOR SELECT USING (
        public.is_admin()
        OR public.is_team_coach(public.event_team(event_id))
        OR public.is_parent_of(athlete_id)
    );
CREATE POLICY attendance_coach_write ON public.attendance
    FOR ALL USING (public.is_admin() OR public.is_team_coach(public.event_team(event_id)))
    WITH CHECK (public.is_admin() OR public.is_team_coach(public.event_team(event_id)));

-- game_stats
CREATE POLICY game_stats_select ON public.game_stats
    FOR SELECT USING (
        public.is_admin()
        OR public.is_team_coach(public.event_team(event_id))
        OR public.is_parent_of(athlete_id)
    );
CREATE POLICY game_stats_coach_write ON public.game_stats
    FOR ALL USING (public.is_admin() OR public.is_team_coach(public.event_team(event_id)))
    WITH CHECK (public.is_admin() OR public.is_team_coach(public.event_team(event_id)));

-- ─── Calculated views ────────────────────────────────────────────────────────
-- innings_pitched is stored in baseball notation (7.2 = 7 and 2/3), so fractional
-- thirds must be converted before they go into a rate.
CREATE OR REPLACE FUNCTION public.innings_to_decimal(numeric_ip NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(FLOOR(numeric_ip), 0)
         + (ROUND((numeric_ip - FLOOR(numeric_ip)) * 10) / 3.0)
$$;

CREATE OR REPLACE VIEW public.athlete_season_stats
WITH (security_invoker = on) AS
SELECT
    a.id AS athlete_id,
    a.first_name,
    a.last_name,
    a.jersey_number,
    a.team_id,
    COUNT(DISTINCT gs.event_id) AS games_played,
    COALESCE(SUM(gs.pa), 0) AS total_pa,
    COALESCE(SUM(gs.ab), 0) AS total_ab,
    COALESCE(SUM(gs.singles + gs.doubles + gs.triples + gs.hr), 0) AS total_hits,
    COALESCE(SUM(gs.singles), 0) AS total_singles,
    COALESCE(SUM(gs.doubles), 0) AS total_doubles,
    COALESCE(SUM(gs.triples), 0) AS total_triples,
    COALESCE(SUM(gs.hr), 0) AS total_hr,
    COALESCE(SUM(gs.r), 0) AS total_runs,
    COALESCE(SUM(gs.rbi), 0) AS total_rbi,
    COALESCE(SUM(gs.bb), 0) AS total_bb,
    COALESCE(SUM(gs.k), 0) AS total_k,
    COALESCE(SUM(gs.hbp), 0) AS total_hbp,
    COALESCE(SUM(gs.sf), 0) AS total_sf,

    ROUND(COALESCE(SUM(gs.singles + gs.doubles + gs.triples + gs.hr), 0)::NUMERIC
        / NULLIF(SUM(gs.ab), 0), 3) AS avg,

    ROUND((COALESCE(SUM(gs.singles + gs.doubles + gs.triples + gs.hr), 0)
         + COALESCE(SUM(gs.bb), 0) + COALESCE(SUM(gs.hbp), 0))::NUMERIC
        / NULLIF(SUM(gs.ab + gs.bb + gs.hbp + gs.sf), 0), 3) AS obp,

    ROUND(COALESCE(SUM(gs.singles + 2 * gs.doubles + 3 * gs.triples + 4 * gs.hr), 0)::NUMERIC
        / NULLIF(SUM(gs.ab), 0), 3) AS slg,

    ROUND(
        (COALESCE(SUM(gs.singles + gs.doubles + gs.triples + gs.hr), 0)
         + COALESCE(SUM(gs.bb), 0) + COALESCE(SUM(gs.hbp), 0))::NUMERIC
            / NULLIF(SUM(gs.ab + gs.bb + gs.hbp + gs.sf), 0)
      + COALESCE(SUM(gs.singles + 2 * gs.doubles + 3 * gs.triples + 4 * gs.hr), 0)::NUMERIC
            / NULLIF(SUM(gs.ab), 0),
        3) AS ops,

    COALESCE(SUM(gs.pitch_count), 0) AS total_pitch_count,
    COALESCE(ROUND(AVG(NULLIF(gs.pitch_count, 0))::NUMERIC, 0), 0) AS avg_pitch_count,
    ROUND(COALESCE(SUM(public.innings_to_decimal(gs.innings_pitched)), 0)::NUMERIC, 1) AS innings_pitched,
    COALESCE(SUM(gs.earned_runs), 0) AS total_earned_runs,
    COALESCE(SUM(gs.k), 0) AS pitching_k,
    -- Regulation 7-inning games. Youth leagues that play 6 must change this factor.
    ROUND(7::NUMERIC * COALESCE(SUM(gs.earned_runs), 0)
        / NULLIF(SUM(public.innings_to_decimal(gs.innings_pitched)), 0), 2) AS era

FROM public.athletes a
LEFT JOIN public.game_stats gs ON a.id = gs.athlete_id
GROUP BY a.id, a.first_name, a.last_name, a.jersey_number, a.team_id;

CREATE OR REPLACE VIEW public.athlete_attendance_stats
WITH (security_invoker = on) AS
SELECT
    a.id AS athlete_id,
    a.team_id,
    COUNT(*) FILTER (WHERE e.type = 'practice') AS practices_scheduled,
    COUNT(*) FILTER (WHERE e.type = 'practice'
        AND at.status IN ('present', 'late')) AS practices_attended,
    COUNT(*) FILTER (WHERE e.type = 'game') AS games_scheduled,
    COUNT(*) FILTER (WHERE e.type = 'game'
        AND at.status IN ('present', 'late')) AS games_attended,
    COUNT(*) FILTER (WHERE at.status = 'present') AS status_present,
    COUNT(*) FILTER (WHERE at.status = 'late') AS status_late,
    COUNT(*) FILTER (WHERE at.status = 'excused') AS status_excused,
    COUNT(*) FILTER (WHERE at.status = 'unexcused') AS status_unexcused,
    ROUND(100.0 * COUNT(*) FILTER (WHERE e.type = 'practice'
            AND at.status IN ('present', 'late'))::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE e.type = 'practice'), 0), 0) AS practice_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE e.type = 'game'
            AND at.status IN ('present', 'late'))::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE e.type = 'game'), 0), 0) AS game_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE at.status IN ('present', 'late'))::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE at.id IS NOT NULL), 0), 0) AS overall_rate
-- Denominator is every event on the athlete's *current* team, including ones added
-- before the athlete joined the roster.
-- ponytail: fine for one-season youth rosters; add a roster_membership table if
-- mid-season transfers start showing up.
FROM public.athletes a
LEFT JOIN public.events e ON e.team_id = a.team_id AND e.start_time <= NOW()
LEFT JOIN public.attendance at ON at.event_id = e.id AND at.athlete_id = a.id
GROUP BY a.id, a.team_id;
