import { createClient } from "@supabase/supabase-js";

/**
 * SERVER ONLY. A Supabase client with the service-role key, which bypasses row-level security.
 * Import it only from route handlers / server code, never from a "use client" file. (The key has no
 * NEXT_PUBLIC_ prefix, so it isn't even present in the browser bundle.)
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
