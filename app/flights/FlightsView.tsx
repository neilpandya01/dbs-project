"use client";

import { useMemo, useState } from "react";
import { LegRow } from "@/components/TripList";
import { useNow } from "@/components/useNow";
import { useFlights } from "@/lib/flightsStore";
import { dayCountdown, depOf, isPast, toLeg, type Leg } from "@/lib/itinerary";
import { AIRPORTS, flightMiles } from "@/lib/mock";

type Status = "all" | "past" | "upcoming";
type Sort = "newest" | "oldest" | "longest" | "shortest";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Everything a search can match on for one flight, lowercased. */
function haystack(l: Leg) {
  const parts = [l.number, l.airline, l.aircraft, l.date, l.time];
  for (const code of [l.from, l.to]) {
    const a = AIRPORTS[code];
    parts.push(code, a.city, a.metro, a.country);
  }
  parts.push(MONTHS[Number(l.date.slice(5, 7)) - 1], l.date.slice(0, 4));
  return parts.filter(Boolean).join(" ").toLowerCase();
}

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className={`filter-select${value ? " on" : ""}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function FlightsView() {
  const { flights, openEditor } = useFlights();
  const now = useNow() ?? new Date();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("past"); // default: flights already taken
  const [year, setYear] = useState("");
  const [airline, setAirline] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [airport, setAirport] = useState("");
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const legs = useMemo(() => flights.map(toLeg), [flights]);

  const options = useMemo(() => ({
    years: uniq(legs.map((l) => l.date.slice(0, 4))).reverse(),
    airlines: uniq(legs.map((l) => l.airline)),
    aircraft: uniq(legs.map((l) => l.aircraft)),
    airports: uniq(legs.flatMap((l) => [l.from, l.to])),
    countries: uniq(legs.flatMap((l) => [AIRPORTS[l.from].country, AIRPORTS[l.to].country])),
  }), [legs]);

  const activeFilters = [year, airline, aircraft, airport, country].filter(Boolean).length + (status !== "past" ? 1 : 0) + (q.trim() ? 1 : 0);
  const clear = () => { setQ(""); setStatus("past"); setYear(""); setAirline(""); setAircraft(""); setAirport(""); setCountry(""); };

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = legs.filter((l) => {
      if (status !== "all" && (status === "past") !== isPast(l, now)) return false;
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
  }, [legs, q, status, year, airline, aircraft, airport, country, sort, now]);

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
        <input type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search airport, city, airline, aircraft, flight…" aria-label="Search flights" />
      </div>

      <div className="filter-bar" role="group" aria-label="Filters">
        <div className="tabs" role="group" aria-label="Status">
          {(["past", "upcoming", "all"] as Status[]).map((s) => (
            <button key={s} className="tab" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {{ all: "All", past: "Taken", upcoming: "Upcoming" }[s]}
            </button>
          ))}
        </div>
        <FilterSelect label="Year" value={year} onChange={setYear} options={options.years} />
        <FilterSelect label="Airline" value={airline} onChange={setAirline} options={options.airlines} />
        <FilterSelect label="Aircraft" value={aircraft} onChange={setAircraft} options={options.aircraft} />
        <FilterSelect label="Airport" value={airport} onChange={setAirport} options={options.airports} />
        <FilterSelect label="Country" value={country} onChange={setCountry} options={options.countries} />
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
