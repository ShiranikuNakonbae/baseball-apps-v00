import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/**
 * Current user's profile, memoised per request so a layout + page + action chain
 * only pays one round trip. Falls back to creating the row if the auth trigger
 * did not fire (or was never installed), always as `parent`.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const existing = await supabase
    .from("profiles")
    .select("id, email, full_name, phone_number, role")
    .eq("id", user.id)
    .maybeSingle();
  if (existing.data) return existing.data as Profile;

  const inserted = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email,
    full_name: (user.user_metadata?.full_name as string) || user.email.split("@")[0],
    role: "parent",
  });
  if (inserted.error) {
    const retry = await supabase
      .from("profiles")
      .select("id, email, full_name, phone_number, role")
      .eq("id", user.id)
      .maybeSingle();
    return (retry.data as Profile) ?? null;
  }

  const created = await supabase
    .from("profiles")
    .select("id, email, full_name, phone_number, role")
    .eq("id", user.id)
    .maybeSingle();
  return (created.data as Profile) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Redirects unless the caller holds one of these roles. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}
