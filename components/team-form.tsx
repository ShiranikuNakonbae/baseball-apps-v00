import { saveTeam } from "@/app/actions/club";
import { Field } from "@/components/ui";
import { DIVISIONS } from "@/lib/types";
import type { Team } from "@/lib/types";

const divisionOptions = DIVISIONS.map((d) => ({ value: d, label: d }));

export function TeamForm({ team }: { team?: Team }) {
  return (
    <form action={saveTeam} className="flex flex-col gap-3">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <Field label="Team name" name="name" defaultValue={team?.name ?? ""} required placeholder="Thunder" />
      <Field
        label="Division"
        name="division"
        options={divisionOptions}
        defaultValue={team?.division ?? "minor"}
      />
      <Field label="Season" name="season" defaultValue={team?.season ?? "Spring 2026"} required />
      <button className="btn-primary">{team ? "Save team" : "Create team"}</button>
    </form>
  );
}
