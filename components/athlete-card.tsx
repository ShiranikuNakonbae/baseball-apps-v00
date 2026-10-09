import Link from "next/link";

import { StatGrid, Totals } from "@/components/ui";
import { initials, percent, plain, rate } from "@/lib/format";
import type { AttendanceStats, Athlete, SeasonStats } from "@/lib/types";

/** The athlete profile & performance card from the PRD wireframe. */
export function AthleteCard({
  athlete,
  season,
  attendance,
}: {
  athlete: Athlete;
  season?: SeasonStats;
  attendance?: AttendanceStats;
}) {
  const played = (season?.games_played ?? 0) > 0;
  const pitched = (season?.innings_pitched ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3">
      <section className="card card-body flex items-start gap-3">
        <div
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-club-accent/15 text-lg font-bold text-club-accent"
        >
          {initials(`${athlete.first_name} ${athlete.last_name}`)}
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">
            <Link href={`/athletes/${athlete.id}`} className="hover:underline">
              {athlete.first_name} {athlete.last_name}
            </Link>
            {athlete.jersey_number !== null ? <span className="muted"> #{athlete.jersey_number}</span> : null}
          </h2>
          <p className="muted">
            {[athlete.primary_position, athlete.secondary_position].filter(Boolean).join(" / ") || "Position —"}
          </p>
          <p className="text-xs text-club-muted">
            Bats {athlete.bats} · Throws {athlete.throws}
          </p>
          {athlete.team ? (
            <p className="text-xs text-club-muted">
              {athlete.team.name} ({athlete.team.division}, {athlete.team.season})
            </p>
          ) : (
            <p className="text-xs text-club-bad">Not assigned to a team</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Attendance</h3>
          <span className="text-xs text-club-muted">{percent(attendance?.overall_rate)}</span>
        </div>
        <div className="card-body flex flex-col gap-2">
          <StatGrid
            columns={2}
            items={[
              { label: "Practice rate", value: percent(attendance?.practice_rate) },
              {
                label: "Games attended",
                value: `${attendance?.games_attended ?? 0}/${attendance?.games_scheduled ?? 0}`,
              },
            ]}
          />
          <Totals
            pairs={[
              ["Present", attendance?.status_present ?? 0],
              ["Late", attendance?.status_late ?? 0],
              ["Excused", attendance?.status_excused ?? 0],
              ["Unexcused", attendance?.status_unexcused ?? 0],
            ]}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">Season batting{athlete.team?.season ? ` · ${athlete.team.season}` : ""}</h3>
          <span className="text-xs text-club-muted">{played ? `${season?.games_played} G` : "no games logged"}</span>
        </div>
        <div className="card-body flex flex-col gap-3">
          <StatGrid
            items={[
              { label: "AVG", value: played ? rate(season?.avg) : "—" },
              { label: "OBP", value: played ? rate(season?.obp) : "—" },
              { label: "SLG", value: played ? rate(season?.slg) : "—" },
              { label: "OPS", value: played ? plain(season?.ops, 3) : "—" },
            ]}
          />
          <Totals
            pairs={[
              ["PA", season?.total_pa ?? 0],
              ["AB", season?.total_ab ?? 0],
              ["H", season?.total_hits ?? 0],
              ["2B", season?.total_doubles ?? 0],
              ["3B", season?.total_triples ?? 0],
              ["HR", season?.total_hr ?? 0],
              ["R", season?.total_runs ?? 0],
              ["RBI", season?.total_rbi ?? 0],
              ["BB", season?.total_bb ?? 0],
              ["K", season?.total_k ?? 0],
              ["HBP", season?.total_hbp ?? 0],
              ["SF", season?.total_sf ?? 0],
            ]}
          />
        </div>
      </section>

      {pitched ? (
        <section className="card">
          <div className="card-head">
            <h3 className="card-title">Pitching</h3>
          </div>
          <div className="card-body">
            <StatGrid
              items={[
                { label: "IP", value: plain(season?.innings_pitched, 1) },
                { label: "ERA", value: season?.era !== null && season?.era !== undefined ? plain(season.era, 2) : "—" },
                { label: "Avg pitches", value: plain(season?.avg_pitch_count, 0) },
                { label: "ER", value: String(season?.total_earned_runs ?? 0) },
              ]}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
