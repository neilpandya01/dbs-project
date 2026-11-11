// Sample data for the front-end preview. Replaced by Supabase + workers later.
import type { BannerId } from "./banners";
import { distanceMiles, type LngLat } from "./geo";

export type Airport = {
  code: string;
  city: string;
  /** The metro area this airport serves; one metro can have several airports (ORD and MDW are both Chicago). */
  metro: string;
  country: string;
  lngLat: LngLat;
};

export const AIRPORTS: Record<string, Airport> = {
  ORD: { code: "ORD", city: "Chicago", metro: "Chicago", country: "United States", lngLat: [-87.9048, 41.9742] },
  MDW: { code: "MDW", city: "Chicago Midway", metro: "Chicago", country: "United States", lngLat: [-87.7524, 41.7868] },
  LAX: { code: "LAX", city: "Los Angeles", metro: "Los Angeles", country: "United States", lngLat: [-118.4085, 33.9416] },
  SFO: { code: "SFO", city: "San Francisco", metro: "San Francisco", country: "United States", lngLat: [-122.379, 37.6213] },
  JFK: { code: "JFK", city: "New York", metro: "New York", country: "United States", lngLat: [-73.7781, 40.6413] },
  BOS: { code: "BOS", city: "Boston", metro: "Boston", country: "United States", lngLat: [-71.0096, 42.3656] },
  ATL: { code: "ATL", city: "Atlanta", metro: "Atlanta", country: "United States", lngLat: [-84.4277, 33.6407] },
  DEN: { code: "DEN", city: "Denver", metro: "Denver", country: "United States", lngLat: [-104.6737, 39.8561] },
  SEA: { code: "SEA", city: "Seattle", metro: "Seattle", country: "United States", lngLat: [-122.3088, 47.4502] },
  MIA: { code: "MIA", city: "Miami", metro: "Miami", country: "United States", lngLat: [-80.2906, 25.7959] },
  DFW: { code: "DFW", city: "Dallas–Fort Worth", metro: "Dallas–Fort Worth", country: "United States", lngLat: [-97.038, 32.8998] },
  HNL: { code: "HNL", city: "Honolulu", metro: "Honolulu", country: "United States", lngLat: [-157.9224, 21.3187] },
  LHR: { code: "LHR", city: "London", metro: "London", country: "United Kingdom", lngLat: [-0.4543, 51.47] },
  CDG: { code: "CDG", city: "Paris", metro: "Paris", country: "France", lngLat: [2.55, 49.0097] },
  NRT: { code: "NRT", city: "Tokyo Narita", metro: "Tokyo", country: "Japan", lngLat: [140.3929, 35.772] },
  EWR: { code: "EWR", city: "Newark", metro: "New York", country: "United States", lngLat: [-74.1745, 40.6895] },
  BDL: { code: "BDL", city: "Hartford", metro: "Hartford", country: "United States", lngLat: [-72.6832, 41.9389] },
  PVD: { code: "PVD", city: "Providence", metro: "Providence", country: "United States", lngLat: [-71.4282, 41.7267] },
  PHL: { code: "PHL", city: "Philadelphia", metro: "Philadelphia", country: "United States", lngLat: [-75.2424, 39.8721] },
  DCA: { code: "DCA", city: "Washington Reagan", metro: "Washington", country: "United States", lngLat: [-77.0402, 38.8512] },
  IAD: { code: "IAD", city: "Washington Dulles", metro: "Washington", country: "United States", lngLat: [-77.4565, 38.9531] },
  BWI: { code: "BWI", city: "Baltimore", metro: "Baltimore", country: "United States", lngLat: [-76.6684, 39.1774] },
  CLT: { code: "CLT", city: "Charlotte", metro: "Charlotte", country: "United States", lngLat: [-80.9431, 35.214] },
  MCO: { code: "MCO", city: "Orlando", metro: "Orlando", country: "United States", lngLat: [-81.3081, 28.4312] },
  DTW: { code: "DTW", city: "Detroit", metro: "Detroit", country: "United States", lngLat: [-83.3534, 42.2162] },
  MSP: { code: "MSP", city: "Minneapolis", metro: "Minneapolis", country: "United States", lngLat: [-93.2218, 44.8848] },
  IAH: { code: "IAH", city: "Houston", metro: "Houston", country: "United States", lngLat: [-95.3414, 29.9844] },
  PHX: { code: "PHX", city: "Phoenix", metro: "Phoenix", country: "United States", lngLat: [-112.0116, 33.4342] },
  LAS: { code: "LAS", city: "Las Vegas", metro: "Las Vegas", country: "United States", lngLat: [-115.1523, 36.084] },
  SLC: { code: "SLC", city: "Salt Lake City", metro: "Salt Lake City", country: "United States", lngLat: [-111.9791, 40.7899] },
  SAN: { code: "SAN", city: "San Diego", metro: "San Diego", country: "United States", lngLat: [-117.1897, 32.7338] },
  PDX: { code: "PDX", city: "Portland", metro: "Portland", country: "United States", lngLat: [-122.5951, 45.5887] },
  YYZ: { code: "YYZ", city: "Toronto", metro: "Toronto", country: "Canada", lngLat: [-79.6248, 43.6777] },
};

