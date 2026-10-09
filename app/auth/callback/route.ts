import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Magic-link / OAuth landing: swaps the one-time code for a session cookie. */
export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const params = new URL(request.url).searchParams;

  const problem = params.get("error_description") ?? params.get("error");
  const code = params.get("code");
  if (problem || !code) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(problem ?? "That sign-in link is no longer valid.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent("That sign-in link is no longer valid.")}`,
    );
  }

  return NextResponse.redirect(`${base}/`);
}
