import { AIRPORTS, flightHours, flightMiles, type Flight } from "./mock";

const EARTH_MILES = 24_901;
const MOON_MILES = 238_855;

export const COUNTRY_INFO: Record<string, { flag: string; continent: string }> = {
  "United States": { flag: "🇺🇸", continent: "North America" },
  Canada: { flag: "🇨🇦", continent: "North America" },
  "United Kingdom": { flag: "🇬🇧", continent: "Europe" },
  France: { flag: "🇫🇷", continent: "Europe" },
  Japan: { flag: "🇯🇵", continent: "Asia" },
};
const info = (country: string) => COUNTRY_INFO[country] ?? { flag: "🌍", continent: "Other" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** [key, count] sorted by count (then name), skipping flights where the key isn't known. */
function tally(flights: Flight[], keys: (f: Flight) => (string | undefined)[]) {
  const m = new Map<string, number>();
  for (const f of flights) for (const k of keys(f)) if (k) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const manufacturer = (type: string) => (/^boeing/i.test(type) ? "Boeing" : /^airbus/i.test(type) ? "Airbus" : /^embraer/i.test(type) ? "Embraer" : "Other");

/**
 * Everything the stat tiles and their detail sheets need. Each tile owns one theme so
 * the sheets never repeat each other:
 *   flights   -> activity over time        miles     -> distance and comparisons
 *   time      -> hours and flight length   airports  -> where you've been
 *   countries -> departures + arrivals          airlines  -> who you fly
 *   aircraft  -> makers and types          routes    -> one-way routes
 */
export function buildStats(flights: Flight[]) {
  const n = flights.length;
  const miles = flights.reduce((s, f) => s + flightMiles(f), 0);
  const hours = flights.reduce((s, f) => s + flightHours(f), 0);

  const sortedMiles = [...flights].sort((a, b) => flightMiles(b) - flightMiles(a));
  const longest = sortedMiles[0];
  const shortest = sortedMiles[sortedMiles.length - 1];

  // --- activity over time
  const years = tally(flights, (f) => [f.date.slice(0, 4)]).sort((a, b) => a[0].localeCompare(b[0]));
  const months = tally(flights, (f) => [monthLabel(f.date)]);
  const weekday = Array<number>(7).fill(0);
  for (const f of flights) weekday[(new Date(f.date + "T12:00:00").getDay() + 6) % 7]++;
  const first = flights.reduce((a, f) => (f.date < a ? f.date : a), flights[0].date);
  const thisYear = String(new Date().getFullYear());

  // --- time in the air: length mix by flying time
  const haul = { short: 0, medium: 0, long: 0 };
  for (const f of flights) {
    const h = flightHours(f);
    haul[h < 2.5 ? "short" : h <= 6 ? "medium" : "long"]++;
  }

  // --- places
  const airports = tally(flights, (f) => [f.from, f.to]);
  // a country counts once for every departure from it and once for every arrival into it,
  // so a round trip adds 2 to both ends
  const countryVisits = tally(flights, (f) => [AIRPORTS[f.from].country, AIRPORTS[f.to].country]);
  const countries = new Set(countryVisits.map(([c]) => c));
  const continents = new Set([...countries].map((c) => info(c).continent));

  // --- airlines
  const airlines = tally(flights, (f) => [f.airline]).map(([name, count]) => ({ name, count }));
  const airlineTotal = airlines.reduce((s, a) => s + a.count, 0);

  // --- aircraft
  const types = tally(flights, (f) => [f.aircraft]);
  const makers = tally(flights, (f) => [f.aircraft && manufacturer(f.aircraft)]);

  // --- routes: every direction is its own one-way route, so a round trip is two routes
  const routes = tally(flights, (f) => [`${f.from} → ${f.to}`]).map(([key, count]) => ({ key, count }));

  return {
    n, miles, hours, longest, shortest, first,
    avgMiles: miles / n,
    avgHours: hours / n,
    years, months, weekday,
    thisYear: years.find(([y]) => y === thisYear)?.[1] ?? 0,
    busiestYear: [...years].sort((a, b) => b[1] - a[1])[0],
    busiestMonth: months[0],
    haul,
    earth: miles / EARTH_MILES,
    moon: miles / MOON_MILES,
    airports,
    airportOnce: airports.filter(([, c]) => c === 1).length,
    countryVisits,
    countryCount: countries.size,
    continentCount: continents.size,
    continents: [...continents].sort(),
    airlines, airlineTotal,
    types, makers,
    routes,
    routeRepeats: routes.filter((r) => r.count > 1).length,
    flag: (country: string) => info(country).flag,
  };
}

export type Stats = ReturnType<typeof buildStats>;
