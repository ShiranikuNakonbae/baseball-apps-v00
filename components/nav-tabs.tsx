"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/types";

const TABS: Record<Role, { href: string; label: string }[]> = {
  parent: [
    { href: "/", label: "Schedule" },
    { href: "/family", label: "Family" },
  ],
  coach: [
    { href: "/", label: "Schedule" },
    { href: "/roster", label: "Roster" },
  ],
  admin: [
    { href: "/", label: "Schedule" },
    { href: "/roster", label: "Roster" },
    { href: "/admin", label: "Club" },
  ],
};

export function NavTabs({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-lg gap-1 border-t border-club-line bg-club-surface/95 px-2 py-2 backdrop-blur"
    >
      {TABS[role].map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${
              active ? "bg-club-accent/15 text-club-accent" : "text-club-muted"
            } flex items-center justify-center`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
