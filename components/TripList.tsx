"use client";

import type { ReactNode } from "react";
import { useFlights } from "@/lib/flightsStore";
import { AIRPORTS, flightMiles } from "@/lib/core";
import { fmtDate, fmtDuration, type Leg, type Trip } from "@/lib/itinerary";

const arrow = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="to">
    <path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * One flight, shown the same way everywhere (previous, upcoming, and flying soon):
 * route, then flight number + aircraft, then date + times, then distance.
 * Anything that isn't known is left out rather than labelled "unknown".
 */
export function LegRow({ leg, badge, extra, editable = true }: { leg: Leg; badge?: ReactNode; extra?: ReactNode; editable?: boolean }) {
  const { openEditor } = useFlights();
  // everything the flight was saved with shows here, so the card matches the edit form
  const what = [leg.number, leg.airline, leg.aircraft, leg.registration].filter(Boolean).join(" · ");
  // times are always the clock at each airport: departs where it leaves, arrives where it lands
  const times = leg.depText
    ? leg.arrText ? `${leg.depText} – ${leg.arrText}${leg.nextDay ? " +1" : ""}` : leg.depText
    : leg.arrText ? `Arrives ${leg.arrText}` : null;
  const when = [fmtDate(leg.date), times, leg.seat && `Seat ${leg.seat}`].filter(Boolean).join(" · ");
  const Row = editable ? "button" : "div";
  const { dep: _dep, arr: _arr, depText: _dt, arrText: _at, nextDay: _nd, ...flight } = leg;
  return (
    <div className="flight-row-wrap">
      <Row
        className={`flight-row${editable ? " tap" : ""}`}
        {...(editable ? { type: "button" as const, onClick: () => openEditor(flight), "aria-label": `Edit flight ${leg.number ?? `${leg.from} to ${leg.to}`}` } : {})}
      >
        <div className="grow">
          <div className="route mono">{leg.from}{arrow}{leg.to}</div>
          {what && <div className="sub">{what}</div>}
          <div className="sub">{when}</div>
          {leg.notes && <div className="sub leg-note">{leg.notes}</div>}
        </div>
        <div className="leg-right">
          <span className="muted mono" style={{ fontSize: 13 }}>{Math.round(flightMiles(leg)).toLocaleString()} mi</span>
          {badge}
        </div>
        {editable && <span className="row-chev" aria-hidden="true">›</span>}
      </Row>
      {extra}
    </div>
  );
}

/** A trip is one or more flights; several are shown together with the layover between them. */
type Props = { badge?: (l: Leg) => ReactNode; extra?: (l: Leg) => ReactNode; editable?: boolean };

export function TripGroup({ trip, badge, extra, editable }: { trip: Trip } & Props) {
  if (trip.length === 1) return <LegRow leg={trip[0]} badge={badge?.(trip[0])} extra={extra?.(trip[0])} editable={editable} />;
  return (
    <div className="trip">
      {trip.map((l, i) => (
        <div key={l.id}>
          {i > 0 && l.dep && trip[i - 1].arr && (
            <div className="layover">
              <span>
                {fmtDuration(l.dep.getTime() - trip[i - 1].arr!.getTime())} layover in <b className="mono">{l.from}</b>
                <span className="sr-only"> ({AIRPORTS[l.from].city})</span>
              </span>
            </div>
          )}
          <LegRow leg={l} badge={badge?.(l)} extra={extra?.(l)} editable={editable} />
        </div>
      ))}
    </div>
  );
}

export function TripList({ trips, badge, extra, editable }: { trips: Trip[] } & Props) {
  return <>{trips.map((t) => <TripGroup key={t[0].id} trip={t} badge={badge} extra={extra} editable={editable} />)}</>;
}
