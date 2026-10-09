import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import type { Profile } from "@/lib/types";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-club-line bg-club-bg/95 px-4 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
        <span aria-hidden className="text-club-accent">
          ⚾
        </span>
        LABS
      </Link>
      {profile ? (
        <div className="flex items-center gap-2">
          <span className="muted hidden sm:inline">{profile.full_name}</span>
          <form action={signOut}>
            <button className="btn-ghost btn-sm" aria-label="Sign out">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
