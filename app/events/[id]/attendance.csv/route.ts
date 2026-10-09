import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Athlete, ClubEvent } from "@/lib/types";

const ATHLETE_SELECT =
  "id, first_name, last_name, jersey_number";

type RosterAthlete = Pick<Athlete, "id" | "first_name" | "last_name" | "jersey_number">;

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getProfile();
  if (!profile) return new Response("Sign in to download attendance.", { status: 401 });
  if (profile.role !== "admin") return new Response("Only club admins can download attendance.", { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  const eventResult = await supabase
    .from("events")
    .select("id, team_id, title, type, start_time, team:teams(name, division, season)")
    .eq("id", id)
    .maybeSingle();
  if (eventResult.error) return new Response(eventResult.error.message, { status: 500 });
  const event = eventResult.data as (Pick<ClubEvent, "id" | "team_id" | "title" | "type" | "start_time"> & {
    team: { name: string; division: string; season: string } | null;
  }) | null;
  if (!event) return new Response("Event not found.", { status: 404 });

  const [rosterResult, attendanceResult] = await Promise.all([
    supabase
      .from("athletes")
      .select(ATHLETE_SELECT)
      .eq("team_id", event.team_id ?? "")
      .order("jersey_number", { ascending: true }),
    supabase.from("attendance").select("athlete_id, status").eq("event_id", id),
  ]);
  if (rosterResult.error) return new Response(rosterResult.error.message, { status: 500 });
  if (attendanceResult.error) return new Response(attendanceResult.error.message, { status: 500 });

  const roster = (rosterResult.data ?? []) as RosterAthlete[];
  const statusOf = new Map(
    ((attendanceResult.data ?? []) as { athlete_id: string; status: string }[]).map((row) => [
      row.athlete_id,
      row.status,
    ]),
  );

  const lines = [
    ["Event", event.title],
    ["Team", event.team ? `${event.team.name} · ${event.team.division} · ${event.team.season}` : ""],
    ["Start", event.start_time],
    [],
    ["Jersey", "First name", "Last name", "Attendance"],
    ...roster.map((athlete) => [
      athlete.jersey_number ?? "",
      athlete.first_name,
      athlete.last_name,
      statusOf.get(athlete.id) ?? "",
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");

  const slug = event.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `attendance-${slug || event.id}.csv`;

  return new Response(`\uFEFF${lines}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
