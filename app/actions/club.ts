"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clubLocalToIso } from "@/lib/time";
import {
  ATTENDANCE_STATUSES,
  DIVISIONS,
  EVENT_TYPES,
  ROLES,
  RSVP_STATUSES,
  SIDES,
} from "@/lib/types";
import type { AttendanceStatus, BattingLine, Profile } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BOX_FIELDS = [
  "pa",
  "ab",
  "singles",
  "doubles",
  "triples",
  "hr",
  "r",
  "rbi",
  "bb",
  "k",
  "hbp",
  "sf",
  "pitch_count",
  "innings_pitched",
  "earned_runs",
] as const satisfies readonly (keyof BattingLine)[];

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads `<prefix>_<athleteId>` as a non-negative number; blank or junk is 0. */
function count(form: FormData, field: string, athleteId: string): number {
  const raw = text(form, `${field}_${athleteId}`);
  if (raw === "") return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return field === "innings_pitched" ? parsed : Math.round(parsed);
}

function int(form: FormData, key: string): number {
  const raw = text(form, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function uuid(form: FormData, key: string): string {
  const raw = text(form, key);
  return UUID.test(raw) ? raw : "";
}

function pick<T extends string>(value: string, allowed: readonly T[]): T | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

/** Only same-site relative paths, so a crafted `next` field cannot bounce users off-site. */
function safeNext(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function back(path: string, error?: string): never {
  const target = error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path;
  redirect(target);
}

async function requireRole(allowed: Profile["role"][], path: string): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) back("/login", "Sign in again to continue.");
  if (!allowed.includes(profile.role)) back(path, "Only club staff can record this.");
  return profile;
}

const requireStaff = () => requireRole(["admin", "coach"], "/");
const requireAdmin = () => requireRole(["admin"], "/admin");

function addDaysToNaive(naive: string, days: number): string {
  const [datePart = "", timePart = "00:00"] = naive.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const newY = dt.getUTCFullYear();
  const newM = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const newD = String(dt.getUTCDate()).padStart(2, "0");
  return `${newY}-${newM}-${newD}T${timePart}`;
}

// ─── Events ──────────────────────────────────────────────────────────────────
export async function saveEvent(form: FormData) {
  const eventId = uuid(form, "id");
  const rawTeamId = text(form, "team_id");
  const teamId = uuid(form, "team_id");
  const title = text(form, "title");
  const locationName = text(form, "location_name");
  const start = text(form, "start_time");
  const end = text(form, "end_time");
  const path = eventId ? `/events/${eventId}` : "/";
  const type = pick(text(form, "type"), EVENT_TYPES) || "practice";
  const isAllTeams = !eventId && rawTeamId === "all";
  const recurrence = text(form, "recurrence");
  const repeatWeeks = !eventId && recurrence === "weekly" ? Math.min(Math.max(int(form, "recurrence_weeks") || 4, 1), 20) : 1;

  if ((!teamId && !isAllTeams) || !title || !locationName || !start || !end) {
    back(path, "Team, title, location and both times are required.");
  }
  // Events are managed by the club admin only; coaches work around them.
  const profile = await requireRole(["admin"], path);

  let startIso: string;
  let endIso: string;
  try {
    startIso = clubLocalToIso(start);
    endIso = clubLocalToIso(end);
  } catch {
    back(path, "Those times could not be read.");
  }
  if (new Date(endIso) <= new Date(startIso)) {
    back(path, "The end time must be after the start time.");
  }

  const supabase = await createClient();

  if (isAllTeams) {
    let targetTeamIds: string[] = [];
    if (profile.role === "admin") {
      const { data: allTeams } = await supabase.from("teams").select("id");
      targetTeamIds = (allTeams ?? []).map((t) => t.id);
    } else {
      const { data: coachTeams } = await supabase.from("team_coaches").select("team_id").eq("user_id", profile.id);
      targetTeamIds = (coachTeams ?? []).map((t) => t.team_id);
    }
    if (targetTeamIds.length === 0) {
      back(path, "No teams available to create events for.");
    }
    const rows: {
      team_id: string;
      title: string;
      type: (typeof EVENT_TYPES)[number];
      start_time: string;
      end_time: string;
      location_name: string;
      location_url: string | null;
      notes: string | null;
      created_by: string;
    }[] = [];

    for (let w = 0; w < repeatWeeks; w++) {
      const weekStartIso = w === 0 ? startIso : clubLocalToIso(addDaysToNaive(start, w * 7));
      const weekEndIso = w === 0 ? endIso : clubLocalToIso(addDaysToNaive(end, w * 7));
      for (const tid of targetTeamIds) {
        rows.push({
          team_id: tid,
          title,
          type,
          start_time: weekStartIso,
          end_time: weekEndIso,
          location_name: locationName,
          location_url: text(form, "location_url") || null,
          notes: text(form, "notes") || null,
          created_by: profile.id,
        });
      }
    }

    const { error } = await supabase.from("events").insert(rows);
    if (error) back(path, error.message);
    revalidatePath("/");
    redirect("/");
  }

  if (eventId) {
    const row = {
      team_id: teamId,
      title,
      type,
      start_time: startIso,
      end_time: endIso,
      location_name: locationName,
      location_url: text(form, "location_url") || null,
      notes: text(form, "notes") || null,
    };
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) back(path, error.message);
    revalidatePath(path);
    revalidatePath("/");
    back(path);
  } else if (repeatWeeks > 1) {
    const rows = [];
    for (let w = 0; w < repeatWeeks; w++) {
      const weekStartIso = w === 0 ? startIso : clubLocalToIso(addDaysToNaive(start, w * 7));
      const weekEndIso = w === 0 ? endIso : clubLocalToIso(addDaysToNaive(end, w * 7));
      rows.push({
        team_id: teamId,
        title,
        type,
        start_time: weekStartIso,
        end_time: weekEndIso,
        location_name: locationName,
        location_url: text(form, "location_url") || null,
        notes: text(form, "notes") || null,
        created_by: profile.id,
      });
    }
    const { error } = await supabase.from("events").insert(rows);
    if (error) back(path, error.message);
    revalidatePath("/");
    redirect("/");
  } else {
    const row = {
      team_id: teamId,
      title,
      type,
      start_time: startIso,
      end_time: endIso,
      location_name: locationName,
      location_url: text(form, "location_url") || null,
      notes: text(form, "notes") || null,
      created_by: profile.id,
    };
    const { data, error } = await supabase.from("events").insert(row).select("id").single();
    if (error) back(path, error.message);
    revalidatePath("/");
    back(`/events/${data.id}`);
  }
}

