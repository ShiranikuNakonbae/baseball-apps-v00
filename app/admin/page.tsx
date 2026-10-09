import Link from "next/link";

import {
  assignCoach,
  deleteTeam,
  linkParent,
  setProfileRole,
  unassignCoach,
  unlinkParent,
} from "@/app/actions/club";
import { TeamForm } from "@/components/team-form";
import { EmptyState, ErrorBanner, Field, SectionTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import {
  getAllAthletes,
  getParentLinks,
  getProfiles,
  getTeamCoachAssignments,
  getTeams,
  type CoachAssignment,
} from "@/lib/data";
import { athleteName, initials } from "@/lib/format";
import { ROLES } from "@/lib/types";
import type { Athlete, Profile } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireRole("admin");
  const { error } = await searchParams;

  const [teams, athletes, profiles, links, assignments] = await Promise.all([
    getTeams(),
    getAllAthletes(),
    getProfiles(),
    getParentLinks(),
    getTeamCoachAssignments(),
  ]);

  const parents = profiles.filter((p) => p.role === "parent");
  const coaches = profiles.filter((p) => p.role === "coach");
  const assignmentsByTeam = new Map<string, NonNullable<CoachAssignment["profile"]>[]>();
  for (const row of assignments) {
    if (!row.profile) continue;
    assignmentsByTeam.set(row.team_id, [...(assignmentsByTeam.get(row.team_id) ?? []), row.profile]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Club management</h1>
        <p className="muted">Signed in as {profile.full_name}.</p>
      </div>
      <ErrorBanner message={error} />

      <section className="flex flex-col gap-2">
        <SectionTitle>Teams</SectionTitle>
        <details className="card">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">Create a team</summary>
          <div className="border-t border-club-line p-4">
            <TeamForm />
          </div>
        </details>
        {teams.length === 0 ? (
          <EmptyState>No teams yet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {teams.map((team) => {
              const staff = assignmentsByTeam.get(team.id) ?? [];
              return (
                <article key={team.id} className="card card-body flex flex-col gap-3">
                  <div className="row-between">
                    <div>
                      <h3 className="font-bold">{team.name}</h3>
                      <p className="text-xs text-club-muted">
                        {team.division} · {team.season} ·{" "}
                        {athletes.filter((a) => a.team_id === team.id).length} athletes
                      </p>
                    </div>
                    <Link href={`/roster?team=${team.id}`} className="link text-xs">
                      Roster
                    </Link>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="stat-label">Coaches</p>
                    {staff.length === 0 ? (
                      <p className="text-xs text-club-muted">None assigned.</p>
                    ) : (
                      staff.map((coach) => (
                        <div key={coach.id} className="row-between gap-2">
                          <span className="text-sm">{coach.full_name}</span>
                          <form action={unassignCoach} className="shrink-0">
                            <input type="hidden" name="team_id" value={team.id} />
                            <input type="hidden" name="user_id" value={coach.id} />
                            <button className="btn-ghost btn-sm">Remove</button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>

                  <details className="border-t border-club-line pt-2">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
                      Edit team · assign coach
                    </summary>
                    <div className="flex flex-col gap-4 pt-2">
                      <TeamForm team={team} />
                      <form action={assignCoach} className="flex flex-col gap-3">
                        <input type="hidden" name="team_id" value={team.id} />
                        <Field
                          label="Coach account"
                          name="user_id"
                          options={
                            coaches.length > 0
                              ? [{ value: "", label: "Select coach..." }, ...coaches.map((c) => ({ value: c.id, label: `${c.full_name} (${c.email})` }))]
                              : [{ value: "", label: "No coach accounts — set a role below first" }]
                          }
                        />
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <input type="checkbox" name="is_head_coach" className="size-5 accent-club-accent" />
                          Head coach
                        </label>
                        <button className="btn-primary">Assign coach</button>
                      </form>
                      <form action={deleteTeam}>
                        <input type="hidden" name="id" value={team.id} />
                        <button className="btn-danger w-full">Delete team</button>
                      </form>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Link parents to athletes</SectionTitle>
        <details className="card">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">Add a link</summary>
          <div className="flex flex-col gap-3 border-t border-club-line p-4">
            <form action={linkParent} className="flex flex-col gap-3">
              <Field
                label="Athlete"
                name="athlete_id"
                options={
                  athletes.length > 0
                    ? [{ value: "", label: "Select athlete..." }, ...athletes.map((a) => ({ value: a.id, label: `${athleteName(a)}${teamLabel(a)}` }))]
                    : [{ value: "", label: "No athletes yet" }]
                }
              />
              <Field
                label="Parent account"
                name="parent_id"
                options={
                  parents.length > 0
                    ? [{ value: "", label: "Select account (or enter email below)" }, ...parents.map((p) => ({ value: p.id, label: `${p.full_name} (${p.email})` }))]
                    : [{ value: "", label: "No parent accounts yet (or enter email below)" }]
                }
              />
              <div>
                <label className="label" htmlFor="f-parent_email">
                  Or parent email
                </label>
                <input className="input" id="f-parent_email" name="parent_email" type="email" placeholder="you@example.com" />
                <p className="muted mt-1">
                  Use this when they have just signed up. Only accounts that already exist can be linked.
                </p>
              </div>
              <Field label="Relationship" name="relationship" defaultValue="Parent" />
              <button className="btn-primary">Link parent</button>
            </form>
          </div>
        </details>

        {links.length === 0 ? (
          <EmptyState>No parent links yet.</EmptyState>
        ) : (
          <div className="card card-body flex flex-col gap-1">
            {links.map((link) => (
              <div key={`${link.parent_id}-${link.athlete_id}`} className="row-between gap-2">
                <span className="text-sm">
                  <b>{link.parent?.full_name ?? "Unknown parent"}</b>
                  <span className="text-club-muted"> → {link.athlete ? athleteName(link.athlete) : "removed"}</span>
                </span>
                <form action={unlinkParent} className="shrink-0">
                  <input type="hidden" name="parent_id" value={link.parent_id} />
                  <input type="hidden" name="athlete_id" value={link.athlete_id} />
                  <button className="btn-ghost btn-sm">Unlink</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Accounts &amp; roles</SectionTitle>
        <p className="muted">Everyone who signs up starts as a parent. Promote staff here.</p>
        {profiles.length === 0 ? (
          <EmptyState>No accounts yet.</EmptyState>
        ) : (
          <div className="card card-body flex flex-col gap-2">
            {profiles.map((account) => (
              <RoleRow key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function teamLabel(athlete: Athlete) {
  return athlete.team?.name ? ` · ${athlete.team.name}` : "";
}

function RoleRow({ account }: { account: Profile }) {
  return (
    <form action={setProfileRole} className="flex flex-wrap items-center justify-between gap-2 border-b border-club-line pb-2 last:border-0 last:pb-0">
      <input type="hidden" name="user_id" value={account.id} />
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-club-raised text-xs font-bold text-club-muted"
        >
          {initials(account.full_name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{account.full_name}</span>
          <span className="block truncate text-xs text-club-muted">{account.email}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <select className="select w-auto" name="role" defaultValue={account.role} aria-label={`Role for ${account.full_name}`}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button className="btn-ghost btn-sm">Save</button>
      </div>
    </form>
  );
}
