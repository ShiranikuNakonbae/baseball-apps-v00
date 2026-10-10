export default function ScheduleLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading schedule">
      <div className="flex flex-col gap-1">
        <div className="skeleton h-7 w-40" />
        <div className="skeleton h-4 w-28" />
      </div>

      <section className="flex flex-col gap-2">
        <div className="skeleton h-4 w-24" />
        {[0, 1, 2].map((event) => (
          <div key={event} className="card card-body flex flex-col gap-2">
            <div className="row-between">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-3 w-14" />
            </div>
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3 w-56" />
          </div>
        ))}
      </section>
    </div>
  );
}
