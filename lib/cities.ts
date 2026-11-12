export type Place = { label: string; lat: number; lon: number };

const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA",
  Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

type Result = { name?: string; latitude: number; longitude: number; admin1?: string; country?: string; country_code?: string; feature_code?: string };

/**
 * Search cities and towns worldwide with the free Open-Meteo geocoding API (GeoNames data; no key, built
 * for search-as-you-type). "west hartford, ct" and "west hartford" both find West Hartford, CT: the part
 * after a comma narrows the results to that state, region or country.
 */
export async function searchCities(query: string, signal?: AbortSignal): Promise<Place[]> {
  const [namePart, ...rest] = query.split(",");
  const name = namePart.trim();
  const region = rest.join(",").trim().toLowerCase();
  if (name.length < 2) return [];

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("language", "en");
  url.searchParams.set("count", region ? "30" : "10");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const data = (await res.json()) as { results?: Result[] };

  const seen = new Set<string>();
  const out: Place[] = [];
  for (const r of data.results ?? []) {
    if (!r.name) continue;
    const abbr = r.country_code === "US" && r.admin1 ? US_STATES[r.admin1] : undefined;
    if (region && ![r.admin1, abbr, r.country, r.country_code].some((x) => x?.toLowerCase().startsWith(region))) continue;
    const label = r.country_code === "US" ? `${r.name}, ${abbr ?? r.admin1 ?? "United States"}` : [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat: r.latitude, lon: r.longitude });
    if (out.length === 8) break;
  }
  return out;
}
