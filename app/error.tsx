"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card card-body flex flex-col items-center gap-3 py-10 text-center">
      <h1 className="text-lg font-bold">Something went wrong</h1>
      <p className="muted">The page failed to load. Your data is safe — try again.</p>
      <button className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
