export default function RosterLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading roster">
      <h1 className="text-2xl font-bold">Roster</h1>

      <section className="flex flex-col gap-2">
        <div className="skeleton h-4 w-32" />
        <div className="card">
          <div className="skeleton min-h-11 w-full" />
        </div>
      </section>

      {[0, 1].map((team) => (
        <section key={team} className="flex flex-col gap-2">
          <div className="skeleton h-5 w-64" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="card card-body flex flex-col gap-1">
                <div className="row-between">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-3 w-36" />
                <div className="skeleton h-3 w-56" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
