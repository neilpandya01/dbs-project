"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "./supabase";

/** Where an aircraft really is right now (from the live tracker), for one flight. */
export type LivePos = {
  flightId: string;
  lat: number;
  lon: number;
  altFt: number | null;
  speedKt: number | null;
  trackDeg: number | null;
  seenAt: string | null;
};

type Row = { flight_id: string; stage: string; lat: number | null; lon: number | null; alt_ft: number | null; speed_kt: number | null; track_deg: number | null; seen_at: string | null };

const toPos = (r: Row): LivePos | null =>
  r.stage === "airborne" && r.lat != null && r.lon != null
    ? { flightId: r.flight_id, lat: r.lat, lon: r.lon, altFt: r.alt_ft, speedKt: r.speed_kt, trackDeg: r.track_deg, seenAt: r.seen_at }
    : null;

const HEARTBEAT_MS = 30_000;
const REFRESH_MS = 20_000; // a safety net in case a live update is missed

/**
 * Real positions of airborne flights, for you and your friends (the database only returns what you're allowed to see).
 * While `watching` is true and the tab is visible, this also tells the tracker you're looking, which is what makes
 * the tracker follow these flights. Positions arrive live (Supabase Realtime) and are re-read every 20 s as a backstop.
 */
export function useLivePositions(watching: boolean) {
  const supabase = useSupabase();
  const [byFlight, setByFlight] = useState<Record<string, LivePos>>({});

  useEffect(() => {
    if (!watching) return;
    let alive = true;

    const beat = () => { if (document.visibilityState === "visible") void supabase.rpc("live_heartbeat"); };
    const load = async () => {
      const { data } = await supabase.from("live_positions").select("*").eq("stage", "airborne");
      if (!alive || !data) return;
      const next: Record<string, LivePos> = {};
      for (const r of data as Row[]) { const p = toPos(r); if (p) next[p.flightId] = p; }
      setByFlight(next);
    };

    // Ask the server to look for friends' planes right now (they may already be in the air), then read the result.
    const refresh = async () => {
      try {
        const res = await fetch("/api/live/refresh", { method: "POST" });
        if (res.ok) console.debug("live tracking:", await res.json());
      } catch { /* the scheduled tracker will still fill positions in */ }
      if (alive) await load();
    };

    beat();
    void load();
    void refresh();
    const hb = setInterval(beat, HEARTBEAT_MS);
    const rf = setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") { beat(); void refresh(); } };
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel("live-positions")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_positions" }, (payload) => {
        if (!alive) return;
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { flight_id?: string }).flight_id;
          if (id) setByFlight((m) => { const { [id]: _gone, ...rest } = m; return rest; });
          return;
        }
        const r = payload.new as Row;
        const p = toPos(r);
        setByFlight((m) => {
          if (p) return { ...m, [r.flight_id]: p };
          const { [r.flight_id]: _gone, ...rest } = m; // landed or no longer airborne
          return rest;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      clearInterval(hb);
      clearInterval(rf);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, watching]);

  return byFlight;
}
