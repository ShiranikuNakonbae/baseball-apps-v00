-- Fixture + RLS assertions. Run AFTER 0001_init.sql as the table owner.
-- Everything is wrapped in one transaction that is rolled back at the end.

BEGIN;

-- ─── Accounts (the signup trigger creates the profile rows) ──────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@t.test',  '{"full_name":"Ada Admin"}'),
    ('aaaaaaaa-0000-0000-0000-000000000002', 'coach@t.test',  '{"full_name":"Cal Coach"}'),
    ('aaaaaaaa-0000-0000-0000-000000000003', 'p1@t.test',     '{"full_name":"Pat One"}'),
    ('aaaaaaaa-0000-0000-0000-000000000004', 'p2@t.test',     '{"full_name":"Pat Two"}');

UPDATE public.profiles SET role = 'admin' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'coach' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- Self-signup must never create a privileged account.
DO $$
DECLARE r public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO r FROM public.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003';
    ASSERT r.role = 'parent', format('trigger gave p1 role %s, expected parent', r.role);
END;
$$;

CREATE TEMP TABLE f AS SELECT
    'bbbbbbbb-0000-0000-0000-00000000000a'::uuid AS team_a,
    'bbbbbbbb-0000-0000-0000-00000000000b'::uuid AS team_b,
    'cccccccc-0000-0000-0000-000000000001'::uuid AS a1,
    'cccccccc-0000-0000-0000-000000000002'::uuid AS a2,
    'cccccccc-0000-0000-0000-000000000003'::uuid AS a3,
    'dddddddd-0000-0000-0000-000000000001'::uuid AS e1,
    'dddddddd-0000-0000-0000-000000000002'::uuid AS e2,
    'dddddddd-0000-0000-0000-000000000003'::uuid AS e3;

INSERT INTO public.teams (id, name, division, season)
SELECT team_a, 'Owners', 'major'::public.division_type, 'Spring 2026' FROM f
UNION ALL SELECT team_b, 'Rivals', 'minor'::public.division_type, 'Spring 2026' FROM f;

INSERT INTO public.team_coaches (team_id, user_id, is_head_coach)
SELECT team_a, 'aaaaaaaa-0000-0000-0000-000000000002', TRUE FROM f;

INSERT INTO public.athletes (id, team_id, first_name, last_name, jersey_number)
SELECT a1, team_a, 'Kid', 'One', 1 FROM f
UNION ALL SELECT a2, team_a, 'Kid', 'Two', 2 FROM f
UNION ALL SELECT a3, team_b, 'Kid', 'Three', 3 FROM f;

INSERT INTO public.parent_athletes (parent_id, athlete_id) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001'),
    ('aaaaaaaa-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002');

INSERT INTO public.events (id, team_id, title, type, start_time, end_time, location_name)
SELECT e1, team_a, 'Game', 'game'::public.event_type, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '2 hours', 'F1' FROM f
UNION ALL SELECT e2, team_a, 'Practice', 'practice'::public.event_type, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '1 hour', 'F1' FROM f
UNION ALL SELECT e3, team_b, 'Other Game', 'game'::public.event_type, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '2 hours', 'F9' FROM f;

INSERT INTO public.event_rsvps (event_id, athlete_id, status)
SELECT e1, a1, 'attending'::public.rsvp_status FROM f
UNION ALL SELECT e1, a2, 'tentative'::public.rsvp_status FROM f;

INSERT INTO public.attendance (event_id, athlete_id, status) SELECT e1, a1, 'present' FROM f;

INSERT INTO public.game_stats (event_id, athlete_id, pa, ab, singles, doubles, innings_pitched, earned_runs)
SELECT e1, a1, 4, 3, 1, 1, 0.2, 0 FROM f;

-- ─── Login roles (non-superuser, so RLS actually applies) ───────────────────
CREATE ROLE r_admin LOGIN;
CREATE ROLE r_coach LOGIN;
CREATE ROLE r_p1 LOGIN;
CREATE ROLE r_p2 LOGIN;
CREATE ROLE r_anon LOGIN;

GRANT USAGE ON SCHEMA public, auth TO r_admin, r_coach, r_p1, r_p2, r_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO r_admin, r_coach, r_p1, r_p2, r_anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO r_admin, r_coach, r_p1, r_p2, r_anon;

-- How many rows can this role see? NULL uid means signed out.
CREATE OR REPLACE FUNCTION see(rel TEXT, who TEXT, uid UUID)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
    EXECUTE format('SET ROLE %I', who);
    PERFORM set_config('app.uid', COALESCE(uid::TEXT, ''), FALSE);
    EXECUTE format('SELECT count(*) FROM %s', rel::REGCLASS) INTO n;
    RESET ROLE;
    RETURN n;
END;
$$;

