"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { StatCard } from "./StatCard";
import { STAT_TITLES, StatDetail, type StatKey } from "./StatDetail";
import { buildStats } from "@/lib/stats";
import type { Flight } from "@/lib/core";

export function ProfileStats({ flights }: { flights: Flight[] }) {
  const s = buildStats(flights);
  const [open, setOpen] = useState<StatKey | null>(null);
  const tile = (k: StatKey, value: string, label: string, sub: string) => (
    <StatCard value={value} label={label} sub={sub} onClick={() => setOpen(k)} />
  );
  return (
    <>
      <div className="stat-grid">
        {tile("flights", String(s.n), "Flights", `since ${s.first.slice(0, 4)}`)}
        {tile("miles", Math.round(s.miles).toLocaleString(), "Miles flown", `${s.earth.toFixed(1)}× around the world`)}
        {tile("time", `${Math.round(s.hours)} h`, "Time in the air", `${(s.hours / 24).toFixed(1)} days aloft`)}
        {tile("airports", String(s.airports.length), "Airports", `most visited ${s.airports[0][0]}`)}
        {tile("countries", String(s.countryCount), "Countries", `${s.continentCount} continent${s.continentCount === 1 ? "" : "s"}`)}
        {s.airlines.length > 0 && tile("airlines", String(s.airlines.length), "Airlines", `favourite ${s.airlines[0].name}`)}
        {s.types.length > 0 && tile("aircraft", String(s.types.length), "Aircraft types", s.types[0][0])}
        {tile("routes", String(s.routes.length), "Routes", `${s.routes[0].key} most flown`)}
      </div>
      {open && (
        <Sheet title={STAT_TITLES[open]} onClose={() => setOpen(null)}>
          <StatDetail k={open} flights={flights} />
        </Sheet>
      )}
    </>
  );
}
