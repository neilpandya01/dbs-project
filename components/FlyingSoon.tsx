"use client";

import type { Trip } from "@/lib/itinerary";
import { TripGroup } from "./TripList";

/** Strip under the banner: today and tomorrow's flights, each shown until its scheduled landing. */
export function FlyingSoon({ trips, now, editable }: { trips: Trip[]; now: Date; editable?: boolean }) {
  if (trips.length === 0) return null;

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
          badge={(l) =>
            l.dep && l.arr && l.dep <= now ? <span className="badge good">In the air</span> : undefined
          }
          extra={(l) => {
            if (!(l.dep && l.arr && l.dep <= now && l.arr >= now)) return null;
            const pct = Math.round(((now.getTime() - l.dep.getTime()) / (l.arr.getTime() - l.dep.getTime())) * 100);
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