export type Flight = {
  id: string;
  date: string; // ISO date
  /** Departure clock time like "7:45 AM". Optional: unknown times are simply not shown. */
  time?: string;
  airline?: string;
  number?: string; // e.g. UA 1234
  from: string;
  to: string;
  aircraft?: string;
};

export const MY_FLIGHTS: Flight[] = [
  { id: "f1", date: "2026-10-24", time: "8:15 AM", airline: "United", number: "UA 1234", from: "ORD", to: "SFO", aircraft: "Boeing 737-900" },
  { id: "f2", date: "2026-09-12", time: "9:40 PM", airline: "American", number: "AA 100", from: "JFK", to: "LHR", aircraft: "Boeing 777-300ER" },
  { id: "f3", date: "2026-09-19", airline: "British Airways", number: "BA 287", from: "LHR", to: "SFO", aircraft: "Boeing 777-200" },
  { id: "f4", date: "2026-08-03", airline: "Delta", number: "DL 410", from: "ATL", to: "LAX", aircraft: "Airbus A321" },
  { id: "f5", date: "2026-06-21", airline: "United", number: "UA 891", from: "ORD", to: "NRT", aircraft: "Boeing 787-9" },
  { id: "f6", date: "2026-06-30", airline: "United", number: "UA 838", from: "NRT", to: "ORD", aircraft: "Boeing 787-9" },
  { id: "f7", date: "2026-03-14", airline: "Alaska", number: "AS 22", from: "SEA", to: "HNL", aircraft: "Boeing 737-900ER" },
  { id: "f8", date: "2026-01-09", airline: "American", number: "AA 1522", from: "DFW", to: "MIA", aircraft: "Airbus A321" },
  { id: "f9", date: "2025-11-26", airline: "United", number: "UA 640", from: "ORD", to: "BOS", aircraft: "Airbus A320" },
  { id: "f10", date: "2025-08-17", airline: "Air Canada", number: "AC 8", from: "YYZ", to: "LHR", aircraft: "Boeing 787-9" },
  { id: "f11", date: "2025-05-02", airline: "Air France", number: "AF 1234", from: "CDG", to: "JFK", aircraft: "Airbus A350-900" },
  { id: "f12", date: "2025-02-21", airline: "United", number: "UA 2043", from: "ORD", to: "DEN", aircraft: "Boeing 737 MAX 8" },
  { id: "f13", date: "2024-12-20", airline: "Southwest", number: "WN 1801", from: "MDW", to: "LAX" }, // aircraft not logged
  { id: "f14", date: "2024-07-08", airline: "Delta", from: "JFK", to: "LHR", aircraft: "Airbus A330-900" }, // flight number not logged
  // a past connection: two flights, same morning
  { id: "f15", date: "2026-04-22", time: "7:05 AM", airline: "Southwest", number: "WN 1893", from: "MDW", to: "DEN", aircraft: "Boeing 737-800" },
  { id: "f16", date: "2026-04-22", time: "10:20 AM", airline: "Southwest", number: "WN 2210", from: "DEN", to: "LAX", aircraft: "Boeing 737-800" },
];

/** Upcoming flights are stored relative to "today" so the sample data never goes stale. */
export type UpcomingFlight = Omit<Flight, "date"> & { dayOffset: number };

