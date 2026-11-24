"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "./supabase";

/** Where an aircraft really is right now (from the live tracker), for one flight. */
export type LivePos = {
  flightId: string;
  stage: "waiting" | "airborne" | "landed";
  onGround: boolean;
  lat: number;
  lon: number;
  altFt: number | null;
  speedKt: number | null;
  trackDeg: number | null;
  seenAt: string | null;
};

type Row = { flight_id: string; stage: string; on_ground: boolean | null; lat: number | null; lon: number | null; alt_ft: number | null; speed_kt: number | null; track_deg: number | null; seen_at: string | null };

const toPos = (r: Row): LivePos | null =>
  (r.stage === "airborne" || r.stage === "waiting" || r.stage === "landed") && r.lat != null && r.lon != null
    ? { flightId: r.flight_id, stage: r.stage, onGround: !!r.on_ground, lat: r.lat, lon: r.lon, altFt: r.alt_ft, speedKt: r.speed_kt, trackDeg: r.track_deg, seenAt: r.seen_at }
    : null;

const HEARTBEAT_MS = 30_000;
const REFRESH_MS = 15_000; // while the map is open: ask the server to re-check the planes, then re-read
const READ_MS = 2_000; // re-read saved positions this often (just a database read; the tracker may have written new ones)

/**
 * Real positions of airborne flights, for you and your friends (the database only returns what you're allowed to see).
 * While `watching` is true and the tab is visible, this also tells the tracker you're looking, which is what makes
 * the tracker follow these flights. Positions arrive live (Supabase Realtime) and are also re-read every 3 s, and every 15 s the server is also asked to
 * re-check the planes directly, so the map keeps moving while you sit on it even if the scheduled tracker is slow.
 */
export function useLivePositions(watching: boolean) {
  const supabase = useSupabase();
  const [byFlight, setByFlight] = useState<Record<string, LivePos>>({});
  /** true when the live data source isn't answering, so the page can say so instead of silently showing estimates */
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (!watching) return;
    let alive = true;

    // A Supabase request only goes out once something waits for it (.then): `void supabase.rpc(...)` sends nothing.
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      supabase.rpc("live_heartbeat").then(({ error }) => { if (error) console.debug("live heartbeat failed:", error.message); });
    };
    const load = async () => {
      const { data } = await supabase.from("live_positions").select("*");
      if (!alive || !data) return;
      const next: Record<string, LivePos> = {};
      for (const r of data as Row[]) { const p = toPos(r); if (p) next[p.flightId] = p; }
      setByFlight(next);
    };

    // Ask the server to look for friends' planes right now (they may already be in the air), then read the result.
    const refresh = async () => {
      try {
        const res = await fetch("/api/live/refresh", { method: "POST" });
        if (res.ok) {
          const r = (await res.json()) as { provider?: "ok" | "down" | "unknown" };
          console.debug("live tracking:", r);
          if (alive && r.provider && r.provider !== "unknown") setDown(r.provider === "down");
        } else if (res.status !== 429 && alive) setDown(true); // 429 = refreshed a moment ago, nothing wrong. Otherwise our own server failed: live positions can't load either
      } catch { if (alive) setDown(true); }
      if (alive) await load();
    };

    beat();
    void load();
    void refresh();
    const hb = setInterval(beat, HEARTBEAT_MS);
    const rd = setInterval(() => { if (document.visibilityState === "visible") void load(); }, READ_MS);
    const rf = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, REFRESH_MS);
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
          const { [r.flight_id]: _gone, ...rest } = m; // no usable position
          return rest;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      clearInterval(hb);
      clearInterval(rf);
      clearInterval(rd);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, watching]);

  return { positions: byFlight, down };
}
