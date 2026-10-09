import type { Metadata, Viewport } from "next";

import { NavTabs } from "@/components/nav-tabs";
import { SiteHeader } from "@/components/site-header";
import { getProfile } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Club Baseball",
  description: "Scheduling, attendance, and player stats for baseball clubs.",
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
          <SiteHeader profile={profile} />
          <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
          {profile ? <NavTabs role={profile.role} /> : null}
        </div>
      </body>
    </html>
  );
}
