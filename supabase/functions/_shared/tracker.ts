// The live tracker's decisions, kept free of network and database code so they can be tested on their own.
// Runs in Deno (the Supabase edge function) and in Node (the tests).
import { AIRLINE_ICAO } from "./airlines.ts";

export type Stage = "waiting" | "airborne" | "landed";
export type Pt = { lat: number; lon: number };
export type Airport = Pt;

/** What adsb.fi reports for one aircraft, cleaned up. */
export type Sighting = {
  hex: string;
  callsign: string;
  reg?: string;
  lat: number;
  lon: number;
  /** feet; 0 when on the ground */
  altFt: number;
  onGround: boolean;
  speedKt?: number;
  trackDeg?: number;
  /** seconds since the position was last updated */
  ageS: number;
};

export type State = {
  stage: Stage;
  hex?: string | null;
  lat?: number | null;
  lon?: number | null;
  altFt?: number | null;
  speedKt?: number | null;
  trackDeg?: number | null;
  onGround?: boolean;
  takeoffAt?: number | null; // ms
  seenAt?: number | null; // ms
};

// ---- tuning --------------------------------------------------------------------------------------
export const T = {
  /** start looking this long before the scheduled departure */
  LEAD_MS: 15 * 60_000,
  /** keep looking this long after the scheduled arrival */
  TAIL_MS: 60 * 60_000,
  /** a flight still in the air is followed at most this long past its scheduled arrival */
  HARD_CAP_MS: 6 * 3_600_000,
  /** how often a waiting flight is checked */
  WAIT_EVERY_MS: 3 * 60_000,
  /** pause between requests to adsb.fi */
  SPACING_MS: 2000,
  /** ignore positions older than this */
  MAX_AGE_S: 120,
  /** landed = on the ground (or very low) within this many miles of the destination */
  LAND_RADIUS_MI: 15,
  LOW_FT: 1000,
  /** an airborne flight not heard from for this long is checked for "landed out of coverage" */
  SILENT_MS: 15 * 60_000,
  GIVE_UP_MS: 90 * 60_000,
};

// ---- geometry ------------------------------------------------------------------------------------
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function miles(a: Pt, b: Pt) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

export function bearing(a: Pt, b: Pt) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Is this position plausibly on the way from `from` to `to`, and heading that way? */
export function onRoute(p: Pt, from: Airport, to: Airport, trackDeg?: number) {
  const D = miles(from, to), d1 = miles(from, p), d2 = miles(p, to);
  if (d1 + d2 > D * 1.25 + 40) return false; // wandered off the line between the airports
  if (d2 > D + 25) return false; // behind the origin: most likely the aircraft's previous flight arriving
  if (trackDeg != null && d1 > 15 && d2 > 30 && angleDiff(trackDeg, bearing(p, to)) > 75) return false; // heading away
  return true;
}

// ---- flights -------------------------------------------------------------------------------------
export type FlightRow = {
  id: string;
  user_id: string;
  flown_on: string; // YYYY-MM-DD
  dep_time: string | null; // "7:45 AM", the clock at the origin
  flight_number: string | null;
  registration: string | null;
  from_airport: string;
  to_airport: string;
  dep_at: string | null;
  arr_at: string | null;
};

/** "7:45 AM" -> minutes after midnight, or null. */
function clockMinutes(t: string | null) {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t ?? "");
  if (!m) return null;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2]);
}

/**
 * Departure and arrival moments in ms. Looked-up flights have exact ones. Typed-in flights only have the
 * clock at the origin, so the offset from UTC is estimated from longitude (15 degrees per hour), which is
 * close enough for deciding when to start looking. Flights with no departure time can't be tracked.
 */
export function flightTimes(f: FlightRow, from: Airport, to: Airport): { dep: number; arr: number } | null {
  if (f.dep_at && f.arr_at) {
    const dep = Date.parse(f.dep_at), arr = Date.parse(f.arr_at);
    if (!Number.isNaN(dep) && !Number.isNaN(arr)) return { dep, arr };
  }
  const mins = clockMinutes(f.dep_time);
  if (mins == null) return null;
  const offsetH = Math.round(from.lon / 15);
  const dep = Date.parse(`${f.flown_on}T00:00:00Z`) + mins * 60_000 - offsetH * 3_600_000;
  return { dep, arr: dep + (miles(from, to) / 480 + 0.5) * 3_600_000 };
}

/** Is this flight worth looking at right now? Airborne flights are followed until they land. */
export function inWindow(now: number, t: { dep: number; arr: number }, stage: Stage) {
  if (stage === "landed") return false;
  if (now < t.dep - T.LEAD_MS) return false;
  return now <= t.arr + (stage === "airborne" ? T.HARD_CAP_MS : T.TAIL_MS);
}

