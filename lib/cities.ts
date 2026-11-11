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

type Feature = { geometry: { coordinates: [number, number] }; properties: { name?: string; state?: string; country?: string; countrycode?: string } };

/**
 * Search cities and towns worldwide. Uses the free Photon geocoder (OpenStreetMap data), which is
 * built for search-as-you-type. "west hartford, ct" and "west hartford" both find West Hartford, CT.
 */
export async function searchCities(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("layer", "city");
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", "8");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const data = (await res.json()) as { features: Feature[] };

  const seen = new Set<string>();
  const out: Place[] = [];
  for (const f of data.features) {
    const { name, state, country, countrycode } = f.properties;
    if (!name) continue;
    const region = countrycode === "US" && state ? US_STATES[state] ?? state : state;
    const label = countrycode === "US" ? `${name}, ${region ?? "United States"}` : [name, region, country].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] });
  }
  return out;
}