export async function deleteEvent(form: FormData) {
  const eventId = uuid(form, "id");
  if (!eventId) back("/", "That event is missing.");
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) back("/", error.message);
  revalidatePath("/");
  revalidatePath("/roster");
  back("/");
}

// ─── RSVP ────────────────────────────────────────────────────────────────────
export async function setRsvp(form: FormData) {
  const eventId = uuid(form, "event_id");
  const athleteId = uuid(form, "athlete_id");
  const path = `/events/${eventId}`;
  const status = pick(text(form, "status"), RSVP_STATUSES) || "tentative";
  if (!eventId || !athleteId) back(path, "That RSVP was malformed.");

  const supabase = await createClient();
  const { error } = await supabase.from("event_rsvps").upsert(
    { event_id: eventId, athlete_id: athleteId, status, updated_at: new Date().toISOString() },
    { onConflict: "event_id,athlete_id" },
  );
  if (error) back(path, error.message);

  revalidatePath("/");
  revalidatePath(path);
  back(path);
}

// ─── Attendance ──────────────────────────────────────────────────────────────
export async function saveAttendance(form: FormData) {
  const eventId = uuid(form, "event_id");
  const path = `/events/${eventId}`;
  if (!eventId) back("/", "That attendance sheet was malformed.");
  const profile = await requireStaff();

  const rawAthleteIds = form
    .getAll("athlete_ids")
    .map((value) => (UUID.test(String(value)) ? String(value) : ""))
    .filter(Boolean);
  const athleteIds = Array.from(new Set(rawAthleteIds));

  const present: { event_id: string; athlete_id: string; status: AttendanceStatus; logged_by: string }[] = [];
  const cleared: string[] = [];
  for (const athleteId of athleteIds) {
    const status = pick(text(form, `att_${athleteId}`), ATTENDANCE_STATUSES);
    if (status) present.push({ event_id: eventId, athlete_id: athleteId, status, logged_by: profile.id });
    else cleared.push(athleteId);
  }
  if (present.length === 0 && cleared.length === 0) back(path, "No roster loaded for this event.");

  const supabase = await createClient();
  if (cleared.length) {
    const { error } = await supabase.from("attendance").delete().eq("event_id", eventId).in("athlete_id", cleared);
    if (error) back(path, error.message);
  }
  if (present.length) {
    const { error } = await supabase.from("attendance").upsert(present, { onConflict: "event_id,athlete_id" });
    if (error) back(path, error.message);
  }

  revalidatePath(path);
  revalidatePath("/");
  back(path);
}

