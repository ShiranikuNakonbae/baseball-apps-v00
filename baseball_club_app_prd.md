# Product Requirement Document (PRD)

**Product Name:** Baseball Club Management App  
**Platform:** Mobile-First Web Application  
**Tech Stack Baseline:** Next.js / React, Tailwind CSS, Supabase (Auth, PostgreSQL, Row Level Security)  
**Version:** 1.0 (MVP)  

---

## 1. Executive Summary & Goals

The Baseball Club Management App is a streamlined operational platform designed to eliminate scattered communication, attendance uncertainty, and fragmented player statistics across club teams. By unifying **Club Management**, **Coaches**, and **Parents** into a single system powered by Supabase, the application delivers real-time scheduling, effortless attendance tracking, and automated youth baseball stat calculations (AVG, OBP, SLG, OPS).

### Core Success Metrics
* **Attendance Response Rate:** $>85\%$ RSVP completion prior to practices/games.
* **Coach Efficiency:** Attendance and stat logging completed in $<2$ minutes post-game.
* **Platform Engagement:** $>90\%$ of registered parents active weekly during peak season.

---

## 2. User Roles & Permissions

System permissions are governed by Supabase **Row Level Security (RLS)** using three defined roles stored in `public.profiles`.

| Role | Operational Scope & Permissions |
| :--- | :--- |
| **Admin (Management)** | • Full read/write access across all club teams, divisions, and users.<br>• Create and assign players, parents, and coaches to teams.<br>• Publish club-wide announcements and manage global schedules. |
| **Coach** | • Team-level management for assigned rosters.<br>• Log attendance and box scores for team events.<br>• View all team player profiles, contact details, and aggregated performance stats. |
| **Parent / Guardian** | • Read-only access to team schedules, announcements, and team directories.<br>• Manage event RSVPs for linked athlete(s).<br>• View personal athlete profile(s), individual attendance history, and game metrics. |

---

## 3. Feature Specifications (MVP Scope)

### Module A: Authentication & User/Roster Management
* **Authentication:**
  * Supabase Auth integration (Email/Password & Magic Link login).
  * Role assignment on initial profile creation via trigger (`public.profiles`).
* **Team & Roster Structure:**
  * Categorize teams by divisions (`tball`, `minor`, `major`, `youth`).
  * Parent-Athlete junction mapping (enables multi-child family support under one parent login).

### Module B: Schedule, Events & Attendance
* **Unified Event Calendar:**
  * Support event types: `practice`, `game`, `meeting`, `event`.
  * Event metadata: Date, time, venue name, and Google Maps location URL.
* **RSVP Workflow:**
  * Parents mark RSVP status (`attending`, `not_attending`, `tentative`) per athlete.
  * Coach view shows real-time headcount breakdown for upcoming sessions.
* **Attendance Logging:**
  * Mobile-optimized checklist for coaches to record attendance (`present`, `excused`, `unexcused`, `late`).
  * Automated percentage calculation visible on athlete dashboard.

### Module C: Athlete Profile & Sabermetric Performance Tracking
* **Athlete Profile Card:**
  * Personal info: Jersey number, primary/secondary position, batting/throwing handedness (`right`, `left`, `switch`).
* **Box Score & Game Stat Logging:**
  * Simple form for coaches to input plate totals post-game ($PA, AB, H, 1B, 2B, 3B, HR, R, RBI, BB, K, HBP, SF$).
  * Pitching safeguard inputs: Pitch count, Innings Pitched ($IP$), Earned Runs ($ER$).
* **Automated Sabermetric Calculations (Supabase Views):**
  * $\text{Batting Average (AVG)} = \frac{\text{Hits}}{AB}$
  * $\text{On-Base Percentage (OBP)} = \frac{H + BB + HBP}{AB + BB + HBP + SF}$
  * $\text{Slugging Percentage (SLG)} = \frac{1B + (2 \times 2B) + (3 \times 3B) + (4 \times HR)}{AB}$
  * $\text{On-Base Plus Slugging (OPS)} = \text{OBP} + \text{SLG}$

---

## 4. User Flows

### Flow 1: Coach Attendance & Box Score Entry
```
[ Coach Dashboard ]
       │
       ▼
[ Select Completed Game ]
       │
       ▼
[ Attendance Checklist ] ──(Mark Present/Late/Absent)──► [ Save Attendance ]
       │
       ▼
[ Box Score Entry Form ]
       │
       ├──► Select Player ──► Input PA, AB, 1B, 2B, 3B, HR, BB, K
       │
       ▼
[ Submit Box Score ] ──► (Triggers Supabase DB View recalculation for AVG/OBP/SLG/OPS)
```