export const UPCOMING_FLIGHTS: UpcomingFlight[] = [
  // tomorrow: a connection (ORD → DEN → LAX), so both legs show together up top
  { id: "u1", dayOffset: 1, time: "7:45 AM", airline: "United", number: "UA 1234", from: "ORD", to: "DEN", aircraft: "Boeing 737 MAX 9" },
  { id: "u2", dayOffset: 1, time: "11:30 AM", airline: "United", number: "UA 1550", from: "DEN", to: "LAX", aircraft: "Airbus A320" },
  { id: "u3", dayOffset: 9, time: "5:10 PM", airline: "United", number: "UA 2043", from: "LAX", to: "ORD", aircraft: "Airbus A321" },
  { id: "u4", dayOffset: 38, airline: "British Airways", number: "BA 296", from: "ORD", to: "LHR" }, // time + aircraft not known yet
  { id: "u5", dayOffset: 59, time: "11:20 AM", airline: "American", number: "AA 100", from: "LHR", to: "JFK", aircraft: "Boeing 777-300ER" },
];

export type Friend = {
  username: string;
  name: string;
  /** Home city (metro area), not an airport. */
  home: string;
  color: string;
  bio: string;
  banner: BannerId;
  joined: string;
  /** How many friends they have (their own list isn't shown). */
  friendCount: number;
  /** Currently airborne? progress is 0..1 along the route. */
  live?: { number: string; from: string; to: string; progress: number; altitudeFt: number; speedKts: number; aircraft: string };
};

export const FRIENDS: Friend[] = [
  { username: "skyler", name: "Skyler Park", home: "San Francisco", color: "#e0572f", bio: "Chasing sunrises over the Pacific.", banner: "sunrise", joined: "Jan 2026", friendCount: 31,
    live: { number: "UA 1", from: "SFO", to: "NRT", progress: 0.42, altitudeFt: 38000, speedKts: 506, aircraft: "Boeing 777-300ER" } },
  { username: "maya.flies", name: "Maya Okafor", home: "Atlanta", color: "#7a3fd1", bio: "Window seat, always. A350 fan.", banner: "golden", joined: "Feb 2026", friendCount: 22,
    live: { number: "DL 12", from: "ATL", to: "CDG", progress: 0.68, altitudeFt: 37000, speedKts: 488, aircraft: "Airbus A350-900" } },
  { username: "jetjunkie", name: "Leo Brandt", home: "Denver", color: "#0f7b4f", bio: "Collecting airports one layover at a time.", banner: "mountains", joined: "Nov 2025", friendCount: 48 },
  { username: "rwy28l", name: "Priya Nair", home: "Boston", color: "#c27a00", bio: "Runway 28L spotter on weekends.", banner: "clouds", joined: "Mar 2026", friendCount: 12,
    live: { number: "B6 615", from: "BOS", to: "MIA", progress: 0.3, altitudeFt: 35000, speedKts: 462, aircraft: "Airbus A220-300" } },
];

/** Directory used to demo "add friend by username". */
export const DIRECTORY: Friend[] = [
  { username: "tailstrike", name: "Dana Ruiz", home: "Los Angeles", color: "#1d5fd1", bio: "West coast hopper.", banner: "desert", joined: "Apr 2026", friendCount: 9 },
  { username: "heavyhauler", name: "Omar Haddad", home: "New York", color: "#d14a8f", bio: "Heavies only. Transatlantic is home.", banner: "city", joined: "Dec 2025", friendCount: 40 },
  { username: "squawk7700", name: "Wen Li", home: "Seattle", color: "#127a8f", bio: "New to avgeeking, learning fast.", banner: "aurora", joined: "Oct 2026", friendCount: 6 },
];

// ---- friends' sample flights --------------------------------------------

export const CARRIERS: Record<string, string> = {
  UA: "United", AA: "American", DL: "Delta", BA: "British Airways", AS: "Alaska",
  WN: "Southwest", AC: "Air Canada", AF: "Air France", B6: "JetBlue",
};

/** date, flight number, from, to, aircraft, departure time (all but the first four optional) */
const P = (date: string, number: string, from: string, to: string, aircraft?: string, time?: string): Flight => ({
  id: `${number.replace(" ", "")}-${date}`, date, number, airline: CARRIERS[number.slice(0, 2)], from, to, aircraft, time,
});
const U = (dayOffset: number, number: string, from: string, to: string, aircraft?: string, time?: string): UpcomingFlight => ({
  id: `u-${number.replace(" ", "")}-${dayOffset}`, dayOffset, number, airline: CARRIERS[number.slice(0, 2)], from, to, aircraft, time,
});

