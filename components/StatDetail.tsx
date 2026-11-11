import { AIRPORTS, flightHours, flightMiles, type Flight } from "@/lib/core";
import { fmtDate } from "@/lib/itinerary";
import { WEEKDAYS, buildStats, type Stats } from "@/lib/stats";

export type StatKey = "flights" | "miles" | "time" | "airports" | "countries" | "airlines" | "aircraft" | "routes";

export const STAT_TITLES: Record<StatKey, string> = {
  flights: "Flying activity",
  miles: "Distance",
  time: "Time in the air",
  airports: "Airports",
  countries: "Countries",
  airlines: "Airlines",
  aircraft: "Aircraft",
  routes: "Routes",
};

const nf = (n: number) => Math.round(n).toLocaleString();
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

type Row = { k: string; lead?: string; sub?: string; right: string; pct?: number };

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="rank detail">
      {rows.map((r) => (
        <li key={r.k}>
          <span>{r.lead && <span className="lead" aria-hidden="true">{r.lead} </span>}<b>{r.k}</b>{r.sub && <span className="muted"> · {r.sub}</span>}</span>
          <b>{r.right}</b>
          {r.pct != null && <div className="track"><i style={{ width: `${r.pct}%` }} /></div>}
        </li>
      ))}
    </ul>
  );
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <div className="facts">
      {items.map(([l, v]) => (
        <div key={l}><b>{v}</b><span>{l}</span></div>
      ))}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="detail-h">{children}</h3>;
}

function Bars({ data, small }: { data: [string, number][]; small?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <div className={`bars${small ? " small" : ""}`}>
      {data.map(([label, n]) => (
        <div className="bar" key={label}>
          <b>{n || ""}</b>
          <i style={{ height: `${Math.max(4, (n / max) * 70)}%`, opacity: n ? 1 : 0.25 }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

const flightLine = (f: Flight) => `${f.from} → ${f.to}`;
const share = (n: number, total: number) => `${Math.round((n / total) * 100)}%`;

// One theme per tile; see lib/stats.ts. Sheets deliberately don't repeat each other.
const SECTIONS: Record<StatKey, (s: Stats) => React.ReactNode> = {
  flights: (s) => (
    <>
      <Facts items={[["flights", String(s.n)], ["flying since", fmtDate(s.first).replace(/ \d+,/, "")], ["busiest year", s.busiestYear[0]]]} />
      <Heading>Flights per year</Heading>
      <Bars data={s.years} />
      <Heading>Favourite day to fly</Heading>
      <Bars data={WEEKDAYS.map((d, i) => [d, s.weekday[i]] as [string, number])} small />
    </>
  ),

  miles: (s) => (
    <>
      <Facts items={[["total miles", nf(s.miles)], ["avg per flight", nf(s.avgMiles)]]} />
      <Heading>That’s about</Heading>
      <Rows rows={[
        { k: `${s.earth.toFixed(1)}×`, sub: "around the Earth", right: "24,901 mi each" },
        { k: `${(s.moon * 100).toFixed(0)}%`, sub: "of the way to the Moon", right: "238,855 mi" },
      ]} />
      <Heading>Extremes</Heading>
      <Rows rows={[
        { k: "Longest", sub: `${flightLine(s.longest)} · ${fmtDate(s.longest.date)}`, right: `${nf(flightMiles(s.longest))} mi` },
        { k: "Shortest", sub: `${flightLine(s.shortest)} · ${fmtDate(s.shortest.date)}`, right: `${nf(flightMiles(s.shortest))} mi` },
      ]} />
    </>
  ),

  time: (s) => {
    const total = s.haul.short + s.haul.medium + s.haul.long;
    return (
      <>
        <Facts items={[["hours", nf(s.hours)], ["days aloft", (s.hours / 24).toFixed(1)], ["avg flight", `${s.avgHours.toFixed(1)} h`]]} />
        <Heading>How long your flights are</Heading>
        <Rows rows={[
          { k: "Short", sub: "under 2.5 h", right: plural(s.haul.short, "flight"), pct: (s.haul.short / total) * 100 },
          { k: "Medium", sub: "2.5 to 6 h", right: plural(s.haul.medium, "flight"), pct: (s.haul.medium / total) * 100 },
          { k: "Long haul", sub: "over 6 h", right: plural(s.haul.long, "flight"), pct: (s.haul.long / total) * 100 },
        ]} />
      </>
    );
  },

  airports: (s) => {
    const max = s.airports[0][1];
    return (
      <>
        <Facts items={[["airports", String(s.airports.length)], ["most visited", s.airports[0][0]], ["visited once", String(s.airportOnce)]]} />
        <Heading>Most visited</Heading>
        <Rows rows={s.airports.slice(0, 10).map(([code, c]) => ({ k: code, sub: AIRPORTS[code].city, right: `${c}×`, pct: (c / max) * 100 }))} />
      </>
    );
  },

  countries: (s) => (
    <>
      <Facts items={[["countries", String(s.countryCount)], ["continents", String(s.continentCount)]]} />
      <Heading>Departures and arrivals</Heading>
      <Rows rows={s.countryVisits.map(([c, v]) => ({ k: c, lead: s.flag(c), right: `${v}×`, pct: (v / s.countryVisits[0][1]) * 100 }))} />
    </>
  ),

  airlines: (s) => (
    <>
      <Facts items={[["airlines", String(s.airlines.length)], ["favourite", s.airlines[0].name]]} />
      <Heading>Who you fly</Heading>
      <Rows rows={s.airlines.map((a) => ({ k: a.name, right: `${plural(a.count, "flight")} · ${share(a.count, s.airlineTotal)}`, pct: (a.count / s.airlines[0].count) * 100 }))} />
    </>
  ),

  aircraft: (s) => {
    const total = s.makers.reduce((t, [, c]) => t + c, 0);
    return (
      <>
        <Facts items={[["types", String(s.types.length)], ["most flown", s.types[0][0].replace(/^(Boeing|Airbus) /, "")]]} />
        <Heading>By manufacturer</Heading>
        <Rows rows={s.makers.map(([m, c]) => ({ k: m, right: `${share(c, total)}`, sub: plural(c, "flight"), pct: (c / total) * 100 }))} />
        <Heading>By type</Heading>
        <Rows rows={s.types.map(([t, c]) => ({ k: t, right: `${c}×`, pct: (c / s.types[0][1]) * 100 }))} />
      </>
    );
  },

  routes: (s) => (
    <>
      <Facts items={[["routes", String(s.routes.length)], ["flown more than once", String(s.routeRepeats)]]} />
      <Heading>Most flown</Heading>
      <Rows rows={s.routes.slice(0, 10).map((r) => ({ k: r.key, right: `${r.count}×`, pct: (r.count / s.routes[0].count) * 100 }))} />
    </>
  ),
};

export function StatDetail({ k, flights }: { k: StatKey; flights: Flight[] }) {
  return <>{SECTIONS[k](buildStats(flights))}</>;
}

// kept for callers that want a duration without importing mock
export { flightHours };
