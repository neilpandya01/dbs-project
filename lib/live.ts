import { toLeg } from "./itinerary";
import type { Flight } from "./core";

export type Live = { flight: Flight; progress: number };

/**
 * Which flight, if any, someone is on right now? Based on the flight's scheduled departure and arrival,
 * so it needs a departure time. (Real aircraft positions come with the live-tracking worker later.)
 */
export function liveFlight(flights: Flight[], now: Date): Live | null {
  for (const f of flights) {
    const { dep, arr } = toLeg(f);
    if (dep && arr && dep <= now && now <= arr) {
      return { flight: f, progress: (now.getTime() - dep.getTime()) / (arr.getTime() - dep.getTime()) };
    }
  }
  return null;
}
