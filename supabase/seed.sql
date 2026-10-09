-- Demo club data. Run AFTER the accounts exist — create them in the app (/login →
-- Create account) or in the dashboard under Authentication → Users.
--
-- Why it no longer creates accounts: inserting rows straight into auth.users needs to
-- match whatever GoTrue expects that week. A hardcoded instance_id made GoTrue fail
-- logins with "Database error querying schema", and pgcrypto's bcrypt hash is not
-- something worth keeping compatible. Let Supabase make its own users.
--
-- Edit the three emails below to accounts you actually created, then run the file.
-- It is safe to re-run: every insert uses a fixed id and ON CONFLICT DO NOTHING.

CREATE TEMP TABLE _demo_accounts (email TEXT, role public.user_role);
INSERT INTO _demo_accounts (email, role) VALUES
    ('atsuiyakan@gmail.com', 'admin'),
    ('coach@yourclub.com',   'coach'),
    ('parent@yourclub.com',  'parent');

DO $$
DECLARE missing TEXT;
BEGIN
    SELECT string_agg(a.email, ', ') INTO missing
    FROM _demo_accounts a
    LEFT JOIN public.profiles p ON p.email = a.email
    WHERE p.id IS NULL;

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION
            'No profile for: %. Create those accounts first (app signup or dashboard Users).', missing;
    END IF;
END;
$$;

UPDATE public.profiles p SET role = a.role
FROM _demo_accounts a WHERE p.email = a.email;

-- ─── Club structure ──────────────────────────────────────────────────────────
INSERT INTO public.teams (id, name, division, season)
VALUES ('11111111-1111-1111-1111-111111111111', 'Blue Jays', 'major', 'Spring 2026')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_coaches (team_id, user_id, is_head_coach)
SELECT '11111111-1111-1111-1111-111111111111', p.id, TRUE
FROM public.profiles p JOIN _demo_accounts a ON a.email = p.email AND a.role = 'coach'
ON CONFLICT (team_id, user_id) DO NOTHING;

INSERT INTO public.athletes (id, team_id, first_name, last_name, jersey_number, primary_position, secondary_position, bats, throws)
VALUES
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Alex',   'Rivera', 12, 'SS', 'P',  'right',  'right'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Marcus', 'Vance',   7, 'CF', NULL, 'left',   'right'),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Sam',    'Taylor', 22, '1B', NULL, 'switch', 'right')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parent_athletes (parent_id, athlete_id, relationship)
SELECT p.id, x.athlete_id, 'Parent'
FROM public.profiles p
JOIN _demo_accounts a ON a.email = p.email AND a.role = 'parent'
CROSS JOIN (VALUES
    ('22222222-2222-2222-2222-222222222221'::uuid),
    ('22222222-2222-2222-2222-222222222223'::uuid)
) AS x(athlete_id)
ON CONFLICT (parent_id, athlete_id) DO NOTHING;

INSERT INTO public.events (id, team_id, title, type, start_time, end_time, location_name, location_url, notes)
VALUES
    ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111',
     'Game vs Tigers', 'game', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 hours',
     'Field #1 - Oak Park', 'https://maps.google.com/?q=Oak+Park+Baseball+Field', 'Last game of the opening weekend.'),
    ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111',
     'Practice', 'practice', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '90 minutes',
     'Main Diamond', NULL, 'Bring bats and gloves.'),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
     'Team photo day', 'event', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' + INTERVAL '2 hours',
     'Clubhouse', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (event_id, athlete_id, status)
VALUES ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222221', 'attending')
ON CONFLICT (event_id, athlete_id) DO NOTHING;

INSERT INTO public.attendance (event_id, athlete_id, status)
VALUES
    ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'present'),
    ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'late'),
    ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222223', 'excused')
ON CONFLICT (event_id, athlete_id) DO NOTHING;

-- Logged box scores so the calculated views have something to chew on.
INSERT INTO public.game_stats (event_id, athlete_id, pa, ab, singles, doubles, triples, hr, r, rbi, bb, k, hbp, sf, pitch_count, innings_pitched, earned_runs)
VALUES
    ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 4, 3, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0,  0, 0.0, 0),
    ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 3, 3, 0, 1, 1, 0, 2, 1, 0, 1, 0, 0, 55, 4.1, 2)
ON CONFLICT (event_id, athlete_id) DO NOTHING;
