import { flightHours, type Flight } from "./core";

/**
 * A flight plus resolved departure/arrival instants (null when the clock time isn't known), and the times
 * as text, always as the clock at that airport: `depText` where it leaves, `arrText` where it lands.
 */
export type Leg = Flight & { dep: Date | null; arr: Date | null; depText?: string; arrText?: string; nextDay?: boolean };
export type Trip = Leg[];

const HOUR = 3_600_000;
export const LAYOVER_HOURS = 6;

function parseTime(t: string): [number, number] | null {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return [h, Number(m[2])];
}

/** A moment as the clock at a place ("7:55 AM"), or undefined if the zone isn't usable. */
function clockIn(d: Date, tz: string) {
  try { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }); } catch { return undefined; }
}
const dayIn = (d: Date, tz: string) => d.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

/**
 * Resolves a flight's times.
 *  - From the lookup we know the exact moments and both airports' time zones, so the times are exact and each
 *    is shown as the local clock where it happens (and "+1" when it lands the next day there).
 *  - Typed-in flights only have clock times that are already local to their airport, so those are shown as
 *    typed. Their moments are approximate (the departure clock is read in the viewer's zone, arrival is
 *    estimated), which is only used for ordering and "in the air" checks. We don't show an estimated arrival.
 */
export function toLeg(f: Flight): Leg {
  if (f.depAt && f.arrAt && f.depTz && f.arrTz) {
    const dep = new Date(f.depAt), arr = new Date(f.arrAt);
    const depText = clockIn(dep, f.depTz), arrText = clockIn(arr, f.arrTz);
    if (!Number.isNaN(dep.getTime()) && !Number.isNaN(arr.getTime()) && depText && arrText) {
      return { ...f, dep, arr, depText, arrText, nextDay: dayIn(arr, f.arrTz) > dayIn(dep, f.depTz) };
    }
  }
  const hm = f.time ? parseTime(f.time) : null;
  if (!hm) return { ...f, dep: null, arr: null, arrText: f.arrTime };
  const dep = new Date(f.date + "T00:00:00");
  dep.setHours(hm[0], hm[1], 0, 0);
  return { ...f, dep, arr: new Date(dep.getTime() + flightHours(f) * HOUR), depText: f.time, arrText: f.arrTime };
}

// For ordering and "is it soon" checks, a flight with no known time is treated as leaving at noon.
const noon = (l: Leg) => new Date(l.date + "T12:00:00");
export const depOf = (l: Leg) => l.dep ?? noon(l);
export const arrOf = (l: Leg) => l.arr ?? new Date(depOf(l).getTime() + flightHours(l) * HOUR);

/**
 * Trips are only ever logged as individual flights. Two flights are treated as one trip
 * (a layover) when the second leaves within LAYOVER_HOURS of the first one landing.
 * That needs both clock times, so flights without a known time are never joined.
 */
export function groupTrips(legs: Leg[]): Trip[] {
  const sorted = [...legs].sort((a, b) => depOf(a).getTime() - depOf(b).getTime());
  const trips: Trip[] = [];
  for (const leg of sorted) {
    const cur = trips[trips.length - 1];
    const prev = cur?.[cur.length - 1];
    const gap = prev?.arr && leg.dep ? leg.dep.getTime() - prev.arr.getTime() : null;
    if (cur && gap !== null && gap >= 0 && gap <= LAYOVER_HOURS * HOUR) cur.push(leg);
    else trips.push([leg]);
  }
  return trips;
}

export const tripStart = (t: Trip) => depOf(t[0]);
export const tripEnd = (t: Trip) => arrOf(t[t.length - 1]);

/**
 * Sorts flights into three groups, flight by flight:
 *  - past:  already landed (by scheduled arrival). Tracked flight by flight: each landed flight
 *           is its own entry, so ORD→DEN and DEN→LAX are two separate previous flights.
 *  - soon:  not landed yet and the trip leaves today or tomorrow (or is already under way).
 *           A flight drops out of this group the moment it lands, so a connection
 *           shrinks to just the flight(s) still to come.
 *  - later: everything further out. Shown flight by flight, with no layover grouping:
 *           connections are only joined up in the "soon" strip.
 */
export function splitFlights(flights: Flight[], now: Date, daysAhead = 1) {
  const legs = flights.map(toLeg);
  const landed = legs.filter((l) => arrOf(l) < now);
  const pending = groupTrips(legs.filter((l) => arrOf(l) >= now));

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + daysAhead + 1); // midnight after "tomorrow"

  const soon: Trip[] = [], later: Trip[] = [];
  for (const t of pending) (tripStart(t) < cutoff ? soon : later).push(t);
  const past: Trip[] = [...landed].sort((a, b) => depOf(a).getTime() - depOf(b).getTime()).map((l) => [l]);
  const flat = (ts: Trip[]): Trip[] => ts.flat().map((l) => [l]);
  return { past, soon, later: flat(later) };
}

export const fmtClock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function fmtDuration(ms: number) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function dayCountdown(dep: Date, now: Date) {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(dep); b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  return `In ${Math.round(days / 7)} weeks`;
}

export function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Has this flight already landed? Flights with no known time count as past once their day is over. */
export function isPast(f: Flight, now: Date) {
  return arrOf(toLeg(f)) < now;
}
