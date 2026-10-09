"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";

import { sendMagicLink, signIn, signUp, type FormState } from "@/app/actions/auth";

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-club-bad/50 bg-club-bad/10 px-3 py-2 text-sm">
        {state.error}
      </p>
    );
  if (state.message)
    return <p className="rounded-lg border border-club-good/50 bg-club-good/10 px-3 py-2 text-sm">{state.message}</p>;
  return null;
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<"in" | "up">("in");

  const [signInState, signInAction, signingIn] = useActionState(signIn, null);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, null);
  const [linkState, linkAction, sendingLink] = useActionState(sendMagicLink, null);

  const busy = signingIn || signingUp || sendingLink;

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-6">
        <h1 className="text-2xl font-bold">Club Baseball</h1>
        <p className="muted">Schedules, attendance and player stats in one place.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-club-line bg-club-surface p-1">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-md text-sm font-semibold ${
              mode === m ? "bg-club-accent text-club-bg" : "text-club-muted"
            }`}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {mode === "in" ? (
        <form action={signInAction} className="card card-body flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button className="btn-primary" disabled={busy}>
            Sign in
          </button>
          <Message state={signInState} />
        </form>
      ) : (
        <form action={signUpAction} className="card card-body flex flex-col gap-3">
          <label className="label" htmlFor="full_name">
            Your name
          </label>
          <input className="input" id="full_name" name="full_name" autoComplete="name" required />
          <label className="label" htmlFor="up-email">
            Email
          </label>
          <input className="input" id="up-email" name="email" type="email" autoComplete="email" required />
          <label className="label" htmlFor="up-password">
            Password
          </label>
          <input
            className="input"
            id="up-password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <p className="muted">New accounts start as a parent. A club admin links your athlete and sets roles.</p>
          <button className="btn-primary" disabled={busy}>
            Create account
          </button>
          <Message state={signUpState} />
        </form>
      )}

      <form action={linkAction} className="card card-body flex flex-col gap-3">
        <label className="label" htmlFor="link-email">
          Or use a sign-in link
        </label>
        <div className="flex gap-2">
          <input className="input" id="link-email" name="email" type="email" autoComplete="email" required />
          <button className="btn-ghost shrink-0" disabled={busy}>
            Send link
          </button>
        </div>
        <Message state={linkState} />
      </form>

      {params.get("error") ? (
        <p role="alert" className="rounded-lg border border-club-bad/50 bg-club-bad/10 px-3 py-2 text-sm">
          {params.get("error")}
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 pt-6">
          <header>
            <h1 className="text-2xl font-bold">Club Baseball</h1>
            <p className="muted">Loading...</p>
          </header>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
