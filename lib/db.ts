import type { Banner } from "./banners";
import { DEFAULT_BANNER } from "./banners";
import type { Flight } from "./core";

/** A row of the Supabase `flights` table. */
export type FlightRow = {
  id: string;
  user_id: string;
  flown_on: string;
  dep_time: string | null;
  flight_number: string | null;
  airline: string | null;
  from_airport: string;
  to_airport: string;
  aircraft: string | null;
  hidden: boolean;
  registration: string | null;
  sched_arr_time: string | null;
  seat: string | null;
  notes: string | null;
  source: "manual" | "lookup";
  dep_at: string | null;
  arr_at: string | null;
  dep_tz: string | null;
  arr_tz: string | null;
};

export const toFlight = (r: FlightRow): Flight => ({
  id: r.id,
  date: r.flown_on,
  time: r.dep_time ?? undefined,
  number: r.flight_number ?? undefined,
  airline: r.airline ?? undefined,
  from: r.from_airport,
  to: r.to_airport,
  aircraft: r.aircraft ?? undefined,
  hidden: r.hidden,
  registration: r.registration ?? undefined,
  arrTime: r.sched_arr_time ?? undefined,
  seat: r.seat ?? undefined,
  notes: r.notes ?? undefined,
  source: r.source,
  depAt: r.dep_at ?? undefined,
  arrAt: r.arr_at ?? undefined,
  depTz: r.dep_tz ?? undefined,
  arrTz: r.arr_tz ?? undefined,
});

/** The columns to write for a flight (no id or owner: the database sets the owner from the signed-in user). */
export const toRow = (f: Omit<Flight, "id">) => ({
  flown_on: f.date,
  dep_time: f.time ?? null,
  flight_number: f.number ?? null,
  airline: f.airline ?? null,
  from_airport: f.from,
  to_airport: f.to,
  aircraft: f.aircraft ?? null,
  hidden: !!f.hidden,
  registration: f.registration ?? null,
  sched_arr_time: f.arrTime ?? null,
  seat: f.seat ?? null,
  notes: f.notes ?? null,
  source: f.source ?? "manual",
  dep_at: f.depAt ?? null,
  arr_at: f.arrAt ?? null,
  dep_tz: f.depTz ?? null,
  arr_tz: f.arrTz ?? null,
});

/** A banner stored as JSON in the database, checked before use (anything odd falls back to the default). */
export function parseBanner(raw: unknown): Banner {
  const b = raw as { kind?: string; id?: string; src?: string; focusY?: number } | null;
  if (b?.kind === "preset" && typeof b.id === "string") return { kind: "preset", id: b.id } as Banner;
  if (b?.kind === "photo" && typeof b.src === "string" && b.src.startsWith("data:image/")) return { kind: "photo", src: b.src, focusY: typeof b.focusY === "number" ? b.focusY : 50 };
  return DEFAULT_BANNER;
}
