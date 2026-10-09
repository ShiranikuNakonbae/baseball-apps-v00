import Link from "next/link";

import { EventForm } from "@/components/event-form";
import { EmptyState, ErrorBanner, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import {
  getAthletesForParent,
  getCoachTeamIds,
  getRecentEvents,
  getRsvpResponsesForEvents,
  getRsvpSummary,
  getRsvpsForAthletes,
  getSeasonStats,
  getTeams,
  getUpcomingEvents,
  type EventRsvpDetail,
} from "@/lib/data";
import { athleteName, formatDay, formatTimeRange, rate } from "@/lib/format";
import type { Athlete, ClubEvent, Rsvp, Team } from "@/lib/types";

const RSVP_LABEL: Record<Rsvp["status"], string> = {
  attending: "Going",
  not_attending: "Out",
  tentative: "Maybe",
};

const RSVP_CLASS: Record<Rsvp["status"], string> = {
  attending: "text-club-good",
  not_attending: "text-club-bad",
  tentative: "text-club-muted",
};

function EventCard({ event, children }: { event: ClubEvent; children?: React.ReactNode }) {
  return (
    <article className="card card-body flex flex-col gap-2">
      <div className="row-between">
        <span className={`badge badge-${event.type}`}>{event.type}</span>
        <time className="text-xs font-semibold text-club-muted">{formatDay(event.start_time)}</time>
      </div>
      <Link href={`/events/${event.id}`} className="text-base font-bold hover:underline">
        {event.title}
      </Link>
      <p className="muted">
        {formatTimeRange(event.start_time, event.end_time)} · {event.location_name}
      </p>
      {event.team ? (
        <p className="text-xs text-club-muted">
          {event.team.name} · {event.team.division}
        </p>
      ) : null}
      {children}
    </article>
  );
}

function StaffRsvpPreview({
  counts,
  responses = [],
}: {
  counts: Record<string, number>;
  responses?: EventRsvpDetail[];
}) {
  const attending = responses.filter((r) => r.status === "attending");
  const tentative = responses.filter((r) => r.status === "tentative");
  const notAttending = responses.filter((r) => r.status === "not_attending");
  const total = responses.length;

  return (
    <div className="flex flex-col gap-1.5 border-t border-club-line/60 pt-2 text-xs">
      <div className="row-between">
        <p className="text-club-muted">
          <span className="font-bold text-club-good">{counts.attending ?? 0}</span> going ·{" "}
          <span className="font-bold text-club-muted">{counts.tentative ?? 0}</span> maybe ·{" "}
          <span className="font-bold text-club-bad">{counts.not_attending ?? 0}</span> out
        </p>
        <span className="text-[11px] font-semibold text-club-muted">
          {total} responded
        </span>
      </div>

      {total > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-club-accent hover:underline">
            View responded players ({total})
          </summary>
          <div className="mt-2 flex flex-col gap-1 rounded-lg border border-club-line/70 bg-club-raised/60 p-2.5">
            {attending.length > 0 ? (
              <div>
                <span className="font-bold text-club-good">Going: </span>
                <span className="text-club-text">
                  {attending
                    .map(
                      (r) =>
                        `${r.athlete ? athleteName(r.athlete) : "Player"}${
                          r.athlete?.jersey_number !== null ? ` (#${r.athlete?.jersey_number})` : ""
                        }`,
                    )
                    .join(", ")}
                </span>
              </div>
            ) : null}
            {tentative.length > 0 ? (
              <div>
                <span className="font-bold text-club-muted">Maybe: </span>
                <span className="text-club-text">
                  {tentative
                    .map(
                      (r) =>
                        `${r.athlete ? athleteName(r.athlete) : "Player"}${
                          r.athlete?.jersey_number !== null ? ` (#${r.athlete?.jersey_number})` : ""
                        }`,
                    )
                    .join(", ")}
                </span>
              </div>
            ) : null}
            {notAttending.length > 0 ? (
              <div>
                <span className="font-bold text-club-bad">Out: </span>
                <span className="text-club-text">
                  {notAttending
                    .map(
                      (r) =>
                        `${r.athlete ? athleteName(r.athlete) : "Player"}${
                          r.athlete?.jersey_number !== null ? ` (#${r.athlete?.jersey_number})` : ""
                        }`,
                    )
                    .join(", ")}
                </span>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function FamilyPreview({ athletes, avg }: { athletes: Athlete[]; avg: Map<string, number | null> }) {
  if (athletes.length === 0) {
    return <EmptyState>No athlete is linked to your account yet. A club admin links parents to athletes.</EmptyState>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {athletes.map((athlete) => (
        <Link key={athlete.id} href={`/athletes/${athlete.id}`} className="card card-body flex flex-col gap-1">
          <span className="font-bold">
            {athleteName(athlete)}
            {athlete.jersey_number !== null ? <span className="muted"> #{athlete.jersey_number}</span> : null}
          </span>
          <span className="muted">AVG {rate(avg.get(athlete.id) ?? null)}</span>
        </Link>
      ))}
    </div>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { error } = await searchParams;
  const isParent = profile.role === "parent";

  const [upcoming, recent, familyAthletes, coachTeamIds, allTeams] = await Promise.all([
    getUpcomingEvents(),
    isParent ? Promise.resolve([] as ClubEvent[]) : getRecentEvents(),
    isParent ? getAthletesForParent(profile.id) : Promise.resolve([] as Athlete[]),
    isParent ? Promise.resolve([] as string[]) : getCoachTeamIds(profile.id),
    getTeams(),
  ]);

  const seasonStats = await getSeasonStats(familyAthletes.map((a) => a.id));
  const myAverages = new Map<string, number | null>(
    [...seasonStats].map(([id, stats]) => [id, stats.avg]),
  );

  const upcomingIds = upcoming.map((e) => e.id);
  const [headcount, rsvpResponses] = await Promise.all([
    isParent ? Promise.resolve(new Map<string, Record<string, number>>()) : getRsvpSummary(upcomingIds),
    isParent ? Promise.resolve(new Map<string, EventRsvpDetail[]>()) : getRsvpResponsesForEvents(upcomingIds),
  ]);

  const myRsvps = new Map<string, Rsvp["status"]>();
  if (isParent) {
    for (const rsvp of await getRsvpsForAthletes(familyAthletes.map((a) => a.id))) {
      myRsvps.set(`${rsvp.event_id}:${rsvp.athlete_id}`, rsvp.status);
    }
  }

  const teamIdsForNewEvent: string[] =
    profile.role === "parent" ? [] : profile.role === "coach" ? coachTeamIds : allTeams.map((t) => t.id);
  const teamsForNewEvent: Team[] = allTeams.filter((t) => teamIdsForNewEvent.includes(t.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{profile.full_name}</h1>
        <p className="muted">Signed in as {profile.role}.</p>
      </div>
      <ErrorBanner message={error} />

      {isParent ? (
        <section className="flex flex-col gap-2">
          <SectionTitle href="/family" hrefLabel="Full family view">
            My athletes
          </SectionTitle>
          <FamilyPreview athletes={familyAthletes} avg={myAverages} />
        </section>
      ) : null}

      {teamsForNewEvent.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>New event</SectionTitle>
          <EventForm teams={teamsForNewEvent} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>Upcoming</SectionTitle>
        {upcoming.length === 0 ? (
          <EmptyState>Nothing scheduled yet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event}>
                {isParent ? (
                  <FamilyRsvpLines event={event} athletes={familyAthletes} rsvps={myRsvps} />
                ) : (
                  <StaffRsvpPreview
                    counts={headcount.get(event.id) ?? {}}
                    responses={rsvpResponses.get(event.id) ?? []}
                  />
                )}
              </EventCard>
            ))}
          </div>
        )}
      </section>

      {!isParent && recent.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Recently finished</SectionTitle>
          <div className="flex flex-col gap-2">
            {recent.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event}>
                <Link href={`/events/${event.id}`} className="btn-ghost btn-sm">
                  Attendance &amp; box score
                </Link>
              </EventCard>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FamilyRsvpLines({
  event,
  athletes,
  rsvps,
}: {
  event: ClubEvent;
  athletes: Athlete[];
  rsvps: Map<string, Rsvp["status"]>;
}) {
  const here = athletes.filter((a) => a.team_id === event.team_id);
  if (here.length === 0) return <p className="text-xs text-club-muted">None of your athletes are on this team.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {here.map((athlete) => {
        const status = rsvps.get(`${event.id}:${athlete.id}`);
        return (
          <li key={athlete.id} className="flex items-center justify-between gap-2 text-xs">
            <span>{athleteName(athlete)}</span>
            <span className={`font-bold uppercase ${status ? RSVP_CLASS[status] : "text-club-muted"}`}>
              {status ? RSVP_LABEL[status] : "No RSVP"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
