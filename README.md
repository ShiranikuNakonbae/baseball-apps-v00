# Club Baseball

Mobile-first club management: scheduling, RSVPs, attendance and sabermetric player stats.
Built to `baseball_club_app_prd.md` with Next.js, Tailwind and Supabase (Auth + Postgres + RLS).

## Set up

1. Create a Supabase project (PostgreSQL 15+ — the views use `security_invoker`).
2. In **SQL editor**, run `supabase/migrations/0001_init.sql`. This creates the tables, enums,
   the signup trigger, the calculated views, and all Row Level Security policies.
3. Optional demo data: sign up your accounts first, edit the three emails at the top of
   `supabase/seed.sql` to match, then run it. It creates the club structure — teams, athletes,
   a schedule, attendance and two box scores — and links the accounts. It deliberately does not
   create auth users; inserting into `auth.users` by hand produces rows GoTrue cannot log in to.
   Re-running the file is safe.
4. Copy `.env.example` to `.env.local` and fill in your project URL and anon key.
   Add `NEXT_PUBLIC_CLUB_TIMEZONE` if the club is not in `America/New_York` — event times are
   stored as absolute instants and displayed in that zone.
5. `npm install --include=dev && npm run dev`
   (`--include=dev` matters if `NODE_ENV=production` is set in your shell.)

## First steps after install

1. Sign up — every new account starts as `parent`.
2. Open the profile row in `public.profiles` and set your own `role` to `admin`, or run
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
3. Sign in again and use **Club** (`/admin`) to create teams, add athletes, promote coaches,
   and link parents to athletes.

Self-signup cannot hand out `admin`; role changes are blocked by a trigger unless the caller
is already an admin.

## Roles and what they see

| Role | Can do |
| :--- | :--- |
| `admin` | Everything: teams, athletes, roles, links, events, attendance, box scores. |
| `coach` | Their own teams: create events, log attendance, log box scores, view roster and guardian contacts. |
| `parent` | Read schedule and team directory; RSVP for their own linked athletes; view those athletes' stats. |

Enforcement lives in Postgres, not in the UI. The React layer calls
`requireRole()` to decide what to render, but a forged request is stopped by RLS policies.

## Layout

```
app/                    routes + server actions
  actions/auth.ts       sign in, sign up, magic link, sign out
  actions/club.ts       every mutation (events, RSVP, attendance, box score, management)
  login, family, roster, admin, events/[id], athletes/[id]
components/             presentational pieces (cards, forms, nav)
lib/
  auth.ts               session → profile, memoised per request
  data.ts               all reads; RLS does the scoping
  format.ts             baseball-notation stat formatting
  time.ts               club wall clock ↔ UTC instant
  supabase/server.ts    request-scoped Supabase client
proxy.ts                refreshes auth cookies, gates anonymous users (Next 16 "proxy")
supabase/
  migrations/0001_init.sql
  seed.sql
  tests/stats_selfcheck.sql
```

Mutations are plain HTML forms posting to server actions — no client-side Supabase client, so
the anon key never drives a browser request.

## Checking your work

```bash
npm run typecheck   # tsc --noEmit
npm test            # timezone + stat formatting logic, node:test
npm run build
```

After changing anything in `supabase/`, re-run `supabase/tests/stats_selfcheck.sql` in the SQL
editor. It rolls itself back and raises if AVG/OBP/SLG/OPS, the pitching conversion or the
attendance rate drift from the hand-worked expected values.

### Verifying the security model without a Supabase project

`supabase/tests/local/` runs the migration plus 22 row-level-security assertions on plain
Postgres, using a stand-in `auth` schema. It impersonates admin / coach / parent / second
parent / signed-out as real non-superuser roles and asserts what each can read and write —
including that no account can promote itself.

```bash
docker run -d --name clubpg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17-alpine
psql "host=localhost port=55432 user=postgres" -v ON_ERROR_STOP=1 \
  -f supabase/tests/local/00_stub.sql \
  -f supabase/migrations/0001_init.sql \
  -f supabase/tests/local/90_rls_assert.sql
```

Point it at an empty database and never run `00_stub.sql` against a real Supabase project.

## Things worth knowing

- **Innings pitched** is stored in baseball notation (`4.2` = 4⅓). `innings_to_decimal()` converts
  it before ERA is calculated.
- **ERA** uses 7-inning games. Leagues that play 6 change the factor in
  `athlete_season_stats` — it is one number, on purpose.
- **Attendance rate** counts events on the athlete's *current* team. Mid-season transfers are not
  modelled; a roster-membership table would be the fix.
- **`k`** is one column, so batting strikeouts and pitching strikeouts are the same number. The
  PRD schema only defines one.
- Sessions refresh in `proxy.ts`. Behind a caching CDN, make sure the auth cookies are not cached
  (they are `Set-Cookie` responses on every request).
