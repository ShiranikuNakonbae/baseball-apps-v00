"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | null;

function siteUrl() {
  // Same contract as the Supabase vars: fail loudly rather than sending magic
  // links to localhost in production.
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return url;
}

function value(form: FormData, name: string) {
  const raw = form.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = value(form, "email").toLowerCase();
  const password = value(form, "password");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Those credentials were not accepted." };

  revalidatePath("/", "layout");
  redirect(value(form, "next") || "/");
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const email = value(form, "email").toLowerCase();
  const password = value(form, "password");
  const fullName = value(form, "full_name");
  if (!email || !password || !fullName) return { error: "Name, email and password are required." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: "Could not create that account. Try another email." };

  // With email confirmation on, Supabase returns no session until the link is used.
  if (!data.session) return { error: "Check your inbox and confirm your email, then sign in." };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function sendMagicLink(_prev: FormState, form: FormData): Promise<FormState> {
  const email = value(form, "email").toLowerCase();
  if (!email) return { error: "Enter your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) return { error: "Could not send that link right now." };

  return { message: "Link sent. Open it on this device to finish signing in." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
