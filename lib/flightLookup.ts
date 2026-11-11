import type { Flight } from "./core";

/** "ua1234" / "UA 1234" -> "UA 1234". Leaves anything else as typed (uppercased). */
export function formatFlightNumber(raw: string) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trimStart();
  const m = /^([A-Z0-9]{2})\s*(\d{1,4}[A-Z]?)$/.exec(v.trim());
  return m ? `${m[1]} ${m[2]}` : v;
}

/**
 * If you've logged this flight number before, reuse its route and aircraft. (Looking up flights you
 * haven't logged needs a flight-schedule data source, which comes with the background workers.)
 */
export function lookupFlightNumber(number: string, known: Flight[]) {
  const n = number.replace(/\s/g, "").toUpperCase();
  if (n.length < 3) return null;
  const hit = known.find((f) => f.number?.replace(/\s/g, "").toUpperCase() === n);
  return hit ? { from: hit.from, to: hit.to, aircraft: hit.aircraft } : null;
}
