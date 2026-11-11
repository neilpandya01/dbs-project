"use client";

import { depOf, dayCountdown, type Trip } from "@/lib/itinerary";
import { TripList } from "./TripList";

/** Upcoming trips beyond the "flying soon" strip (those are never repeated here). */
export function UpcomingList({ trips, now, limit = 3, editable }: { trips: Trip[]; now: Date; limit?: number; editable?: boolean }) {
  return (
    <div className="card">
      <h2>Upcoming flights</h2>
      {trips.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing booked yet.</p>}
      <TripList trips={trips.slice(0, limit)} editable={editable} badge={(l) => <span className="badge accent">{dayCountdown(depOf(l), now)}</span>} />
    </div>
  );
}
