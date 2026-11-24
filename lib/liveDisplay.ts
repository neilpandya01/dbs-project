import { distanceMiles, type LngLat } from "./geo";
import type { LivePos } from "./livePositions";

/** A plane is drawn only while it's fresh and near the airport its stage belongs to. Never guessed or estimated. */
export const STALE_MS = 120_000; // a position older than this is "off radar": not shown
export const AIRPORT_RADIUS_MI = 6; // at the departure/arrival airport = within this many miles of it

export type Phase = "departure" | "airborne" | "arrival";

/**
 * Where a friend's plane is in its journey, or null if it shouldn't be shown right now:
 *   departure: on the ground (or just lifted off) within 6 miles of the departure airport
 *   airborne:  in flight (the tracker only calls it that once it is well up and well away from the airport)
 *   arrival:   on the ground within 6 miles of the arrival airport, still reporting
 */
export function livePhase(p: LivePos, from: LngLat, to: LngLat, nowMs: number): Phase | null {
  if (!p.seenAt || nowMs - Date.parse(p.seenAt) > STALE_MS) return null; // off radar
  const here: LngLat = [p.lon, p.lat];
  if (p.stage === "airborne") return "airborne";
  if (p.stage === "waiting") return distanceMiles(here, from) <= AIRPORT_RADIUS_MI ? "departure" : null;
  if (p.stage === "landed") return distanceMiles(here, to) <= AIRPORT_RADIUS_MI ? "arrival" : null;
  return null;
}

/** "At the gate", "Taxiing", "In the air"... for a live plane. */
export function phaseLabel(phase: Phase, p: LivePos) {
  if (phase === "airborne") return "In the air";
  const moving = (p.speedKt ?? 0) >= 5;
  if (phase === "departure") return p.onGround ? (moving ? "Taxiing out" : "At the gate") : "Departing";
  return moving ? "Taxiing in" : "At the gate";
}
