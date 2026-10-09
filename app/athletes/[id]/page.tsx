import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteAthlete, saveAthlete } from "@/app/actions/club";
import { AthleteCard } from "@/components/athlete-card";
import { EmptyState, ErrorBanner, Field, SectionTitle, StatGrid } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import {
  getAttendanceStats,
  getAthlete,
  getParentsForAthletes,
  getSeasonStats,
  getGameLog,
  getTeams,
} from "@/lib/data";
import { formatDate, hits } from "@/lib/format";
import { POSITIONS, SIDES } from "@/lib/types";
import type { Athlete, Profile, Team } from "@/lib/types";

const sideOptions = SIDES.map((s) => ({ value: s, label: s }));
const positionOptions = POSITIONS.map((p) => ({ value: p, label: p }));

export default async function AthletePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const { error } = await searchParams;
  const isStaff = profile.role !== "parent";

  const athlete = await getAthlete(id);
  if (!athlete) notFound();

  const [season, attendance, gameLog, parents, teams] = await Promise.all([
    getSeasonStats([athlete.id]),
    getAttendanceStats([athlete.id]),
    getGameLog(athlete.id),
    isStaff ? getParentsForAthletes([athlete.id]) : Promise.resolve(new Map<string, Profile[]>()),
    isStaff ? getTeams() : Promise.resolve([] as Team[]),
  ]);

  const log = gameLog
    .filter((line) => line.event)
    .sort((a, b) => (b.event!.start_time > a.event!.start_time ? 1 : -1));
  const linkedParents = parents.get(athlete.id) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Link href={isStaff ? "/roster" : "/family"} className="link text-sm">
        ← {isStaff ? "Roster" : "Family"}
      </Link>

      <ErrorBanner message={error} />

      <AthleteCard athlete={athlete} season={season.get(athlete.id)} attendance={attendance.get(athlete.id)} />

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Game log</h3>
          <span className="text-xs text-club-muted">{log.length} entries</span>
        </div>
        <div className="card-body flex flex-col gap-2">
          {log.length === 0 ? (
            <EmptyState>No box scores logged yet.</EmptyState>
          ) : (
            log.map((line) => (
              <div key={line.event_id} className="border-b border-club-line pb-2 last:border-0 last:pb-0">
                <div className="row-between">
                  <Link href={`/events/${line.event_id}`} className="text-sm font-bold hover:underline">
                    {line.event!.title}
                  </Link>
                  <time className="text-xs text-club-muted">{formatDate(line.event!.start_time)}</time>
                </div>
                <p className="text-xs tabular-nums text-club-muted">
                  {hits(line)} · {line.pa} PA · {line.r} R · {line.rbi} RBI · {line.bb} BB · {line.k} K
                  {line.innings_pitched ? ` · ${line.innings_pitched} IP, ${line.earned_runs} ER` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {linkedParents.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Guardians</SectionTitle>
          <StatGrid
            columns={2}
            items={linkedParents.map((parent) => ({
              label: parent.full_name,
              value: parent.phone_number || parent.email,
            }))}
          />
        </section>
      ) : null}

      {isStaff ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Edit athlete</SectionTitle>
          <details className="card">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
              Profile details and team assignment
            </summary>
            <div className="flex flex-col gap-4 border-t border-club-line p-4">
              <EditForm athlete={athlete} teams={teams} isAdmin={profile.role === "admin"} />
              <form action={deleteAthlete}>
                <input type="hidden" name="id" value={athlete.id} />
                <button className="btn-danger w-full">Remove athlete</button>
              </form>
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function EditForm({ athlete, teams, isAdmin }: { athlete: Athlete; teams: Team[]; isAdmin: boolean }) {
  return (
    <form action={saveAthlete} className="flex flex-col gap-3">
      <input type="hidden" name="athlete_id" value={athlete.id} />
      <input type="hidden" name="next" value={`/athletes/${athlete.id}`} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="First name" name="first_name" defaultValue={athlete.first_name} required />
        <Field label="Last name" name="last_name" defaultValue={athlete.last_name} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Jersey"
          name="jersey_number"
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          defaultValue={athlete.jersey_number !== null ? String(athlete.jersey_number) : ""}
        />
        <Field label="Date of birth" name="date_of_birth" type="date" defaultValue={athlete.date_of_birth ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Primary position"
          name="primary_position"
          options={[{ value: "", label: "—" }, ...positionOptions]}
          defaultValue={athlete.primary_position ?? ""}
        />
        <Field
          label="Secondary"
          name="secondary_position"
          options={[{ value: "", label: "—" }, ...positionOptions]}
          defaultValue={athlete.secondary_position ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Bats" name="bats" options={sideOptions} defaultValue={athlete.bats} />
        <Field label="Throws" name="throws" options={sideOptions} defaultValue={athlete.throws} />
      </div>
      {isAdmin ? (
        <Field
          label="Team"
          name="team_id"
          options={[{ value: "", label: "Unassigned" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
          defaultValue={athlete.team_id ?? ""}
        />
      ) : null}
      <button className="btn-primary">Save athlete</button>
    </form>
  );
}
