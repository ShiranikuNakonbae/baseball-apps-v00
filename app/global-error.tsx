"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#71717a", marginBottom: "1.5rem" }}>The app failed to start. Try again.</p>
        <button onClick={reset} style={{ padding: "0.75rem 1.25rem", borderRadius: "0.5rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
