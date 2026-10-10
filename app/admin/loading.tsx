export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading club management">
      <div className="flex flex-col gap-1">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-32" />
      </div>

      {[0, 1].map((team) => (
        <section key={team} className="flex flex-col gap-2">
          <div className="skeleton h-4 w-16" />
          <div className="card card-body flex flex-col gap-3">
            <div className="row-between">
              <div className="flex flex-col gap-1">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-40" />
              </div>
              <div className="skeleton h-3 w-12" />
            </div>
            <div className="skeleton h-3 w-24" />
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <div className="skeleton h-4 w-36" />
        <div className="card card-body flex flex-col gap-2">
          <div className="skeleton h-9 w-full" />
          <div className="skeleton h-9 w-full" />
        </div>
      </section>
    </div>
  );
}
