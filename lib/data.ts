import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceRow,
  AttendanceStats,
  Athlete,
  BattingLine,
  ClubEvent,
  Profile,
  Rsvp,
  SeasonStats,
  Team,
} from "@/lib/types";

const EVENT_SELECT =
  "id, team_id, title, type, start_time, end_time, location_name, location_url, notes, team:teams(name, division)";
const ATHLETE_SELECT =
  "id, team_id, first_name, last_name, jersey_number, primary_position, secondary_position, bats, throws, date_of_birth, team:teams(name, division, season)";
const LINE_COLUMNS =
  "event_id, athlete_id, pa, ab, singles, doubles, triples, hr, r, rbi, bb, k, hbp, sf, pitch_count, innings_pitched, earned_runs";
const STAT_COLUMNS =
  "athlete_id, games_played, total_pa, total_ab, total_hits, total_singles, total_doubles, total_triples, total_hr, total_runs, total_rbi, total_bb, total_k, total_hbp, total_sf, avg, obp, slg, ops, avg_pitch_count, innings_pitched, total_earned_runs, era";
const ATTENDANCE_COLUMNS =
  "athlete_id, practices_scheduled, practices_attended, games_scheduled, games_attended, status_present, status_late, status_excused, status_unexcused, practice_rate, game_rate, overall_rate";

type Result = { data: unknown; error: { message: string } | null };

// Without a generated Database type, supabase-js cannot tell a to-one FK embed from a
// to-many one, so the shape is asserted here instead of at every call site.
function rows<T>(result: Result, label: string): T[] {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data as T[] | null) ?? [];
}

function maybe<T>(result: Result, label: string): T | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data as T | null) ?? null;
}

export async function getTeams(): Promise<Team[]> {
  const sb = await createClient();
  return rows<Team>(await sb.from("teams").select("id, name, division, season").order("name"), "load teams");
}

export type EventRsvpDetail = {
  event_id: string;
  athlete_id: string;
  status: Rsvp["status"];
  athlete: Pick<Athlete, "id" | "first_name" | "last_name" | "jersey_number"> | null;
};

/** RSVP counts per event, for the coach headcount view. Parents only see their own rows. */
export async function getRsvpSummary(eventIds: string[]): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (eventIds.length === 0) return map;
  const sb = await createClient();
  const result = await sb.from("event_rsvps").select("event_id, status").in("event_id", eventIds);
  for (const row of rows<{ event_id: string; status: string }>(result, "load rsvp summary")) {
    const counts = map.get(row.event_id) ?? {};
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    map.set(row.event_id, counts);
  }
  return map;
}

/** Full RSVP responses with athlete details per event, for coaches and admins. */
export async function getRsvpResponsesForEvents(eventIds: string[]): Promise<Map<string, EventRsvpDetail[]>> {
  const map = new Map<string, EventRsvpDetail[]>();
  if (eventIds.length === 0) return map;
  const sb = await createClient();
  const result = await sb
    .from("event_rsvps")
    .select("event_id, athlete_id, status, athlete:athletes(id, first_name, last_name, jersey_number)")
    .in("event_id", eventIds);
  for (const row of rows<EventRsvpDetail>(result, "load rsvp responses")) {
    const list = map.get(row.event_id) ?? [];
    list.push(row);
    map.set(row.event_id, list);
  }
  return map;
}

/** Current RSVP answer for each of an athlete's events — the parent view. */
export async function getRsvpsForAthletes(athleteIds: string[]): Promise<Rsvp[]> {
  if (athleteIds.length === 0) return [];
  const sb = await createClient();
  const result = await sb
    .from("event_rsvps")
    .select("event_id, athlete_id, status")
    .in("athlete_id", athleteIds);
  return rows<Rsvp>(result, "load family rsvps");
}

/** Upcoming events on every team the caller is allowed to see. RLS does the scoping. */
export async function getUpcomingEvents(limit = 50): Promise<ClubEvent[]> {
  const sb = await createClient();
  const result = await sb
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(limit);
  return rows<ClubEvent>(result, "load upcoming events");
}

/** Completed events the caller can still log attendance or box scores against. */
export async function getRecentEvents(limit = 20): Promise<ClubEvent[]> {
  const sb = await createClient();
  const result = await sb
    .from("events")
    .select(EVENT_SELECT)
    .lt("start_time", new Date().toISOString())
    .order("start_time", { ascending: false })
    .limit(limit);
  return rows<ClubEvent>(result, "load recent events");
}

async function getEvent(eventId: string): Promise<ClubEvent | null> {
  const sb = await createClient();
  const result = await sb.from("events").select(EVENT_SELECT).eq("id", eventId).maybeSingle();
  return maybe<ClubEvent>(result, "load event");
}

/** Everything needed to render one event page in a single round-trip set. */
export async function getEventBundle(eventId: string) {
  const event = await getEvent(eventId);
  if (!event) return null;
  const sb = await createClient();

  const [roster, rsvps, attendance, lines] = await Promise.all([
    sb
      .from("athletes")
      .select(ATHLETE_SELECT)
      .eq("team_id", event.team_id)
      .order("jersey_number", { ascending: true }),
    sb.from("event_rsvps").select("event_id, athlete_id, status").eq("event_id", eventId),
    sb.from("attendance").select("event_id, athlete_id, status").eq("event_id", eventId),
    sb.from("game_stats").select(LINE_COLUMNS).eq("event_id", eventId),
  ]);

  return {
    event,
    roster: rows<Athlete>(roster, "load event roster"),
    rsvps: rows<Rsvp>(rsvps, "load event rsvps"),
    attendance: rows<AttendanceRow>(attendance, "load event attendance"),
    lines: rows<BattingLine>(lines, "load event box score"),
  };
}