### Flow 2: Parent Event RSVP & Child Performance Tracking
```
[ Parent Dashboard ]
       │
       ├──► [ View Upcoming Events ] ──► Taps "RSVP" ──► Selects [Attending / Absent]
       │
       └──► [ Select Child Profile ]
                 │
                 ├──► View Attendance Summary (% Rate, Late vs Present)
                 └──► View Season Baseball Stats Card (AVG, OBP, SLG, OPS)
```

### Flow 3: Management Team & User Onboarding
```
[ Admin Dashboard ]
       │
       ├──► [ Create New Team ] ──► Assign Division & Season
       ├──► [ Add Athlete Profile ] ──► Link to Team Roster
       └──► [ Link Parent Profile ] ──► Assign Parent Email to Athlete ID
```

---

## 5. UI Wireframe Concepts

### Wireframe 1: Athlete Profile & Performance Card (Mobile View)
```
+---------------------------------------------------+
|  < Back     Athlete Profile           [Edit]      |
+---------------------------------------------------+
|                                                   |
|  [ Photo ]  Alex Rivera #12                       |
|             Position: SS / P                      |
|             Bats: Right | Throws: Right           |
|             Team: Blue Jays (Major Division)      |
|                                                   |
+---------------------------------------------------+
|  ATTENDANCE METRICS                              |
|  +---------------------------------------------+  |
|  | Practice Rate: 94%  | Games Attended: 12/12  |  |
|  +---------------------------------------------+  |
+---------------------------------------------------+
|  SEASON BATTING STATS (Spring 2026)               |
|  +---------+---------+---------+---------------+  |
|  |   AVG   |   OBP   |   SLG   |      OPS      |  |
|  |  .348   |  .420   |  .522   |     .942      |  |
|  +---------+---------+---------+---------------+  |
|                                                   |
|  Detailed Box Score Totals:                       |
|  G: 12 | PA: 46 | AB: 38 | H: 13 | 2B: 3 | 3B: 1   |
|  HR: 1 | RBI: 10 | R: 12 | BB: 6 | K: 5 | SF: 2    |
|                                                   |
+---------------------------------------------------+
|  PITCHING SUMMARY                                 |
|  IP: 14.2 | Pitch Count Avg: 45 | ERA: 2.45 | K: 18|
+---------------------------------------------------+
```

### Wireframe 2: Coach Event & Attendance Log (Mobile View)
```
+---------------------------------------------------+
|  < Schedule    Game vs Red Sox (Oct 12)           |
+---------------------------------------------------+
|  Date: Oct 12, 2026 | Time: 10:00 AM             |
|  Location: Field #3 - Oak Park [View Map]         |
+---------------------------------------------------+
|  [ Attendance ]  [ Box Score Entry ]              |
+---------------------------------------------------+
|  QUICK ATTENDANCE CHECKLIST                       |
|                                                   |
|  [x] #12 Alex Rivera      ( Present / Late / Abs )|
|  [x] #07 Marcus Vance     ( Present / Late / Abs )|
|  [ ] #22 Sam Taylor       ( Present / Late / Abs )|
|                                                   |
|  [ Save Attendance ]                              |
+---------------------------------------------------+
```

### Wireframe 3: Parent Schedule & RSVP Screen
```
+---------------------------------------------------+
|  My Family Schedule                     [Oct 2026]|
+---------------------------------------------------+
|  UPCOMING EVENTS                                  |
|                                                   |
|  SAT, OCT 14 - 9:00 AM                            |
|  Practice - Main Diamond                          |
|  Athlete: Alex Rivera                             |
|  RSVP: [ ATTENDING ]  [ Absent ]  [ Tentative ]   |
|                                                   |
|  SUN, OCT 15 - 2:00 PM                            |
|  Game vs Tigers - Field #1                        |
|  Athlete: Alex Rivera                             |
|  RSVP: [ Attending ]  [ ABSENT ]  [ Tentative ]   |
+---------------------------------------------------+
```

---

## 6. Supabase Architecture & Database Blueprint

### Entity-Relationship Overview

```
[ auth.users ] ──► [ public.profiles ]
                          │
                          ├──► [ team_coaches ] ◄─── [ teams ]
                          │                              │
                          │                              ├──► [ events ]
                          │                              │       │
                          ▼                              │       ├──► [ event_rsvps ]
                  [ parent_athletes ]                    │       │
                          │                              │       └──► [ attendance ]
                          ▼                              │                │
                    [ athletes ] ◄───────────────────────┘                │
                          │                                               │
                          └──► [ game_stats ] ────────────────────────────┘
```

