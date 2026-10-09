import Link from "next/link";

import { saveAthlete } from "@/app/actions/club";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState, ErrorBanner, Field, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import {
  getAllAthletes,
  getAthletesForParent,
  getCoachTeamIds,
  getParentsForAthletes,
  getSeasonStats,
  getTeams,
} from "@/lib/data";
import { athleteName, plain, rate } from "@/lib/format";
import type { Athlete, Profile, SeasonStats } from "@/lib/types";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; team?: string }>;
}) {
  const profile = await requireProfile();
  const { error, team: teamFilter } = await searchParams;
  const isStaff = profile.role !== "parent";

  const [teams, coachTeamIds, allAthletes, family] = await Promise.all([
    getTeams(),
    isStaff ? getCoachTeamIds(profile.id) : Promise.resolve([] as string[]),
    getAllAthletes(),
    isStaff ? Promise.resolve([] as Athlete[]) : getAthletesForParent(profile.id),
  ]);

  const familyTeamIds = family.map((a) => a.team_id).filter((id): id is string => Boolean(id));
  const visibleTeams = teams.filter((team) =>
    profile.role === "admin"
      ? true
      : profile.role === "coach"
        ? coachTeamIds.includes(team.id)
        : familyTeamIds.includes(team.id),
  );
  const shown = teamFilter ? visibleTeams.filter((t) => t.id === teamFilter) : visibleTeams;

  const rosterByTeam = new Map<string, Athlete[]>();
  for (const athlete of allAthletes) {
    if (!athlete.team_id) continue;
    rosterByTeam.set(athlete.team_id, [...(rosterByTeam.get(athlete.team_id) ?? []), athlete]);
  }

  const athleteIds = allAthletes.map((a) => a.id);
  const [stats, parentsByAthlete] = await Promise.all([
    getSeasonStats(athleteIds),
    isStaff ? getParentsForAthletes(athleteIds) : Promise.resolve(new Map<string, Profile[]>()),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Roster</h1>
      <ErrorBanner message={error} />

      {isStaff ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Add athlete</SectionTitle>
          <details className="card">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
              New player on a team roster
            </summary>
            <div className="border-t border-club-line p-4">
              <AthleteForm teams={shown.length > 0 ? shown : teams} />
            </div>
          </details>
        </section>
      ) : null}

      {shown.length === 0 ? <EmptyState>No teams are linked to your account yet.</EmptyState> : null}

      {shown.map((team) => {
        const roster = (rosterByTeam.get(team.id) ?? []).sort(
          (a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999),
        );
        return (
          <section key={team.id} className="flex flex-col gap-2">
            <div className="row-between">
              <h2 className="card-title">
                {team.name} · {team.division} · {team.season}
              </h2>
              {teamFilter ? (
                <Link href="/roster" className="link text-xs">
                  All teams
                </Link>
              ) : null}
            </div>
            {roster.length === 0 ? (
              <EmptyState>No athletes on this team yet.</EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {roster.map((athlete) => (
                  <RosterRow
                    key={athlete.id}
                    athlete={athlete}
                    season={stats.get(athlete.id)}
                    parents={parentsByAthlete.get(athlete.id) ?? []}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function RosterRow({
  athlete,
  season,
  parents,
}: {
  athlete: Athlete;
  season?: SeasonStats;
  parents: Profile[];
}) {
  return (
    <article className="card card-body flex flex-col gap-1">
      <div className="row-between">
        <Link href={`/athletes/${athlete.id}`} className="font-bold hover:underline">
          {athlete.jersey_number !== null ? `#${athlete.jersey_number} ` : ""}
          {athleteName(athlete)}
        </Link>
        <span className="text-xs text-club-muted">
          {[athlete.primary_position, athlete.secondary_position].filter(Boolean).join(" / ") || "—"}
        </span>
      </div>
      <p className="text-xs text-club-muted">
        Bats {athlete.bats} · Throws {athlete.throws}
      </p>
      <p className="text-sm tabular-nums">
        <b>AVG {rate(season?.avg)}</b> · OBP {rate(season?.obp)} · SLG {rate(season?.slg)} · OPS{" "}
        {season?.games_played ? plain(season.ops, 3) : "—"}
      </p>
      {parents.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-club-muted">
          {parents.map((parent) => (
            <li key={parent.id}>
              {parent.full_name}
              {parent.phone_number ? ` · ${parent.phone_number}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function AthleteForm({ teams }: { teams: { id: string; name: string }[] }) {
  return (
    <form action={saveAthlete} className="flex flex-col gap-3">
      <input type="hidden" name="next" value="/roster" />
      <Field label="Team" name="team_id" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="First name" name="first_name" required />
        <Field label="Last name" name="last_name" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jersey" name="jersey_number" type="number" min={0} max={99} inputMode="numeric" />
        <Field label="Date of birth" name="date_of_birth" type="date" />
      </div>
      <SubmitButton pendingLabel="Adding…">Add athlete</SubmitButton>
    </form>
  );
}
