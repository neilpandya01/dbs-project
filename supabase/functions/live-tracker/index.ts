// Live flight tracker. Supabase cron calls this about once a minute; each run does a stretch of work and returns.
//
//   1. Find who has the map open (live_watchers). Track their friends' flights, only.
//   2. Flights whose window is open (15 min before departure until an hour after arrival) are "waiting"
//      (checked every few minutes) until they're seen flying, then "airborne" (checked in a ~2 second
//      round-robin, one request to adsb.fi at a time) until seen on the ground near the destination, "landed".
//   3. Each result is written to live_positions; the map listens for those changes.
// With few flights each one is refreshed often; with many, the wait between refreshes grows on its own.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  T, callsignFor, flightTimes, inWindow, parseSightings, pickSighting, step,
  type Airport, type FlightRow, type Sighting, type State,
} from "../_shared/tracker.ts";

const ADSB = "https://opendata.adsb.fi/api/v2";
const RUN_MS = 50_000; // stay under the one-minute cron so runs don't overlap
const WATCH_FRESH_MS = 90_000; // a heartbeat this recent = "currently watching"
const BATCH = 20; // aircraft per request when we know their hex code or registration

type Item = {
  f: FlightRow;
  from: Airport;
  to: Airport;
  t: { dep: number; arr: number };
  state: State;
  polledAt: number;
  callsign: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });

  // Supabase gives edge functions the project URL and a server-side key automatically.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const startedAt = Date.now();
  const deadline = startedAt + RUN_MS;

  const { data: got } = await db.rpc("live_claim_run", { p_seconds: Math.ceil(RUN_MS / 1000) + 5 });
  if (!got) return Response.json({ skipped: "another run is still going" });

  // ---- 1. who is watching, and whose flights that covers -------------------------------------------
  const { data: watchers } = await db.from("live_watchers").select("user_id").gte("seen_at", iso(startedAt - WATCH_FRESH_MS)!);
  const watching = (watchers ?? []).map((w) => w.user_id as string);
  if (watching.length === 0) return Response.json({ watchers: 0 });

  const list = watching.join(",");
  const { data: ships } = await db.from("friendships").select("requester,addressee").eq("status", "accepted").or(`requester.in.(${list}),addressee.in.(${list})`);
  // the flights to follow are the watchers' friends' (the map shows friends in the air, not your own flight)
  const isWatcher = new Set(watching);
  const users = new Set<string>();
  for (const s of ships ?? []) {
    if (isWatcher.has(s.requester as string)) users.add(s.addressee as string);
    if (isWatcher.has(s.addressee as string)) users.add(s.requester as string);
  }
  if (users.size === 0) return Response.json({ watchers: watching.length, friendsWithFlights: 0 });

  // ---- 2. their flights that could be in the air around now ------------------------------------------
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const { data: rows } = await db
    .from("flights")
    .select("id,user_id,flown_on,dep_time,flight_number,registration,from_airport,to_airport,dep_at,arr_at")
    .in("user_id", [...users])
    .eq("hidden", false)
    .or("status.is.null,status.neq.cancelled")
    .gte("flown_on", day(startedAt - 86_400_000))
    .lte("flown_on", day(startedAt + 86_400_000));
  const flights = (rows ?? []) as FlightRow[];
  if (flights.length === 0) return Response.json({ watchers: watching.length, flights: 0 });

  const codes = [...new Set(flights.flatMap((f) => [f.from_airport, f.to_airport]))];
  const { data: aps } = await db.from("airports").select("code,lat,lon").in("code", codes);
  const airports = new Map((aps ?? []).map((a) => [a.code as string, { lat: a.lat as number, lon: a.lon as number }]));

  const { data: stored } = await db.from("live_positions").select("*").in("flight_id", flights.map((f) => f.id));
  const known = new Map((stored ?? []).map((r) => [r.flight_id as string, r]));

  const items: Item[] = [];
  for (const f of flights) {
    const from = airports.get(f.from_airport), to = airports.get(f.to_airport);
    const t = from && to ? flightTimes(f, from, to) : null;
    if (!from || !to || !t) continue;
    const r = known.get(f.id);
    const state: State = r
      ? { stage: r.stage, hex: r.hex, lat: r.lat, lon: r.lon, altFt: r.alt_ft, speedKt: r.speed_kt, trackDeg: r.track_deg, onGround: r.on_ground, takeoffAt: r.takeoff_at ? Date.parse(r.takeoff_at) : null, seenAt: r.seen_at ? Date.parse(r.seen_at) : null }
      : { stage: "waiting" };
    if (!inWindow(startedAt, t, state.stage)) continue;
    items.push({ f, from, to, t, state, polledAt: r?.polled_at ? Date.parse(r.polled_at) : 0, callsign: callsignFor(f.flight_number) });
  }

  // ---- 3. the round-robin ------------------------------------------------------------------------------
  let requests = 0, updated = 0, stopped: string | null = null;
  while (Date.now() < deadline) {
    const now = Date.now();
    const due = items
      .filter((i) => i.state.stage !== "landed" && (i.state.stage === "airborne" ? now - i.polledAt >= T.SPACING_MS : now - i.polledAt >= T.WAIT_EVERY_MS))
      .sort((a, b) => a.polledAt - b.polledAt);
    if (due.length === 0) {
      const live = items.some((i) => i.state.stage === "airborne");
      const nextWait = Math.min(...items.filter((i) => i.state.stage === "waiting").map((i) => i.polledAt + T.WAIT_EVERY_MS), Infinity);
      if (!live && nextWait > deadline) break; // nothing to do for the rest of this run
      await sleep(Math.min(1000, deadline - now));
      continue;
    }

    // one request per turn: the group that includes the item polled longest ago
    const first = due[0];
    let url: string, group: Item[], match: (s: Sighting, i: Item) => boolean;
    if (first.state.hex) {
      group = due.filter((i) => i.state.hex).slice(0, BATCH);
      url = `${ADSB}/hex/${group.map((i) => i.state.hex).join(",")}`;
      match = (s, i) => s.hex === i.state.hex;
    } else if (first.f.registration) {
      group = due.filter((i) => !i.state.hex && i.f.registration).slice(0, BATCH);
      url = `${ADSB}/registration/${group.map((i) => encodeURIComponent(i.f.registration!)).join(",")}`;
      match = (s, i) => s.reg === i.f.registration!.toUpperCase();
    } else if (first.callsign) {
      group = [first];
      url = `${ADSB}/callsign/${encodeURIComponent(first.callsign)}`;
      match = (s) => s.callsign === first.callsign;
    } else {
      first.polledAt = now + 365 * 86_400_000; // no way to find this aircraft: leave it alone
      continue;
    }

    const began = Date.now();
    let sightings: Sighting[] | null = null;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Wingmates-live-tracker" }, signal: AbortSignal.timeout(8000) });
      requests++;
      if (res.status === 429) { stopped = "adsb.fi rate limit"; break; }
      if (res.ok) sightings = parseSightings(await res.json());
    } catch { /* timeout or network error: try again next turn */ }

    for (const i of group) i.polledAt = Date.now();
    if (sightings) {
      const dirty = [];
      for (const i of group) {
        const mine = sightings.filter((s) => match(s, i));
        const before = i.state;
        i.state = step(before, pickSighting(mine, i.from, i.to, before), i.to, Date.now());
        dirty.push({
          flight_id: i.f.id, user_id: i.f.user_id, stage: i.state.stage, hex: i.state.hex ?? null,
          lat: i.state.lat ?? null, lon: i.state.lon ?? null, alt_ft: i.state.altFt ?? null,
          speed_kt: i.state.speedKt ?? null, track_deg: i.state.trackDeg ?? null, on_ground: !!i.state.onGround,
          takeoff_at: iso(i.state.takeoffAt), seen_at: iso(i.state.seenAt), polled_at: iso(i.polledAt), updated_at: iso(Date.now()),
        });
      }
      if (dirty.length) { await db.from("live_positions").upsert(dirty); updated += dirty.length; }
    }
    await sleep(T.SPACING_MS - (Date.now() - began));
  }

  // tidy: finished flights don't need to stay around
  await db.from("live_positions").delete().lt("updated_at", iso(startedAt - 2 * 86_400_000)!);

  return Response.json({ watchers: watching.length, tracked: items.length, requests, updated, stopped });
});
