import { AthleteCard } from "@/components/athlete-card";
import { EmptyState, ErrorBanner } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { getAttendanceStats, getAthletesForParent, getSeasonStats } from "@/lib/data";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { error } = await searchParams;

  const athletes = await getAthletesForParent(profile.id);
  const ids = athletes.map((a) => a.id);
  const [season, attendance] = await Promise.all([getSeasonStats(ids), getAttendanceStats(ids)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">My family</h1>
      <ErrorBanner message={error} />

      {athletes.length === 0 ? (
        <EmptyState>
          No athlete is linked to your account yet. A club admin links parents to athletes — sign up first, then ask
          them to add your child.
        </EmptyState>
      ) : (
        athletes.map((athlete) => (
          <section key={athlete.id} className="flex flex-col gap-3">
            <AthleteCard
              athlete={athlete}
              season={season.get(athlete.id)}
              attendance={attendance.get(athlete.id)}
            />
          </section>
        ))
      )}
    </div>
  );
}
