-- Local Postgres stand-in for the Supabase `auth` schema, so the migration, the seed
-- and the RLS assertions can all run without a Supabase project.
--
--   docker run -d --name clubpg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17-alpine
--   psql "host=localhost port=55432 user=postgres" -v ON_ERROR_STOP=1 \
--        -f supabase/tests/local/00_stub.sql \
--        -f supabase/migrations/0001_init.sql \
--        -f supabase/tests/local/90_rls_assert.sql
--
-- Run against an EMPTY database. 90_rls_assert.sql creates roles and rolls all of
-- them back, so repeat runs are safe. Do NOT run this against a real Supabase
-- project — auth.users already exists there.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

-- Mirrors the parts of Supabase's auth.users that the trigger, app and seed use.
CREATE TABLE auth.users (
    instance_id UUID,
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aud VARCHAR(255),
    role VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    encrypted_password VARCHAR(255),
    email_confirmed_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.uid', true), '')::UUID
$$;