// ─── Box score ───────────────────────────────────────────────────────────────
export async function savePlayerBoxScore(form: FormData) {
  const eventId = uuid(form, "event_id");
  const athleteId = uuid(form, "athlete_id");
  const path = `/events/${eventId}`;
  if (!eventId || !athleteId) back("/", "That box score was malformed.");
  const profile = await requireStaff();

  const line = Object.fromEntries(
    BOX_FIELDS.map((field) => [field, count(form, field, athleteId)]),
  ) as Record<(typeof BOX_FIELDS)[number], number>;

  const touched = BOX_FIELDS.some((field) => text(form, `${field}_${athleteId}`) !== "");
  const supabase = await createClient();

  if (!touched) {
    const { error } = await supabase.from("game_stats").delete().eq("event_id", eventId).eq("athlete_id", athleteId);
    if (error) back(path, error.message);
  } else {
    const hits = line.singles + line.doubles + line.triples + line.hr;
    const label = text(form, `name_${athleteId}`) || "This player";
    if (hits > line.ab) back(path, `${label}: hits cannot exceed at-bats.`);
    if (line.ab + line.bb + line.hbp + line.sf > line.pa) {
      back(path, `${label}: plate appearances must cover at-bats, walks, hit-by-pitch and sacrifices.`);
    }

    const { error } = await supabase.from("game_stats").upsert(
      { event_id: eventId, athlete_id: athleteId, ...line, logged_by: profile.id },
      { onConflict: "event_id,athlete_id" },
    );
    if (error) back(path, error.message);
  }

  revalidatePath(path);
  revalidatePath("/roster");
  revalidatePath("/family");
  revalidatePath(`/athletes/${athleteId}`);
  back(path);
}

export async function saveBoxScore(form: FormData) {
  const eventId = uuid(form, "event_id");
  const path = `/events/${eventId}`;
  if (!eventId) back("/", "That box score was malformed.");
  const profile = await requireStaff();

  const rawAthleteIds = form
    .getAll("athlete_ids")
    .map((value) => (UUID.test(String(value)) ? String(value) : ""))
    .filter(Boolean);
  const athleteIds = Array.from(new Set(rawAthleteIds));
  if (athleteIds.length === 0) back(path, "No roster loaded for this event.");

  const written: (BattingLine & { logged_by: string })[] = [];
  const cleared: string[] = [];

  for (const athleteId of athleteIds) {
    const line = Object.fromEntries(
      BOX_FIELDS.map((field) => [field, count(form, field, athleteId)]),
    ) as Record<(typeof BOX_FIELDS)[number], number>;

    const touched = BOX_FIELDS.some((field) => text(form, `${field}_${athleteId}`) !== "");
    if (!touched) {
      cleared.push(athleteId);
      continue;
    }

    const hits = line.singles + line.doubles + line.triples + line.hr;
    const label = text(form, `name_${athleteId}`) || "A player";
    if (hits > line.ab) back(path, `${label}: hits cannot exceed at-bats.`);
    if (line.ab + line.bb + line.hbp + line.sf > line.pa) {
      back(path, `${label}: plate appearances must cover at-bats, walks, hit-by-pitch and sacrifices.`);
    }

    written.push({ event_id: eventId, athlete_id: athleteId, ...line, logged_by: profile.id });
  }

  const supabase = await createClient();
  if (cleared.length) {
    const { error } = await supabase.from("game_stats").delete().eq("event_id", eventId).in("athlete_id", cleared);
    if (error) back(path, error.message);
  }
  if (written.length) {
    const { error } = await supabase.from("game_stats").upsert(written, { onConflict: "event_id,athlete_id" });
    if (error) back(path, error.message);
  }

  revalidatePath(path);
  revalidatePath("/roster");
  revalidatePath("/family");
  back(path);
}

// ─── Management: teams, athletes, links, roles ───────────────────────────────
export async function saveTeam(form: FormData) {
  const teamId = uuid(form, "id");
  const name = text(form, "name");
  const season = text(form, "season");
  const division = pick(text(form, "division"), DIVISIONS) || "minor";
  if (!name || !season) back("/admin", "Team name and season are required.");
  await requireAdmin();

  const supabase = await createClient();
  const { error } = teamId
    ? await supabase.from("teams").update({ name, season, division }).eq("id", teamId)
    : await supabase.from("teams").insert({ name, season, division });
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/");
  back("/admin");
}

export async function deleteTeam(form: FormData) {
  const teamId = uuid(form, "id");
  if (!teamId) back("/admin", "That team is missing.");
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/");
  back("/admin");
}

