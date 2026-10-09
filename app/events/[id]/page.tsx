import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteEvent, saveAttendance, savePlayerBoxScore, setRsvp } from "@/app/actions/club";
import { EventForm } from "@/components/event-form";
import { EmptyState, ErrorBanner, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { getAthletesForParent, getEventBundle, getTeams } from "@/lib/data";
import { athleteName, formatDate, formatTimeRange, hits } from "@/lib/format";
import { ATTENDANCE_STATUSES, RSVP_STATUSES } from "@/lib/types";
import type { Athlete, BattingLine } from "@/lib/types";

const RSVP_LABEL: Record<string, string> = {
  attending: "Attending",
  not_attending: "Absent",
  tentative: "Tentative",
};

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const { error } = await searchParams;

  const bundle = await getEventBundle(id);
  if (!bundle) notFound();
  const { event, roster, rsvps, attendance, lines } = bundle;

  const isStaff = profile.role !== "parent";
  // A parent may only answer for their own children, never the whole roster.
  const familyIds = profile.role === "parent" ? (await getAthletesForParent(profile.id)).map((a) => a.id) : [];
  const myAthletes = roster.filter((a) => familyIds.includes(a.id));
  const teams = isStaff ? await getTeams() : [];

  const rsvpOf = new Map(rsvps.map((r) => [r.athlete_id, r.status]));
  const attendanceOf = new Map(attendance.map((a) => [a.athlete_id, a.status]));
  const lineOf = new Map(lines.map((l) => [l.athlete_id, l]));

  const counts = {
    present: attendance.filter((a) => a.status === "present").length,
    late: attendance.filter((a) => a.status === "late").length,
    excused: attendance.filter((a) => a.status === "excused").length,
    unexcused: attendance.filter((a) => a.status === "unexcused").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="link text-sm">
        ← Schedule
      </Link>

      <header className="card card-body flex flex-col gap-2">
        <div className="row-between">
          <span className={`badge badge-${event.type}`}>{event.type}</span>
          <time className="text-xs font-semibold text-club-muted">{formatDate(event.start_time)}</time>
        </div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="muted">
          {formatTimeRange(event.start_time, event.end_time)} · {event.location_name}
        </p>
        {event.team ? (
          <p className="text-xs text-club-muted">
            {event.team.name} · {event.team.division}
          </p>
        ) : null}
        {event.location_url ? (
          <a
            href={event.location_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost btn-sm self-start"
          >
            View map
          </a>
        ) : null}
        {event.notes ? <p className="text-sm whitespace-pre-wrap">{event.notes}</p> : null}
      </header>

      <ErrorBanner message={error} />

      {roster.length === 0 ? (
        <EmptyState>This team has no athletes yet.</EmptyState>
      ) : null}

      {profile.role === "parent" && myAthletes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>RSVP</SectionTitle>
          {myAthletes.map((athlete) => (
            <RsvpRow key={athlete.id} athlete={athlete} eventId={event.id} current={rsvpOf.get(athlete.id)} />
          ))}
        </section>
      ) : null}

      {isStaff ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Headcount &amp; RSVP responses</SectionTitle>
          <div className="card card-body flex flex-col gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <b className="text-club-good">{counts.present}</b> present
              </span>
              <span>
                <b className="text-club-accent">{counts.late}</b> late
              </span>
              <span>
                <b>{counts.excused}</b> excused
              </span>
              <span>
                <b className="text-club-bad">{counts.unexcused}</b> unexcused
              </span>
              <span className="muted">
                {rsvps.filter((r) => r.status === "attending").length} attending by RSVP
              </span>
            </div>

            {roster.length > 0 ? (
              <div className="border-t border-club-line/70 pt-2.5">
                <p className="stat-label mb-2">Roster RSVP Responses</p>
                <div className="flex flex-col gap-1.5">
                  {roster.map((athlete) => {
                    const status = rsvpOf.get(athlete.id);
                    return (
                      <div key={athlete.id} className="row-between gap-2 border-b border-club-line/40 pb-1 text-xs last:border-0 last:pb-0">
                        <Link href={`/athletes/${athlete.id}`} className="font-semibold hover:underline">
                          {athleteName(athlete)}
                          {athlete.jersey_number !== null ? <span className="muted"> #{athlete.jersey_number}</span> : null}
                        </Link>
                        <span className={`font-bold uppercase ${status === "attending" ? "text-club-good" : status === "not_attending" ? "text-club-bad" : "text-club-muted"}`}>
                          {status ? RSVP_LABEL[status] : "No response"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {isStaff && roster.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Attendance checklist</SectionTitle>
          <form action={saveAttendance} className="card card-body flex flex-col gap-3">
            <input type="hidden" name="event_id" value={event.id} />
            {roster.map((athlete) => (
              <AttendanceRow
                key={athlete.id}
                athlete={athlete}
                current={attendanceOf.get(athlete.id)}
              />
            ))}
            <button className="btn-primary">Save attendance</button>
          </form>
        </section>
      ) : null}

      {isStaff && roster.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Box score</SectionTitle>
          <p className="muted text-xs">
            Enter and save stats individually for each player. Leave all fields empty and save to clear a player&apos;s line.
          </p>
          <div className="flex flex-col gap-2">
            {roster.map((athlete) => (
              <PlayerBoxScoreForm
                key={athlete.id}
                eventId={event.id}
                athlete={athlete}
                line={lineOf.get(athlete.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isStaff ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Edit event</SectionTitle>
          <details className="card">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">
              Change details or cancel this event
            </summary>
            <div className="flex flex-col gap-4 border-t border-club-line p-4">
              <EventForm teams={teams} event={event} />
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={event.id} />
                <button className="btn-danger w-full">Delete this event</button>
              </form>
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function RsvpRow({ athlete, eventId, current }: { athlete: Athlete; eventId: string; current?: string }) {
  return (
    <div className="card card-body flex flex-col gap-2">
      <div className="row-between">
        <Link href={`/athletes/${athlete.id}`} className="font-bold hover:underline">
          {athleteName(athlete)}
          {athlete.jersey_number !== null ? <span className="muted"> #{athlete.jersey_number}</span> : null}
        </Link>
        <span className="text-xs text-club-muted">{current ? RSVP_LABEL[current] : "No RSVP"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {RSVP_STATUSES.map((status) => (
          <form key={status} action={setRsvp} className="flex-1">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="athlete_id" value={athlete.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              aria-pressed={current === status}
              className={`btn-sm w-full ${current === status ? "btn-primary" : "btn-ghost"}`}
            >
              {RSVP_LABEL[status]}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function AttendanceRow({ athlete, current }: { athlete: Athlete; current?: string }) {
  return (
    <fieldset className="border-b border-club-line pb-3 last:border-0 last:pb-0">
      <legend className="mb-1 text-sm font-bold">
        {athleteName(athlete)}
        {athlete.jersey_number !== null ? <span className="muted"> #{athlete.jersey_number}</span> : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {ATTENDANCE_STATUSES.map((status) => (
          <label
            key={status}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold capitalize ${
              current === status ? "border-club-accent bg-club-accent/15 text-club-accent" : "border-club-line bg-club-raised"
            }`}
          >
            <input
              type="radio"
              name={`att_${athlete.id}`}
              value={status}
              defaultChecked={current === status}
              className="accent-club-accent"
            />
            {status}
          </label>
        ))}
      </div>
      <input type="hidden" name="athlete_ids" value={athlete.id} />
    </fieldset>
  );
}

const BOX_INPUTS: { field: keyof BattingLine; label: string }[] = [
  { field: "pa", label: "PA" },
  { field: "ab", label: "AB" },
  { field: "singles", label: "1B" },
  { field: "doubles", label: "2B" },
  { field: "triples", label: "3B" },
  { field: "hr", label: "HR" },
  { field: "r", label: "R" },
  { field: "rbi", label: "RBI" },
  { field: "bb", label: "BB" },
  { field: "k", label: "K" },
  { field: "hbp", label: "HBP" },
  { field: "sf", label: "SF" },
];

const PITCH_INPUTS: { field: keyof BattingLine; label: string }[] = [
  { field: "pitch_count", label: "Pitches" },
  { field: "innings_pitched", label: "IP" },
  { field: "earned_runs", label: "ER" },
];

function PlayerBoxScoreForm({
  eventId,
  athlete,
  line,
}: {
  eventId: string;
  athlete: Athlete;
  line?: BattingLine;
}) {
  const value = (field: keyof BattingLine) => String(line?.[field] ?? 0);
  const hasLine = Boolean(line);

  return (
    <form action={savePlayerBoxScore} className="card card-body flex flex-col gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="athlete_id" value={athlete.id} />
      <input type="hidden" name={`name_${athlete.id}`} value={athleteName(athlete)} />
      <details className="group" open={hasLine}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-bold">
          <span>
            {athleteName(athlete)}
            {athlete.jersey_number !== null ? <span className="muted"> #{athlete.jersey_number}</span> : null}
          </span>
          <span className="muted text-xs font-normal">
            {hasLine ? `${line?.pa ?? 0} PA · ${hits(line!)} H` : "no stats entered"}
          </span>
        </summary>
        <div className="mt-2 flex flex-col gap-3 pt-2">
          <div className="grid grid-cols-4 gap-2">
            {[...BOX_INPUTS, ...PITCH_INPUTS].map(({ field, label }) => (
              <div key={field}>
                <label className="stat-label mb-1 block" htmlFor={`${field}-${athlete.id}`}>
                  {label}
                </label>
                <input
                  id={`${field}-${athlete.id}`}
                  name={`${field}_${athlete.id}`}
                  type="number"
                  min={0}
                  step={field === "innings_pitched" ? "0.1" : "1"}
                  inputMode={field === "innings_pitched" ? "decimal" : "numeric"}
                  defaultValue={hasLine ? value(field) : ""}
                  className="input px-2 text-center text-sm"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-club-muted">
              {hasLine ? "Save to update or clear fields to remove" : "Fill fields & save"}
            </span>
            <button className="btn-primary btn-sm">
              Save {athlete.first_name}
            </button>
          </div>
        </div>
      </details>
    </form>
  );
}