-- TRUE when the statement succeeds. Only SQLSTATE 42501 (RLS / grant denial) counts
-- as "correctly refused"; any other error propagates so a broken test cannot pass.
CREATE OR REPLACE FUNCTION can_write(rel TEXT, stmt TEXT, who TEXT, uid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('SET ROLE %I', who);
    PERFORM set_config('app.uid', COALESCE(uid::TEXT, ''), FALSE);
    EXECUTE stmt;
    RESET ROLE;
    RETURN TRUE;
EXCEPTION WHEN INSUFFICIENT_PRIVILEGE THEN
    RESET ROLE;
    RETURN FALSE;
END;
$$;

DO $$
DECLARE
    ADMIN CONSTANT UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
    COACH CONSTANT UUID := 'aaaaaaaa-0000-0000-0000-000000000002';
    P1    CONSTANT UUID := 'aaaaaaaa-0000-0000-0000-000000000003';
    P2    CONSTANT UUID := 'aaaaaaaa-0000-0000-0000-000000000004';
    A2    CONSTANT UUID := 'cccccccc-0000-0000-0000-000000000002';
    A3    CONSTANT UUID := 'cccccccc-0000-0000-0000-000000000003';
    EB    CONSTANT UUID := 'dddddddd-0000-0000-0000-000000000002';
    EC    CONSTANT UUID := 'dddddddd-0000-0000-0000-000000000003';
BEGIN
    -- ── Read scoping ──
    ASSERT see('public.athletes', 'r_p1', P1) = 1, 'p1 must see only their own child';
    ASSERT see('public.athletes', 'r_p2', P2) = 1, 'p2 must see only their own child';
    ASSERT see('public.athletes', 'r_coach', COACH) = 2, 'coach sees own team roster, not team B';
    ASSERT see('public.athletes', 'r_admin', ADMIN) = 3, 'admin sees every athlete';
    ASSERT see('public.athletes', 'r_anon', NULL) = 0, 'signed-out user sees nothing';

    ASSERT see('public.events', 'r_p1', P1) = 2, 'p1 sees their team schedule only';
    ASSERT see('public.events', 'r_coach', COACH) = 2, 'coach sees own team events';
    ASSERT see('public.events', 'r_anon', NULL) = 0, 'signed-out user sees no events';

    ASSERT see('public.event_rsvps', 'r_p1', P1) = 1, 'parent sees own athlete RSVP only';
    ASSERT see('public.event_rsvps', 'r_coach', COACH) = 2, 'coach needs the whole headcount';

    ASSERT see('public.game_stats', 'r_p2', P2) = 0, 'p2 has no logged stats';
    ASSERT see('public.game_stats', 'r_p1', P1) = 1, 'p1 sees own child stats';

    -- ── Views must inherit RLS through security_invoker ──
    ASSERT see('public.athlete_season_stats', 'r_p1', P1) = 1, 'season view leaks to parents';
    ASSERT see('public.athlete_season_stats', 'r_coach', COACH) = 2, 'season view must cover coach roster';
    ASSERT see('public.athlete_attendance_stats', 'r_p1', P1) = 1, 'attendance view leaks';

    -- ── Directory / contact visibility ──
    ASSERT see('public.profiles', 'r_p1', P1) = 1, 'parent must see only own account';
    ASSERT see('public.profiles', 'r_coach', COACH) = 3, 'coach sees self plus the two guardians';
    ASSERT see('public.profiles', 'r_admin', ADMIN) = 4, 'admin sees every account';

    -- ── Write scoping ──
    ASSERT can_write('public.attendance',
        format('INSERT INTO public.attendance (event_id, athlete_id) VALUES (''%s'', ''%s'')', EB, A2),
        'r_coach', COACH), 'coach must be able to log attendance';

    ASSERT NOT can_write('public.attendance',
        format('INSERT INTO public.attendance (event_id, athlete_id) VALUES (''%s'', ''%s'')', EB, A2),
        'r_p1', P1), 'parent must NOT write attendance';

    ASSERT NOT can_write('public.game_stats',
        format('INSERT INTO public.game_stats (event_id, athlete_id, pa) VALUES (''%s'', ''%s'', 1)', EB, A2),
        'r_p1', P1), 'parent must NOT write game stats';

    ASSERT NOT can_write('public.game_stats',
        format('INSERT INTO public.game_stats (event_id, athlete_id, pa) VALUES (''%s'', ''%s'', 1)', EC, A3),
        'r_coach', COACH), 'coach must NOT write stats for another team''s athlete';

    ASSERT NOT can_write('public.parent_athletes',
        format('INSERT INTO public.parent_athletes (parent_id, athlete_id) VALUES (''%s'', ''%s'')', P1, A2),
        'r_p1', P1), 'parent must NOT self-link to another child';

    ASSERT NOT can_write('public.teams',
        'INSERT INTO public.teams (name, division, season) VALUES (''Rogue'', ''minor'', ''X'')',
        'r_coach', COACH), 'coach must NOT create club teams';

    -- Privilege escalation: an account cannot mint itself a higher role.
    ASSERT NOT can_write('public.profiles',
        format('UPDATE public.profiles SET role = ''admin'' WHERE id = ''%s''', P1),
        'r_p1', P1), 'parent must NOT promote itself';

    ASSERT can_write('public.profiles',
        format('UPDATE public.profiles SET role = ''coach'' WHERE id = ''%s''', P1),
        'r_admin', ADMIN), 'admin must be able to promote accounts';

    RAISE NOTICE 'RLS assertion suite passed';
END;
$$;

ROLLBACK;