export async function saveAthlete(form: FormData) {
  const athleteId = uuid(form, "athlete_id");
  const rawTeam = text(form, "team_id");
  const teamId = uuid(form, "team_id");
  const firstName = text(form, "first_name");
  const lastName = text(form, "last_name");
  const next = safeNext(text(form, "next"), athleteId ? `/athletes/${athleteId}` : "/roster");

  if (!firstName || !lastName) back(next, "First and last name are required.");
  if (rawTeam && !teamId && rawTeam !== "") back(next, "Pick a team for this athlete.");
  const profile = await requireRole(["admin", "coach"], next);
  const isAdmin = profile.role === "admin";

  const rawDob = text(form, "date_of_birth");
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : null;

  const row: {
    first_name: string;
    last_name: string;
    jersey_number: number | null;
    primary_position: string | null;
    secondary_position: string | null;
    bats: (typeof SIDES)[number];
    throws: (typeof SIDES)[number];
    date_of_birth: string | null;
    team_id?: string | null;
  } = {
    first_name: firstName,
    last_name: lastName,
    jersey_number: text(form, "jersey_number") ? int(form, "jersey_number") : null,
    primary_position: text(form, "primary_position") || null,
    secondary_position: text(form, "secondary_position") || null,
    bats: pick(text(form, "bats"), SIDES) || "right",
    throws: pick(text(form, "throws"), SIDES) || "right",
    date_of_birth: dob,
  };

  // Team assignment (including re-assignment) is allowed for staff; RLS limits
  // coaches to teams they coach, admins to any team.
  row.team_id = teamId || null;

  const supabase = await createClient();
  if (athleteId) {
    const { error } = await supabase
      .from("athletes")
      .update(row)
      .eq("id", athleteId);
    if (error) back(next, error.message);
  } else {
    if (!isAdmin) back(next, "Only club management can add athletes.");
    const { error } = await supabase.from("athletes").insert({ ...row, team_id: teamId || null });
    if (error) back(next, error.message);
  }

  revalidatePath("/roster");
  revalidatePath("/admin");
  revalidatePath("/family");
  revalidatePath("/");
  if (athleteId) revalidatePath(`/athletes/${athleteId}`);
  back(next);
}

export async function deleteAthlete(form: FormData) {
  const athleteId = uuid(form, "id");
  if (!athleteId) back("/roster", "That athlete is missing.");
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("athletes").delete().eq("id", athleteId);
  if (error) back("/roster", error.message);

  revalidatePath("/roster");
  revalidatePath("/admin");
  revalidatePath("/family");
  revalidatePath("/");
  back("/roster");
}

export async function linkParent(form: FormData) {
  const athleteId = uuid(form, "athlete_id");
  let parentId = uuid(form, "parent_id");
  const email = text(form, "parent_email").toLowerCase();
  const relationship = text(form, "relationship") || "Parent";
  await requireAdmin();
  if (!athleteId) back("/admin", "That athlete is missing.");

  const supabase = await createClient();
  if (!parentId) {
    if (!email) back("/admin", "Enter the parent's email or pick an account.");
    const found = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (found.error) back("/admin", found.error.message);
    if (!found.data) back("/admin", "No account uses that email yet — ask them to sign up first.");
    parentId = found.data.id as string;
  }

  const { error } = await supabase
    .from("parent_athletes")
    .upsert({ parent_id: parentId, athlete_id: athleteId, relationship }, { onConflict: "parent_id,athlete_id" });
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/family");
  revalidatePath("/");
  back("/admin");
}

export async function unlinkParent(form: FormData) {
  const athleteId = uuid(form, "athlete_id");
  const parentId = uuid(form, "parent_id");
  if (!athleteId || !parentId) back("/admin", "That link is missing.");
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("parent_athletes")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("parent_id", parentId);
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/family");
  revalidatePath("/");
  back("/admin");
}

export async function assignCoach(form: FormData) {
  const teamId = uuid(form, "team_id");
  const userId = uuid(form, "user_id");
  await requireAdmin();
  if (!teamId || !userId) back("/admin", "Pick a coach and a team.");

  const supabase = await createClient();
  const { error } = await supabase.from("team_coaches").upsert(
    { team_id: teamId, user_id: userId, is_head_coach: text(form, "is_head_coach") === "on" },
    { onConflict: "team_id,user_id" },
  );
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/");
  back("/admin");
}

export async function unassignCoach(form: FormData) {
  const teamId = uuid(form, "team_id");
  const userId = uuid(form, "user_id");
  if (!teamId || !userId) back("/admin", "That assignment is missing.");
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("team_coaches").delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/");
  back("/admin");
}

export async function setProfileRole(form: FormData) {
  const userId = uuid(form, "user_id");
  const role = pick(text(form, "role"), ROLES) || "parent";
  const profile = await requireAdmin();
  if (!userId) back("/admin", "That account is missing.");
  if (userId === profile.id && role !== "admin") {
    back("/admin", "You cannot remove your own admin role.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) back("/admin", error.message);

  revalidatePath("/admin");
  revalidatePath("/roster");
  revalidatePath("/");
  back("/admin");
}
