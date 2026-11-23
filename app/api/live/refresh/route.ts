import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { T, callsignFor, flightTimes, parseSightings, pickSighting, step, type FlightRow, type State } from "../../../../supabase/functions/_shared/tracker.ts";

/**
 * "Where is my friends' plane right now?", answered on the spot. The Map calls this when it opens, so a friend
 * who is already in the air shows at their real position straight away instead of waiting for the next
 * scheduled tracker run. For each friend flight that could be in the air, it asks adsb.fi once (by hex code, then
 * registration, then callsign) and, if the aircraft is flying, saves its position where the Map reads it.
 * Hidden and cancelled flights are never looked at. Returns a short note per flight so a miss can be explained.
 */
const ADSB = "https://opendata.adsb.fi/api/v2";
const MAX_FLIGHTS = 8;
const RECENT_MS = 15_000; // don't ask again about a flight asked about this recently
const AFTER_ARRIVAL_MS = 6 * 3_600_000;

type Note = { flight: string; result: string };

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const db = supabaseAdmin();
  const now = Date.now();

  const { data: ships } = await db.from("friendships").select("requester,addressee").eq("status", "accepted").or(`requester.eq.${userId},addressee.eq.${userId}`);
  const friends = (ships ?? []).map((s) => (s.requester === userId ? s.addressee : s.requester) as string);
  if (friends.length === 0) return NextResponse.json({ checked: 0, notes: [] });

  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const { data: rows } = await db
    .from("flights")
    .select("id,user_id,flown_on,dep_time,flight_number,registration,from_airport,to_airport,dep_at,arr_at")
    .in("user_id", friends)
    .eq("hidden", false)
    .or("status.is.null,status.neq.cancelled")
    .gte("flown_on", day(now - 86_400_000))
    .lte("flown_on", day(now + 86_400_000));
  const flights = (rows ?? []) as FlightRow[];
  if (flights.length === 0) return NextResponse.json({ checked: 0, notes: [] });

  const codes = [...new Set(flights.flatMap((f) => [f.from_airport, f.to_airport]))];
  const { data: aps } = await db.from("airports").select("code,lat,lon").in("code", codes);
  const airports = new Map((aps ?? []).map((a) => [a.code as string, { lat: a.lat as number, lon: a.lon as number }]));
  const { data: stored } = await db.from("live_positions").select("*").in("flight_id", flights.map((f) => f.id));
  const known = new Map((stored ?? []).map((r) => [r.flight_id as string, r]));

  const notes: Note[] = [];
  let checked = 0;
  for (const f of flights) {
    if (checked >= MAX_FLIGHTS) break;
    const label = f.flight_number ?? `${f.from_airport}-${f.to_airport}`;
    const from = airports.get(f.from_airport), to = airports.get(f.to_airport);
    if (!from || !to) continue;

    // could it be in the air now? Use its times when it has them; with none, any flight dated today qualifies.
    const t = flightTimes(f, from, to);
    if (t && (now < t.dep - T.LEAD_MS || now > t.arr + AFTER_ARRIVAL_MS)) { notes.push({ flight: label, result: "outside its flying window" }); continue; }

    const r = known.get(f.id);
    if (r?.stage === "landed") { notes.push({ flight: label, result: "already landed" }); continue; }
    if (r?.polled_at && now - Date.parse(r.polled_at) < RECENT_MS) { notes.push({ flight: label, result: "checked a moment ago" }); continue; }

    const callsign = callsignFor(f.flight_number);
    const hex = r?.hex as string | undefined;
    const reg = f.registration?.toUpperCase();
    const url = hex ? `${ADSB}/hex/${hex}` : reg ? `${ADSB}/registration/${encodeURIComponent(reg)}` : callsign ? `${ADSB}/callsign/${encodeURIComponent(callsign)}` : null;
    if (!url) { notes.push({ flight: label, result: "no registration and unknown airline code: can't find the aircraft" }); continue; }

    if (checked > 0) await new Promise((res) => setTimeout(res, 1100)); // adsb.fi allows about one request a second
    checked++;
    let res: Response;
    try { res = await fetch(url, { headers: { "User-Agent": "Wingmates-live-tracker" }, signal: AbortSignal.timeout(8000) }); }
    catch { notes.push({ flight: label, result: "adsb.fi didn't answer" }); continue; }
    if (!res.ok) { notes.push({ flight: label, result: `adsb.fi said ${res.status}` }); continue; }

    const sightings = parseSightings(await res.json());
    const before: State = r
      ? { stage: r.stage, hex: r.hex, lat: r.lat, lon: r.lon, altFt: r.alt_ft, speedKt: r.speed_kt, trackDeg: r.track_deg, onGround: r.on_ground, takeoffAt: r.takeoff_at ? Date.parse(r.takeoff_at) : null, seenAt: r.seen_at ? Date.parse(r.seen_at) : null }
      : { stage: "waiting" };
    const hit = pickSighting(sightings, from, to, before, callsign);
    const after = step(before, hit, to, Date.now());
    await db.from("live_positions").upsert({
      flight_id: f.id, user_id: f.user_id, stage: after.stage, hex: after.hex ?? null, lat: after.lat ?? null, lon: after.lon ?? null,
      alt_ft: after.altFt ?? null, speed_kt: after.speedKt ?? null, track_deg: after.trackDeg ?? null, on_ground: !!after.onGround,
      takeoff_at: after.takeoffAt ? new Date(after.takeoffAt).toISOString() : null, seen_at: after.seenAt ? new Date(after.seenAt).toISOString() : null,
      polled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    notes.push({
      flight: label,
      result: !sightings.length ? "adsb.fi has no aircraft under that identifier right now"
        : !hit ? "found an aircraft, but it didn't match this flight (stale, or not on its route)"
        : after.stage === "airborne" ? "in the air: position saved"
        : after.stage === "landed" ? "landed"
        : "found on the ground, not flying yet",
    });
  }
  return NextResponse.json({ checked, notes });
}
