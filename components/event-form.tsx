import { saveEvent } from "@/app/actions/club";
import { Field } from "@/components/ui";
import { toDateTimeLocal } from "@/lib/format";
import { EVENT_TYPES } from "@/lib/types";
import type { ClubEvent, Team } from "@/lib/types";

const teamOptions = (teams: Team[], isEdit: boolean) => {
  const sorted = [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ value: t.id, label: `${t.name} (${t.division})` }));
  if (!isEdit && teams.length > 1) {
    return [{ value: "all", label: "All teams (creates for all teams)" }, ...sorted];
  }
  return sorted;
};

/**
 * Create or edit an event. Coaches enter a club wall clock; the action converts it
 * to an absolute instant, so the input stays free of any timezone suffix.
 */
export function EventForm({ teams, event }: { teams: Team[]; event?: ClubEvent }) {
  const isEdit = Boolean(event);
  return (
    <form action={saveEvent} className="flex flex-col gap-3">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <Field
        label="Team"
        name="team_id"
        options={teamOptions(teams, isEdit)}
        defaultValue={event?.team_id ?? (teams.length > 1 ? "all" : teams[0]?.id)}
      />
      <Field label="Title" name="title" defaultValue={event?.title ?? ""} required placeholder="Game vs Tigers" />
      <Field
        label="Type"
        name="type"
        options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
        defaultValue={event?.type ?? "practice"}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Starts"
          name="start_time"
          type="datetime-local"
          defaultValue={event ? toDateTimeLocal(event.start_time) : ""}
          required
        />
        <Field
          label="Ends"
          name="end_time"
          type="datetime-local"
          defaultValue={event ? toDateTimeLocal(event.end_time) : ""}
          required
        />
      </div>
      {!isEdit ? (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-club-line/70 bg-club-raised/40 p-2.5">
          <Field
            label="Schedule type"
            name="recurrence"
            options={[
              { value: "none", label: "One-time event" },
              { value: "weekly", label: "Weekly recurring" },
            ]}
            defaultValue="none"
          />
          <Field
            label="Repeat for"
            name="recurrence_weeks"
            options={[
              { value: "4", label: "4 weeks" },
              { value: "6", label: "6 weeks" },
              { value: "8", label: "8 weeks" },
              { value: "10", label: "10 weeks" },
              { value: "12", label: "12 weeks" },
            ]}
            defaultValue="4"
          />
        </div>
      ) : null}
      <Field label="Location" name="location_name" defaultValue={event?.location_name ?? ""} required placeholder="Field #3 - Oak Park" />
      <Field
        label="Map link"
        name="location_url"
        type="url"
        defaultValue={event?.location_url ?? ""}
        placeholder="https://maps.google.com/?q=..."
      />
      <div>
        <label className="label" htmlFor="f-notes">
          Notes
        </label>
        <textarea className="input min-h-20 py-2" id="f-notes" name="notes" defaultValue={event?.notes ?? ""} rows={3} />
      </div>
      <button className="btn-primary">{event ? "Save changes" : "Create event"}</button>
    </form>
  );
}
