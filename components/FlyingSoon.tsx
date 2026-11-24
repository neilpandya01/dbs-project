"use client";

import type { Trip } from "@/lib/itinerary";
import { AIRPORTS } from "@/lib/core";
import { livePhase, phaseLabel, routeProgress } from "@/lib/liveDisplay";
import { useLivePositions } from "@/lib/livePositions";
import { TripGroup } from "./TripList";

/**
 * Strip under the banner: today and tomorrow's flights, each shown until its scheduled landing.
 * Any "live" label or progress bar comes only from a real, fresh position from the live tracker (at the gate,
 * taxiing, in the air...). The schedule alone never says a flight is under way: a delayed plane may still be parked.
 */
export function FlyingSoon({ trips, editable }: { trips: Trip[]; now?: Date; editable?: boolean }) {
  const { positions } = useLivePositions(true); // also tells the tracker to follow these flights
  if (trips.length === 0) return null;

  const phaseOf = (l: Trip[number]) => {
    const p = positions[l.id];
    return p ? { p, phase: livePhase(p, AIRPORTS[l.from].lngLat, AIRPORTS[l.to].lngLat, Date.now()) } : null;
  };

  return (
    <section className="soon" aria-label="Flying soon">
      <div className="soon-head">
        <span className="dot pulse" aria-hidden="true" />
        <b>Flying soon</b>
      </div>
      {trips.map((t) => (
        <TripGroup
          key={t[0].id}
          trip={t}
          editable={editable}
          badge={(l) => {
            const live = phaseOf(l);
            return live?.phase ? <span className="badge good">{phaseLabel(live.phase, live.p)}</span> : undefined;
          }}
          extra={(l) => {
            const live = phaseOf(l);
            if (live?.phase !== "airborne") return null;
            const pct = Math.round(routeProgress(AIRPORTS[l.from].lngLat, AIRPORTS[l.to].lngLat, [live.p.lon, live.p.lat]) * 100);
            return (
              <div className="leg-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Flight progress">
                <i style={{ width: `${pct}%` }} />
              </div>
            );
          }}
        />
      ))}
    </section>
  );
}
