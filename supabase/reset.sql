-- Reset script for Club Baseball database.
-- Resets all athlete, coach, parent links, teams, rosters, events,
-- RSVPs, attendance, and game box scores.
-- Preserves the single admin account: atsuiyakan@gmail.com

BEGIN;

-- 1. Clear all club data and records
TRUNCATE TABLE public.game_stats CASCADE;
TRUNCATE TABLE public.attendance CASCADE;
TRUNCATE TABLE public.event_rsvps CASCADE;
TRUNCATE TABLE public.events CASCADE;
TRUNCATE TABLE public.parent_athletes CASCADE;
TRUNCATE TABLE public.team_coaches CASCADE;
TRUNCATE TABLE public.athletes CASCADE;
TRUNCATE TABLE public.teams CASCADE;

-- 2. Remove all non-admin profiles from public.profiles
DELETE FROM public.profiles
WHERE LOWER(email) <> 'atsuiyakan@gmail.com';

-- 3. Ensure atsuiyakan@gmail.com is assigned the admin role if profile exists
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) = 'atsuiyakan@gmail.com';

-- 4. Clean up other auth.users if running in Supabase SQL Editor with auth access
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        DELETE FROM auth.users 
        WHERE LOWER(email) <> 'atsuiyakan@gmail.com';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth.users cleanup due to permission constraints (standard role).';
END;
$$;

COMMIT;