export async function getAthletesForParent(parentId: string): Promise<Athlete[]> {
  const sb = await createClient();
  const result = await sb
    .from("parent_athletes")
    .select(`athlete_id, relationship, athlete:athletes(${ATHLETE_SELECT})`)
    .eq("parent_id", parentId);
  return rows<{ athlete: Athlete | null }>(result, "load family athletes")
    .map((link) => link.athlete)
    .filter((athlete): athlete is Athlete => athlete !== null);
}

export async function getAthlete(athleteId: string): Promise<Athlete | null> {
  const sb = await createClient();
  const result = await sb
    .from("athletes")
    .select(ATHLETE_SELECT)
    .eq("id", athleteId)
    .maybeSingle();
  return maybe<Athlete>(result, "load athlete");
}

export async function getSeasonStats(athleteIds: string[]): Promise<Map<string, SeasonStats>> {
  const map = new Map<string, SeasonStats>();
  if (athleteIds.length === 0) return map;
  const sb = await createClient();
  const result = await sb
    .from("athlete_season_stats")
    .select(STAT_COLUMNS)
    .in("athlete_id", athleteIds);
  for (const row of rows<SeasonStats>(result, "load season stats")) map.set(row.athlete_id, row);
  return map;
}

export async function getAttendanceStats(athleteIds: string[]): Promise<Map<string, AttendanceStats>> {
  const map = new Map<string, AttendanceStats>();
  if (athleteIds.length === 0) return map;
  const sb = await createClient();
  const result = await sb
    .from("athlete_attendance_stats")
    .select(ATTENDANCE_COLUMNS)
    .in("athlete_id", athleteIds);
  for (const row of rows<AttendanceStats>(result, "load attendance stats")) map.set(row.athlete_id, row);
  return map;
}

export async function getGameLog(athleteId: string): Promise<(BattingLine & { event: ClubEvent | null })[]> {
  const sb = await createClient();
  const result = await sb
    .from("game_stats")
    .select(`${LINE_COLUMNS}, event:events(id, title, type, start_time, location_name)`)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  return rows<BattingLine & { event: ClubEvent | null }>(result, "load game log");
}

/** Parents linked to an athlete, with contact details — the coach directory view. */
export async function getParentsForAthletes(athleteIds: string[]): Promise<Map<string, Profile[]>> {
  const map = new Map<string, Profile[]>();
  if (athleteIds.length === 0) return map;
  const sb = await createClient();
  const result = await sb
    .from("parent_athletes")
    .select("athlete_id, parent:profiles(id, email, full_name, phone_number, role)")
    .in("athlete_id", athleteIds);
  for (const row of rows<{ athlete_id: string; parent: Profile | null }>(result, "load parents")) {
    if (!row.parent) continue;
    map.set(row.athlete_id, [...(map.get(row.athlete_id) ?? []), row.parent]);
  }
  return map;
}

export async function getCoachTeamIds(userId: string): Promise<string[]> {
  const sb = await createClient();
  const result = await sb.from("team_coaches").select("team_id").eq("user_id", userId);
  return rows<{ team_id: string }>(result, "load coach teams").map((row) => row.team_id);
}

export type CoachAssignment = {
  team_id: string;
  user_id: string;
  is_head_coach: boolean;
  profile: Pick<Profile, "id" | "full_name" | "email"> | null;
};

/** All coach↔team assignments, for the management screen. */
export async function getTeamCoachAssignments(): Promise<CoachAssignment[]> {
  const sb = await createClient();
  const result = await sb
    .from("team_coaches")
    .select("team_id, user_id, is_head_coach, profile:profiles(id, full_name, email)")
    .order("team_id");
  return rows<CoachAssignment>(result, "load coach assignments");
}

export type ParentLink = {
  parent_id: string;
  athlete_id: string;
  relationship: string;
  athlete: Pick<Athlete, "id" | "first_name" | "last_name"> | null;
  parent: Pick<Profile, "id" | "full_name" | "email"> | null;
};

/** Every parent↔athlete link, for the management screen. */
export async function getParentLinks(): Promise<ParentLink[]> {
  const sb = await createClient();
  const result = await sb
    .from("parent_athletes")
    .select(
      "parent_id, athlete_id, relationship, athlete:athletes(id, first_name, last_name), parent:profiles(id, full_name, email)",
    )
    .order("athlete_id");
  return rows<ParentLink>(result, "load parent links");
}

/** Management-only directory. RLS hides nothing here because admins see everything. */
export async function getProfiles(): Promise<Profile[]> {
  const sb = await createClient();
  const result = await sb
    .from("profiles")
    .select("id, email, full_name, phone_number, role")
    .order("full_name");
  return rows<Profile>(result, "load profiles");
}

export async function getAllAthletes(): Promise<Athlete[]> {
  const sb = await createClient();
  const result = await sb.from("athletes").select(ATHLETE_SELECT).order("last_name");
  return rows<Athlete>(result, "load athletes");
}
