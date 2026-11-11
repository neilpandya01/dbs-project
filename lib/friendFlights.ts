import { resolveUpcoming } from "./itinerary";
import { CARRIERS, FRIEND_PAST, FRIEND_UPCOMING, flightHours, type Flight, type Friend } from "./mock";

/**
 * Everything a friend's profile needs, relative to "now": the flights they've taken, the one
 * they're on right now (if any, placed so it's `progress` of the way through), and what's coming up.
 */
export function friendFlights(p: Pick<Friend, "username" | "live">, now: Date): Flight[] {
  const past = FRIEND_PAST[p.username] ?? [];
  const upcoming = resolveUpcoming(now, FRIEND_UPCOMING[p.username] ?? []).map(({ dep: _d, arr: _a, ...f }) => f);

  const live: Flight[] = [];
  if (p.live) {
    const hours = flightHours({ from: p.live.from, to: p.live.to } as Flight);
    const dep = new Date(now.getTime() - p.live.progress * hours * 3_600_000);
    live.push({
      id: `live-${p.username}`,
      date: `${dep.getFullYear()}-${String(dep.getMonth() + 1).padStart(2, "0")}-${String(dep.getDate()).padStart(2, "0")}`,
      time: dep.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      number: p.live.number,
      airline: CARRIERS[p.live.number.slice(0, 2)],
      from: p.live.from,
      to: p.live.to,
      aircraft: p.live.aircraft,
    });
  }
  return [...past, ...live, ...upcoming];
}