/** "UA 2679" -> "UAL2679". Null when the airline isn't known. */
export function callsignFor(number: string | null) {
  const m = /^([A-Z0-9]{2})\s*(\d{1,4})[A-Z]?$/.exec((number ?? "").toUpperCase().trim());
  const icao = m && AIRLINE_ICAO[m[1]];
  return m && icao ? `${icao}${m[2]}` : null;
}

// ---- adsb.fi -------------------------------------------------------------------------------------
type Raw = { hex?: string; flight?: string; r?: string; lat?: number; lon?: number; alt_baro?: number | "ground"; gs?: number; track?: number; seen_pos?: number };

export function parseSightings(json: unknown): Sighting[] {
  const list = (json as { ac?: Raw[]; aircraft?: Raw[] } | null)?.ac ?? (json as { aircraft?: Raw[] } | null)?.aircraft ?? [];
  const out: Sighting[] = [];
  for (const a of list) {
    if (!a.hex || typeof a.lat !== "number" || typeof a.lon !== "number") continue;
    const onGround = a.alt_baro === "ground";
    out.push({
      hex: a.hex.toLowerCase(),
      callsign: (a.flight ?? "").trim().toUpperCase(),
      reg: a.r?.toUpperCase(),
      lat: a.lat,
      lon: a.lon,
      altFt: onGround ? 0 : typeof a.alt_baro === "number" ? Math.round(a.alt_baro) : 0,
      onGround,
      speedKt: typeof a.gs === "number" ? Math.round(a.gs) : undefined,
      trackDeg: typeof a.track === "number" ? Math.round(a.track) : undefined,
      ageS: typeof a.seen_pos === "number" ? a.seen_pos : 0,
    });
  }
  return out;
}

/**
 * Of the aircraft returned for a flight, the one that fits it (route, then closeness to the origin).
 * An aircraft flying under exactly this flight's callsign is trusted wherever it is: callsigns belong to
 * a flight, so there's no need to check the route. Registrations and hex codes belong to the aircraft,
 * which may be on another flight, so those still have to be on the route.
 */
export function pickSighting(list: Sighting[], from: Airport, to: Airport, state: State, trustCallsign?: string | null): Sighting | null {
  const fresh = list.filter((s) => s.ageS <= T.MAX_AGE_S);
  const fits = fresh.filter((s) => (trustCallsign && s.callsign === trustCallsign) || (s.onGround ? miles(s, from) < 30 || miles(s, to) < 30 : onRoute(s, from, to, s.trackDeg)));
  const pool = state.stage === "waiting" || !state.hex ? fits : fits.filter((s) => s.hex === state.hex);
  return pool.sort((a, b) => miles(a, from) - miles(b, from))[0] ?? null;
}

// ---- the stage machine ---------------------------------------------------------------------------
/**
 * One step: given what we knew and what we just saw (or null if the aircraft wasn't found), return the new state.
 *   waiting  -> airborne: seen flying (not on the ground, above 1,000 ft or moving fast) on the route
 *   airborne -> landed:   on the ground or very low, near the destination
 *                         or unheard from for a while after last being low and near the destination
 */
export function step(prev: State, s: Sighting | null, to: Airport, now: number): State {
  if (prev.stage === "landed") return prev;

  if (s) {
    const next: State = { ...prev, hex: s.hex, lat: s.lat, lon: s.lon, altFt: s.altFt, speedKt: s.speedKt ?? null, trackDeg: s.trackDeg ?? null, onGround: s.onGround, seenAt: now - s.ageS * 1000 };
    const nearDest = miles(s, to) <= T.LAND_RADIUS_MI;
    if (prev.stage === "waiting") {
      const flying = !s.onGround && (s.altFt >= T.LOW_FT || (s.speedKt ?? 0) >= 120);
      return flying ? { ...next, stage: "airborne", takeoffAt: now - s.ageS * 1000 } : next;
    }
    if ((s.onGround || s.altFt <= T.LOW_FT) && nearDest) return { ...next, stage: "landed" };
    return next;
  }

  // not found
  if (prev.stage === "airborne" && prev.seenAt != null) {
    const silent = now - prev.seenAt;
    const lastNearDest = prev.lat != null && prev.lon != null && miles({ lat: prev.lat, lon: prev.lon }, to) <= 40 && (prev.altFt ?? 99999) < 12000;
    if (silent >= T.GIVE_UP_MS || (silent >= T.SILENT_MS && lastNearDest)) return { ...prev, stage: "landed" };
  }
  return prev;
}
