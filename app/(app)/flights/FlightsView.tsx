"use client";

import { useMemo, useState } from "react";
import { LegRow } from "@/components/TripList";
import { useNow } from "@/components/useNow";
import { useFlights } from "@/lib/flightsStore";
import { dayCountdown, depOf, isPast, toLeg, type Leg } from "@/lib/itinerary";
import { AIRPORTS, flightMiles } from "@/lib/core";

type Status = "all" | "past" | "upcoming";
type Sort = "newest" | "oldest" | "longest" | "shortest";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Everything a search can match on for one flight, lowercased. */
function haystack(l: Leg) {
  const parts: (string | undefined)[] = [
    l.number, l.number?.replace(/\s+/g, ""), l.airline, l.aircraft, l.registration, l.seat, l.notes,
    l.date, l.time, l.arrTime, l.depText, l.arrText,
    l.source === "lookup" ? "lookup" : "manual",
    l.hidden ? "hidden private" : undefined,
    l.status, l.status === "delayed" ? "delay late" : l.status === "cancelled" ? "cancellation canceled" : undefined,
  ];
  for (const code of [l.from, l.to]) {
    const a = AIRPORTS[code];
    if (!a) { parts.push(code); continue; }
    parts.push(code, a.city, a.name, a.country);
  }
  const mi = Number(l.date.slice(5, 7)) - 1;
  const month = MONTHS[mi];
  parts.push(month, month?.slice(0, 3), l.date.slice(0, 4));
  const d = new Date(l.date + "T12:00:00");
  if (!Number.isNaN(d.getTime())) { const wd = WEEKDAYS[d.getDay()]; parts.push(wd, wd.slice(0, 3)); }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className={`filter-select${value ? " on" : ""}`}>
      <span className="filter-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">Any</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function FlightsView() {
  const { allFlights: flights, openEditor } = useFlights();
  const now = useNow() ?? new Date();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("past"); // default: flights already taken
  const [year, setYear] = useState("");
  const [airline, setAirline] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [airport, setAirport] = useState("");
  const [country, setCountry] = useState("");
  const [disruption, setDisruption] = useState(""); // "", "Delayed" or "Cancelled"
  const [sort, setSort] = useState<Sort>("newest");

  const legs = useMemo(() => flights.map(toLeg), [flights]);

  const options = useMemo(() => ({
    years: uniq(legs.map((l) => l.date.slice(0, 4))).reverse(),
    airlines: uniq(legs.map((l) => l.airline)),
    aircraft: uniq(legs.map((l) => l.aircraft)),
    airports: uniq(legs.flatMap((l) => [l.from, l.to])),
    countries: uniq(legs.flatMap((l) => [AIRPORTS[l.from].country, AIRPORTS[l.to].country])),
  }), [legs]);

  const activeFilters = [year, airline, aircraft, airport, country, disruption].filter(Boolean).length + (status !== "past" ? 1 : 0) + (q.trim() ? 1 : 0);
  const clear = () => { setQ(""); setStatus("past"); setYear(""); setAirline(""); setAircraft(""); setAirport(""); setCountry(""); setDisruption(""); };

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = legs.filter((l) => {
      // cancelled flights never happened, so they only show under "All" or when you filter for them
      if (disruption === "Delayed" && l.status !== "delayed") return false;
      if (disruption === "Cancelled" ? l.status !== "cancelled" : l.status === "cancelled" && status !== "all") return false;
      if (disruption !== "Cancelled" && status !== "all" && (status === "past") !== isPast(l, now)) return false;
      if (year && l.date.slice(0, 4) !== year) return false;
      if (airline && l.airline !== airline) return false;
      if (aircraft && l.aircraft !== aircraft) return false;
      if (airport && l.from !== airport && l.to !== airport) return false;
      if (country && AIRPORTS[l.from].country !== country && AIRPORTS[l.to].country !== country) return false;
      if (tokens.length) {
        const h = haystack(l);
        return tokens.every((t) => h.includes(t));
      }
      return true;
    });
    const by = {
      newest: (a: Leg, b: Leg) => depOf(b).getTime() - depOf(a).getTime(),
      oldest: (a: Leg, b: Leg) => depOf(a).getTime() - depOf(b).getTime(),
      longest: (a: Leg, b: Leg) => flightMiles(b) - flightMiles(a),
      shortest: (a: Leg, b: Leg) => flightMiles(a) - flightMiles(b),
    }[sort];
    return out.sort(by);
  }, [legs, q, status, year, airline, aircraft, airport, country, disruption, sort, now]);

  // group by year when sorted by date
  const groups = useMemo(() => {
    if (sort === "longest" || sort === "shortest") return [{ title: null as string | null, rows: results }];
    const m = new Map<string, Leg[]>();
    for (const l of results) m.set(l.date.slice(0, 4), [...(m.get(l.date.slice(0, 4)) ?? []), l]);
    return [...m.entries()].map(([title, rows]) => ({ title, rows }));
  }, [results, sort]);

  const n = results.length;

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Flights</h1>
          <p>Tap a flight to edit or delete it.</p>
        </div>
        <button className="btn primary" onClick={() => openEditor()}>＋ Add flight</button>
      </div>

      <div className="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search airline, flight no., airport, tail number, seat, notes…" aria-label="Search flights" />
      </div>

      <div className="filter-card" role="group" aria-label="Filters">
        <div className="tabs" role="group" aria-label="Status">
          {(["past", "upcoming", "all"] as Status[]).map((s) => (
            <button key={s} className="tab" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {{ all: "All", past: "Taken", upcoming: "Upcoming" }[s]}
            </button>
          ))}
        </div>
        <div className="filter-grid">
          <FilterSelect label="Year" value={year} onChange={setYear} options={options.years} />
          <FilterSelect label="Airline" value={airline} onChange={setAirline} options={options.airlines} />
          <FilterSelect label="Aircraft" value={aircraft} onChange={setAircraft} options={options.aircraft} />
          <FilterSelect label="Airport" value={airport} onChange={setAirport} options={options.airports} />
          <FilterSelect label="Country" value={country} onChange={setCountry} options={options.countries} />
          <FilterSelect label="Delays & cancellations" value={disruption} onChange={setDisruption} options={["Delayed", "Cancelled"]} />
        </div>
      </div>

      <div className="result-bar">
        <span><b>{n}</b> flight{n === 1 ? "" : "s"}{activeFilters > 0 && <> · <button className="linkish" onClick={clear}>Clear filters</button></>}</span>
        <label className="sort">
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort flights">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest first</option>
            <option value="shortest">Shortest first</option>
          </select>
        </label>
      </div>

      {n === 0 ? (
        <div className="card empty" style={{ marginTop: 16 }}>
          <b>{legs.length === 0 ? "No flights yet" : "No flights match"}</b>
          <p className="muted">{legs.length === 0 ? "Add your first flight to start your log." : "Try a different search or clear the filters."}</p>
          {legs.length === 0 ? <button className="btn primary" onClick={() => openEditor()}>＋ Add flight</button> : <button className="btn" onClick={clear}>Clear filters</button>}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title ?? "all"} className="card flight-group" aria-label={g.title ?? "Flights"}>
            {g.title && <h2>{g.title} <span className="muted">· {g.rows.length}</span></h2>}
            {g.rows.map((l) => {
              const upcoming = !isPast(l, now);
              return (
                <LegRow
                  key={l.id}
                  leg={l}
                  badge={upcoming ? <span className="badge accent">{dayCountdown(depOf(l), now)}</span> : undefined}
                />
              );
            })}
          </section>
        ))
      )}
    </>
  );
}