/** Flights each person has already taken (their in-flight leg is added at runtime from `live`). */
export const FRIEND_PAST: Record<string, Flight[]> = {
  skyler: [
    P("2026-10-02", "UA 837", "SFO", "NRT", "Boeing 777-300ER", "11:40 AM"), P("2026-10-14", "UA 838", "NRT", "SFO", "Boeing 777-300ER", "5:25 PM"),
    P("2026-08-21", "AS 331", "SFO", "SEA", "Boeing 737-900"), P("2026-08-23", "AS 340", "SEA", "SFO", "Boeing 737-900"),
    P("2026-06-11", "AS 22", "SEA", "HNL", "Boeing 737-900ER", "8:05 AM"), P("2026-06-18", "AS 23", "HNL", "SEA", "Boeing 737-900ER"),
    P("2026-03-05", "UA 1920", "SFO", "LAX", "Airbus A320"), P("2025-12-19", "UA 289", "SFO", "JFK", "Boeing 767-300ER", "7:15 AM"),
    P("2025-12-27", "UA 2047", "JFK", "SFO", "Boeing 767-300ER"), P("2025-09-09", "BA 286", "SFO", "LHR", "Boeing 777-200", "4:30 PM"),
    P("2025-09-16", "BA 287", "LHR", "SFO", "Boeing 777-200"),
  ],
  "maya.flies": [
    P("2026-10-09", "DL 8", "ATL", "CDG", "Airbus A350-900", "6:20 PM"), P("2026-10-17", "DL 9", "CDG", "ATL", "Airbus A350-900"),
    P("2026-08-05", "DL 1234", "ATL", "MIA", "Airbus A321"), P("2026-08-07", "DL 1235", "MIA", "ATL", "Airbus A321"),
    P("2026-05-22", "DL 410", "ATL", "LAX", "Airbus A321", "9:00 AM"), P("2026-05-26", "DL 411", "LAX", "ATL", "Airbus A321"),
    P("2026-02-14", "DL 30", "ATL", "LHR", "Boeing 767-300ER"), P("2026-02-20", "DL 31", "LHR", "ATL", "Boeing 767-300ER"),
    P("2025-11-26", "DL 2400", "ATL", "JFK", "Boeing 737-900ER"), P("2025-11-30", "DL 2401", "JFK", "ATL", "Boeing 737-900ER"),
  ],
  jetjunkie: [
    P("2026-10-02", "BA 287", "LHR", "SFO", "Boeing 777-200", "12:50 PM"), P("2026-09-26", "BA 286", "SFO", "LHR", "Boeing 777-200"),
    P("2026-09-12", "UA 1550", "DEN", "LAX", "Airbus A320", "7:30 AM"), P("2026-09-15", "UA 1551", "LAX", "DEN", "Airbus A320"),
    P("2026-07-30", "UA 1892", "DEN", "BOS", "Boeing 737-900"), P("2026-08-02", "UA 1893", "BOS", "DEN", "Boeing 737-900"),
    P("2026-06-04", "UA 891", "ORD", "NRT", "Boeing 787-9", "11:55 AM"), P("2026-06-14", "UA 838", "NRT", "ORD", "Boeing 787-9"),
    P("2026-04-18", "UA 640", "DEN", "ORD", "Airbus A320"), P("2026-03-02", "DL 1750", "ATL", "DEN", "Airbus A321"),
    P("2026-03-05", "DL 1751", "DEN", "ATL", "Airbus A321"), P("2025-12-20", "UA 2043", "DEN", "ORD", "Boeing 737 MAX 8"),
  ],
  rwy28l: [
    P("2026-09-20", "B6 1706", "BOS", "ORD", "Airbus A220-300", "6:45 AM"), P("2026-09-22", "B6 1707", "ORD", "BOS", "Airbus A220-300"),
    P("2026-07-15", "AC 7", "BOS", "YYZ", "Embraer E175"), P("2026-07-18", "AC 8", "YYZ", "BOS", "Embraer E175"),
    P("2026-04-30", "B6 615", "BOS", "MIA", "Airbus A220-300"), P("2026-05-03", "B6 616", "MIA", "BOS", "Airbus A220-300"),
    P("2026-01-18", "DL 2310", "BOS", "ATL", "Boeing 737-900ER"), P("2026-01-21", "DL 2311", "ATL", "BOS", "Boeing 737-900ER"),
  ],
  tailstrike: [
    P("2026-10-10", "UA 1922", "LAX", "SFO", "Airbus A320"), P("2026-10-12", "UA 1923", "SFO", "LAX", "Airbus A320"),
    P("2026-08-14", "WN 1801", "LAX", "DEN", "Boeing 737-800", "10:10 AM"), P("2026-08-17", "WN 1802", "DEN", "LAX", "Boeing 737-800"),
    P("2026-05-01", "AS 330", "LAX", "SEA", "Boeing 737-900"), P("2026-05-04", "AS 331", "SEA", "LAX", "Boeing 737-900"),
  ],
  heavyhauler: [
    P("2026-09-12", "AA 100", "JFK", "LHR", "Boeing 777-300ER", "7:30 PM"), P("2026-09-19", "AA 101", "LHR", "JFK", "Boeing 777-300ER"),
    P("2026-06-03", "AF 11", "JFK", "CDG", "Airbus A350-900"), P("2026-06-10", "AF 10", "CDG", "JFK", "Airbus A350-900"),
    P("2026-02-02", "DL 1", "JFK", "LHR", "Airbus A330-900"), P("2026-02-09", "DL 2", "LHR", "JFK", "Airbus A330-900"),
  ],
  squawk7700: [
    P("2026-09-05", "AS 22", "SEA", "HNL", "Boeing 737-900ER"), P("2026-09-12", "AS 23", "HNL", "SEA", "Boeing 737-900ER"),
    P("2026-06-20", "AS 340", "SEA", "SFO", "Boeing 737-900"), P("2026-06-22", "AS 341", "SFO", "SEA", "Boeing 737-900"),
  ],
};