### PostgreSQL DDL Schema

```sql
-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'parent');
CREATE TYPE division_type AS ENUM ('tball', 'minor', 'major', 'youth');
CREATE TYPE event_type AS ENUM ('practice', 'game', 'meeting', 'event');
CREATE TYPE rsvp_status AS ENUM ('attending', 'not_attending', 'tentative');
CREATE TYPE attendance_status AS ENUM ('present', 'excused', 'unexcused', 'late');
CREATE TYPE side_type AS ENUM ('right', 'left', 'switch');

-- Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role user_role NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams & Coaches
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

-- Athletes & Parent Links
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

-- Events & RSVPs
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Attendance & Game Stats
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
    pa INT NOT NULL DEFAULT 0,
    ab INT NOT NULL DEFAULT 0,
    singles INT NOT NULL DEFAULT 0,
    doubles INT NOT NULL DEFAULT 0,
    triples INT NOT NULL DEFAULT 0,
    hr INT NOT NULL DEFAULT 0,
    r INT NOT NULL DEFAULT 0,
    rbi INT NOT NULL DEFAULT 0,
    bb INT NOT NULL DEFAULT 0,
    k INT NOT NULL DEFAULT 0,
    hbp INT NOT NULL DEFAULT 0,
    sf INT NOT NULL DEFAULT 0,
    pitch_count INT DEFAULT 0,
    innings_pitched NUMERIC(3, 1) DEFAULT 0.0,
    earned_runs INT DEFAULT 0,
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, athlete_id)
);
```

### Calculated Metrics View (Sabermetrics)

```sql
CREATE OR REPLACE VIEW public.athlete_season_stats AS
SELECT 
    a.id AS athlete_id,
    a.first_name,
    a.last_name,
    a.jersey_number,
    a.team_id,
    COUNT(DISTINCT gs.event_id) AS games_played,
    SUM(gs.pa) AS total_pa,
    SUM(gs.ab) AS total_ab,
    SUM(gs.singles + gs.doubles + gs.triples + gs.hr) AS total_hits,
    SUM(gs.r) AS total_runs,
    SUM(gs.rbi) AS total_rbi,
    
    -- AVG
    CASE 
        WHEN SUM(gs.ab) > 0 THEN ROUND(SUM(gs.singles + gs.doubles + gs.triples + gs.hr)::NUMERIC / SUM(gs.ab), 3)
        ELSE 0.000 
    END AS avg,

    -- OBP
    CASE 
        WHEN SUM(gs.ab + gs.bb + gs.hbp + gs.sf) > 0 THEN 
            ROUND((SUM(gs.singles + gs.doubles + gs.triples + gs.hr + gs.bb + gs.hbp))::NUMERIC / 
            SUM(gs.ab + gs.bb + gs.hbp + gs.sf), 3)
        ELSE 0.000 
    END AS obp,

    -- SLG
    CASE 
        WHEN SUM(gs.ab) > 0 THEN 
            ROUND(SUM(gs.singles + (2 * gs.doubles) + (3 * gs.triples) + (4 * gs.hr))::NUMERIC / SUM(gs.ab), 3)
        ELSE 0.000 
    END AS slg,

    -- OPS
    CASE 
        WHEN SUM(gs.ab) > 0 AND SUM(gs.ab + gs.bb + gs.hbp + gs.sf) > 0 THEN 
            ROUND(
                ((SUM(gs.singles + gs.doubles + gs.triples + gs.hr + gs.bb + gs.hbp))::NUMERIC / NULLIF(SUM(gs.ab + gs.bb + gs.hbp + gs.sf), 0)) +
                (SUM(gs.singles + (2 * gs.doubles) + (3 * gs.triples) + (4 * gs.hr))::NUMERIC / NULLIF(SUM(gs.ab), 0)), 3
            )
        ELSE 0.000 
    END AS ops

FROM public.athletes a
LEFT JOIN public.game_stats gs ON a.id = gs.athlete_id
GROUP BY a.id, a.first_name, a.last_name, a.jersey_number, a.team_id;
```

---

## 7. Non-Functional & Technical Requirements

* **Mobile First Experience:** Touch targets must be at least $44 \times 44\text{px}$ for outdoor dugout usage by coaches on mobile devices.
* **Security & Row Level Security (RLS):**
  * Parents can only query data linked to their athlete IDs via `parent_athletes`.
  * Write permissions for `attendance` and `game_stats` restricted to authenticated `coach` or `admin` roles.
* **Performance:** Sub-1 second API responses via Supabase client for calendar loading and athlete metric rendering.