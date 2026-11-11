"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo, useRef } from "react";

/**
 * A Supabase client that acts as the signed-in user: every request carries Clerk's session token,
 * which Supabase trusts (Third-Party Auth). Row-level security then sees `auth.jwt()->>'sub'` = the Clerk user id.
 * The client is created once per sign-in, so effects that depend on it don't re-run needlessly.
 */
export function useSupabase() {
  const { session } = useSession();
  const latest = useRef(session);
  latest.current = session;
  const sessionId = session?.id ?? null;
  return useMemo(
    () =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        accessToken: async () => (await latest.current?.getToken()) ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId]
  );
}
