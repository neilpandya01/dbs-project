"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSupabase } from "./supabase";
import { BUCKET, isImagePath } from "./threads";

// Photos are private, so each one is shown through a signed link that Supabase only hands out if the signed-in person is
// allowed to see the thread or comment it belongs to. Links last an hour; we reuse them until just before they expire.
const LINK_SECONDS = 3600;
const cache = new Map<string, { url: string; expires: number }>();
let cacheOwner: unknown = null;

/** Signed links for some photo paths: { urls } fills in as they arrive; call `retry(path)` if a photo fails to load (once). */
export function useImageUrls(paths: string[]) {
  const supabase = useSupabase();
  const [, redraw] = useState(0);
  const retried = useRef(new Set<string>());
  const key = paths.join("|");

  // never reuse another sign-in's links
  if (cacheOwner !== supabase) { cache.clear(); cacheOwner = supabase; }

  const load = useCallback(async (force: string[] | null) => {
    const now = Date.now();
    const need = (force ?? paths).filter((p) => isImagePath(p) && (force !== null || !((cache.get(p)?.expires ?? 0) > now)));
    if (need.length === 0) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(need, LINK_SECONDS);
    for (const r of data ?? []) {
      if (r.path && r.signedUrl && !r.error) cache.set(r.path, { url: r.signedUrl, expires: now + (LINK_SECONDS - 300) * 1000 });
    }
    redraw((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase]);

  useEffect(() => { void load(null); }, [load]);

  const urls: Record<string, string> = {};
  for (const p of paths) {
    const hit = cache.get(p);
    if (hit && hit.expires > Date.now()) urls[p] = hit.url;
  }
  const retry = (path: string) => {
    if (retried.current.has(path)) return;
    retried.current.add(path);
    void load([path]);
  };
  return { urls, retry };
}
