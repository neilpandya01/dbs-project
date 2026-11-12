import { distanceMiles, type LngLat } from "./geo";

export type Airport = {
  code: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  continent: string;
  /** How big: large airports rank first in search. */
  kind: "large" | "medium" | "small";
  lngLat: LngLat;
};

/**
 * Every airport, keyed by its 3-letter code. Filled from the Supabase `airports` table when the app
 * starts (see lib/airports.tsx), before any screen that reads it is shown.
 */
export const AIRPORTS: Record<string, Airport> = {};

export type Flight = {
  id: string;
  /** Day of the flight, YYYY-MM-DD. */
  date: string;
  /** Departure clock time like "7:45 AM". Optional: unknown times are simply not shown. */
  time?: string;
  airline?: string;
  number?: string; // e.g. UA 1234
  from: string;
  to: string;
  aircraft?: string;
  /** Tail number, like N806VL. */
  registration?: string;
  /** Scheduled arrival clock time like "6:54 PM". */
  arrTime?: string;
  seat?: string;
  notes?: string;
  /** Exact departure/arrival moments (ISO, UTC) and airport time zones, when known (from the lookup). */
  depAt?: string;
  arrAt?: string;
  depTz?: string;
  arrTz?: string;
  /** Where the details came from: filled in by the lookup, or typed in. */
  source?: "manual" | "lookup";
  /** true = friends can't see this flight. */
  hidden?: boolean;
};

/** Airline name from a flight number's 2-letter prefix (a small starter list; unknown prefixes show no airline). */
export const CARRIERS: Record<string, string> = {
  UA: "United", AA: "American", DL: "Delta", BA: "British Airways", AS: "Alaska",
  WN: "Southwest", AC: "Air Canada", AF: "Air France", B6: "JetBlue", LH: "Lufthansa",
  KL: "KLM", EK: "Emirates", QR: "Qatar Airways", SQ: "Singapore Airlines", NH: "ANA",
  JL: "Japan Airlines", QF: "Qantas", VS: "Virgin Atlantic", IB: "Iberia", AZ: "ITA Airways",
  TK: "Turkish Airlines", LX: "SWISS", OS: "Austrian", SK: "SAS", AY: "Finnair",
  F9: "Frontier", NK: "Spirit", HA: "Hawaiian", G4: "Allegiant", SY: "Sun Country",
};

export const airlineFor = (number?: string) => (number ? CARRIERS[number.slice(0, 2).toUpperCase()] : undefined);

const point = (code: string): LngLat | null => AIRPORTS[code]?.lngLat ?? null;

export function flightMiles(f: { from: string; to: string }) {
  const a = point(f.from), b = point(f.to);
  return a && b ? distanceMiles(a, b) : 0;
}

/** Rough flying time: cruise speed plus half an hour for taxi, takeoff and landing. */
export function flightHours(f: { from: string; to: string }) {
  return flightMiles(f) / 480 + 0.5;
}

/** Airports within `miles` of a point, nearest first. */
export function airportsNear(lat: number, lon: number, miles = 120) {
  return Object.values(AIRPORTS)
    .map((a) => ({ code: a.code, d: distanceMiles([lon, lat], a.lngLat) }))
    .filter((a) => a.d <= miles)
    .sort((a, b) => a.d - b.d)
    .map((a) => a.code);
}

/** 🇺🇸 from "US": the two letters become regional-indicator symbols. */
export function flagOf(countryCode: string) {
  return /^[A-Za-z]{2}$/.test(countryCode)
    ? String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "🌍";
}
