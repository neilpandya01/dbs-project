import type { Flight } from "./core";
import type { LookupResult, LookupStatus } from "./lookupTypes";

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

/** Asks our server whether lookups are switched on (it may be off once the free allowance is nearly used). */
export async function fetchLookupStatus(): Promise<LookupStatus> {
  try {
    const r = await fetch("/api/flights/lookup");
    return r.ok ? ((await r.json()) as LookupStatus) : { available: false };
  } catch {
    return { available: false };
  }
}

/** Look up a flight by number and date. Never throws: failures come back as { status: "error" }. */
export async function lookupFlight(number: string, date: string): Promise<LookupResult> {
  try {
    const r = await fetch("/api/flights/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, date }) });
    const body = await r.json();
    if (!r.ok) return { status: "error", message: typeof body?.error === "string" ? body.error : "The flight lookup isn't working right now." };
    return body as LookupResult;
  } catch {
    return { status: "error", message: "Couldn’t reach the flight lookup. Check your connection." };
  }
}
