import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function supabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

/**
 * Request-scoped client. All reads and writes go through PostgREST with the
 * caller's JWT, so Supabase Row Level Security is the actual authorization layer.
 */
export async function createClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (next) => {
        // Server components cannot set cookies, so a refresh during a render is a
        // no-op; proxy.ts and actions/route handlers do the writing.
        try {
          for (const { name, value, options } of next) store.set(name, value, options);
        } catch {}
      },
    },
  });
}
