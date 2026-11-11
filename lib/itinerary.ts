import { flightHours, type Flight } from "./core";

/** A flight plus resolved departure/arrival instants (null when the clock time isn't known). */
export type Leg = Flight & { dep: Date | null; arr: Date | null };
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

/** Times are treated as local clock times; there is no time-zone handling yet. */
export function toLeg(f: Flight): Leg {
  const hm = f.time ? parseTime(f.time) : null;
  if (!hm) return { ...f, dep: null, arr: null };
  const dep = new Date(f.date + "T00:00:00");
  dep.setHours(hm[0], hm[1], 0, 0);
  return { ...f, dep, arr: new Date(dep.getTime() + flightHours(f) * HOUR) };
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