/** Flights they have coming up, in days from today. */
export const FRIEND_UPCOMING: Record<string, UpcomingFlight[]> = {
  skyler: [U(6, "UA 1920", "SFO", "LAX", "Airbus A320", "8:30 AM"), U(24, "AS 22", "SFO", "HNL", "Boeing 737-900ER", "9:15 AM")],
  "maya.flies": [U(12, "DL 2400", "ATL", "DFW", "Boeing 737-900ER", "7:40 AM"), U(20, "DL 2401", "DFW", "ATL", "Boeing 737-900ER", "6:05 PM")],
  // tomorrow: a connection (DEN → SFO → NRT), so their page shows a "Flying soon" strip too
  jetjunkie: [U(1, "UA 520", "DEN", "SFO", "Boeing 737-900", "9:10 AM"), U(1, "UA 837", "SFO", "NRT", "Boeing 777-300ER", "1:15 PM"), U(30, "UA 640", "DEN", "ORD", "Airbus A320", "7:00 AM")],
  rwy28l: [U(4, "B6 1706", "BOS", "ORD", "Airbus A220-300", "6:45 AM"), U(8, "B6 1707", "ORD", "BOS", "Airbus A220-300", "4:20 PM")],
  tailstrike: [U(15, "UA 1922", "LAX", "SFO", "Airbus A320")],
  heavyhauler: [U(40, "AA 100", "JFK", "LHR", "Boeing 777-300ER", "7:30 PM")],
  squawk7700: [],
};

/** Airports a friend has been to (from the flights above, plus their in-flight route). */
export function friendVisited(f: Pick<Friend, "username" | "live">): string[] {
  const codes = (FRIEND_PAST[f.username] ?? []).flatMap((x) => [x.from, x.to]);
  if (f.live) codes.push(f.live.from, f.live.to);
  return [...new Set(codes)];
}

