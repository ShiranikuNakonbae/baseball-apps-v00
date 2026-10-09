-- Stats self-check. Runs in the Supabase SQL editor (or `supabase db reset`).
-- Everything happens inside a transaction that is rolled back, so no data changes.
-- Expected values are worked out by hand below, not by re-running the view's formula.

BEGIN;

CREATE TEMP TABLE _ids AS
SELECT gen_random_uuid() AS team_id,
       gen_random_uuid() AS event1,
       gen_random_uuid() AS event2,
       gen_random_uuid() AS athlete_id;

INSERT INTO public.teams (id, name, division, season)
SELECT team_id, 'Selfcheck', 'major', 'Selfcheck' FROM _ids;

INSERT INTO public.events (id, team_id, title, type, start_time, end_time, location_name)
SELECT event1, team_id, 'Game 1', 'game'::public.event_type, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '2 hours', 'Field' FROM _ids
UNION ALL
SELECT event2, team_id, 'Game 2', 'game'::public.event_type, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '2 hours', 'Field' FROM _ids;

INSERT INTO public.athletes (id, team_id, first_name, last_name, jersey_number)
SELECT athlete_id, team_id, 'Check', 'Stats', 99 FROM _ids;

-- Game 1: 1B, 2B, walk. Game 2: 1B, 3B, HR, HBP, SF, strikeout.
-- Two pitchers' lines ride along to exercise the ERA and pitch-count maths.
INSERT INTO public.game_stats (event_id, athlete_id, pa, ab, singles, doubles, triples, hr, r, rbi, bb, k, hbp, sf, pitch_count, innings_pitched, earned_runs)
SELECT event1, athlete_id, 4, 3, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 50, 4.1, 2 FROM _ids
UNION ALL
SELECT event2, athlete_id, 6, 3, 1, 0, 1, 1, 2, 3, 0, 1, 1, 1, 40, 3.2, 1 FROM _ids;

DO $$
DECLARE
    s public.athlete_season_stats%ROWTYPE;
BEGIN
    SELECT * INTO s FROM public.athlete_season_stats WHERE athlete_id = (SELECT athlete_id FROM _ids);

    -- Totals: AB 6, hits 5 (1B 2, 2B 1, 3B 1, HR 1), BB 1, HBP 1, SF 1
    -- AVG  = 5 / 6                                   = 0.833
    -- OBP  = (5 + 1 + 1) / (6 + 1 + 1 + 1) = 7 / 9    = 0.778
    -- SLG  = (2*1 + 2*1 + 3*1 + 4*1) / 6 = 11 / 6     = 1.833
    -- OPS  = 7/9 + 11/6                               = 2.611
    -- IP   = 4.1 + 3.2 -> 4 1/3 + 3 2/3 = 8.0 ; ER 3 ; ERA = 7 * 3 / 8 = 2.63
    -- Avg pitch count over games with pitches = (50 + 40) / 2 = 45
    IF s.games_played <> 2 THEN RAISE EXCEPTION 'games_played = % (expected 2)', s.games_played; END IF;
    IF s.total_ab <> 6 THEN RAISE EXCEPTION 'total_ab = % (expected 6)', s.total_ab; END IF;
    IF s.total_hits <> 5 THEN RAISE EXCEPTION 'total_hits = % (expected 5)', s.total_hits; END IF;
    IF s.avg <> 0.833 THEN RAISE EXCEPTION 'avg = % (expected 0.833)', s.avg; END IF;
    IF s.obp <> 0.778 THEN RAISE EXCEPTION 'obp = % (expected 0.778)', s.obp; END IF;
    IF s.slg <> 1.833 THEN RAISE EXCEPTION 'slg = % (expected 1.833)', s.slg; END IF;
    IF s.ops <> 2.611 THEN RAISE EXCEPTION 'ops = % (expected 2.611)', s.ops; END IF;
    IF s.innings_pitched <> 8.0 THEN RAISE EXCEPTION 'innings_pitched = % (expected 8.0)', s.innings_pitched; END IF;
    IF s.era <> 2.63 THEN RAISE EXCEPTION 'era = % (expected 2.63)', s.era; END IF;
    IF s.avg_pitch_count <> 45 THEN RAISE EXCEPTION 'avg_pitch_count = % (expected 45)', s.avg_pitch_count; END IF;

    RAISE NOTICE 'season stats self-check passed';
END;
$$;

DO $$
DECLARE
    a public.athlete_attendance_stats%ROWTYPE;
BEGIN
    SELECT * INTO a FROM public.athlete_attendance_stats WHERE athlete_id = (SELECT athlete_id FROM _ids);
    IF a.games_scheduled <> 2 THEN RAISE EXCEPTION 'games_scheduled = % (expected 2)', a.games_scheduled; END IF;
    IF a.games_attended <> 0 THEN RAISE EXCEPTION 'games_attended = % (expected 0, nothing logged)', a.games_attended; END IF;
    -- Two games on the schedule, none logged present: the rate is 0%, not unknown.
    IF a.game_rate <> 0 THEN RAISE EXCEPTION 'game_rate = % (expected 0)', a.game_rate; END IF;
    IF a.overall_rate IS NOT NULL THEN
        RAISE EXCEPTION 'overall_rate = % (expected NULL: no attendance rows at all)', a.overall_rate;
    END IF;
    RAISE NOTICE 'attendance stats self-check passed';
END;
$$;

ROLLBACK;
