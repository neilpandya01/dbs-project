import { CARRIERS, MY_FLIGHTS, UPCOMING_FLIGHTS } from "./mock";


/** "ua1234" / "UA 1234" -> "UA 1234". Leaves anything else as typed (uppercased). */
export function formatFlightNumber(raw: string) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trimStart();
  const m = /^([A-Z0-9]{2})\s*(\d{1,4}[A-Z]?)$/.exec(v.trim());
  return m ? `${m[1]} ${m[2]}` : v;
}

export const airlineFor = (number?: string) => (number ? CARRIERS[number.slice(0, 2).toUpperCase()] : undefined);

/**
 * Stand-in for the real flight-number lookup (BTS data) that comes with the backend:
 * for now it only knows routes already present in the sample data.
 */
export function lookupFlightNumber(number: string) {
  const n = number.replace(/\s/g, "").toUpperCase();
  if (n.length < 3) return null;
  const known = [...MY_FLIGHTS, ...UPCOMING_FLIGHTS].find((f) => f.number?.replace(/\s/g, "").toUpperCase() === n);
  return known ? { from: known.from, to: known.to, aircraft: known.aircraft } : null;
}