/** "UA 838 · Oct 14" for the most recent flight they took. */
export function friendLastFlight(username: string): string | undefined {
  const last = [...(FRIEND_PAST[username] ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return undefined;
  const d = new Date(last.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${last.number ?? `${last.from} → ${last.to}`} · ${d}`;
}

export const PENDING_INCOMING = [DIRECTORY[1]];

export type NewsItem = {
  id: string;
  kind: "headline" | "alert" | "report";
  title: string;
  summary: string;
  source: string;
  when: string;
  tags: string[]; // airport codes or airline names
  severity?: "info" | "delay" | "stop";
  author?: string;
  helpful?: number;
};

export const NEWS: NewsItem[] = [
  { id: "n1", kind: "alert", severity: "stop", title: "Ground stop: EWR", summary: "Arrivals into Newark held due to thunderstorms. Next update expected within the hour.", source: "FAA NAS Status", when: "12 min ago", tags: ["EWR", "JFK"] },
  { id: "n2", kind: "alert", severity: "delay", title: "Departure delays: ORD", summary: "Average departure delay about 45 minutes due to low ceilings and reduced arrival rates.", source: "FAA NAS Status", when: "28 min ago", tags: ["ORD"] },
  { id: "n3", kind: "alert", severity: "info", title: "SFO: marine layer, IFR conditions", summary: "Ceilings near 600 ft, visibility 3 mi. Expect arrival spacing on the visual approaches to be suspended.", source: "aviationweather.gov", when: "41 min ago", tags: ["SFO"] },
  { id: "n4", kind: "headline", title: "Airline orders another batch of widebodies for long-haul growth", summary: "The order adds to an already deep backlog and targets routes between North America and Asia starting later this decade.", source: "Skyline Daily", when: "2 h ago", tags: ["United", "Boeing"] },
  { id: "n5", kind: "headline", title: "Regional carrier retires its last turboprop on mainline routes", summary: "The type flew its final scheduled leg this week after more than two decades of service.", source: "The Hangar Report", when: "5 h ago", tags: ["Delta"] },
  { id: "n6", kind: "headline", title: "Airport unveils expanded terminal with 12 new gates", summary: "The expansion adds capacity ahead of the winter peak and includes new international processing.", source: "Skyline Daily", when: "Yesterday", tags: ["DEN"] },
  { id: "n7", kind: "headline", title: "Engineers test sustainable fuel blend on a transatlantic route", summary: "Early results suggest no measurable change in performance at cruise.", source: "The Hangar Report", when: "Yesterday", tags: ["LHR", "JFK"] },
  { id: "n8", helpful: 14, kind: "report", title: "Rare visitor: Antonov An-124 on final into ORD", summary: "Heavy lift freighter just landed on 28C. Gear and flaps looked great, huge crowd on the hill.", source: "User report", author: "@rwy28l", when: "35 min ago", tags: ["ORD"] },
  { id: "n9", helpful: 9, kind: "report", title: "AA 100 diverted to BOS", summary: "Flight from JFK is on the ground at Boston after a medical diversion. Crew handled it well.", source: "User report", author: "@skyler", when: "1 h ago", tags: ["JFK", "BOS", "American"] },
  { id: "n10", helpful: 5, kind: "report", title: "Livery spotted: retro paint scheme at ATL", summary: "Gate B12, a 737 in the heritage livery. Ground crew say it flies to LAX at 4pm.", source: "User report", author: "@maya.flies", when: "3 h ago", tags: ["ATL", "Delta"] },
];

// ---- derived stats -------------------------------------------------------

export function flightMiles(f: Flight) {
  return distanceMiles(AIRPORTS[f.from].lngLat, AIRPORTS[f.to].lngLat);
}

export const USER = {
  name: "USER, TEST",
  username: "test",
  home: "Chicago",
  joined: "Nov 2026",
};

// ---- detail breakdowns ---------------------------------------------------

export function flightHours(f: Flight) {
  return flightMiles(f) / 480 + 0.5;
}

/** Every airport that serves a metro area, e.g. "Chicago" -> ORD, MDW. */
export const airportsInMetro = (metro: string) =>
  Object.values(AIRPORTS).filter((a) => a.metro === metro).map((a) => a.code);

/** Airports within `miles` of a point, nearest first. */
export function airportsNear(lat: number, lon: number, miles = 120) {
  return Object.values(AIRPORTS)
    .map((a) => ({ code: a.code, d: distanceMiles([lon, lat], a.lngLat) }))
    .filter((a) => a.d <= miles)
    .sort((a, b) => a.d - b.d)
    .map((a) => a.code);
}
