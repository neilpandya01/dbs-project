// Loads airports with a 3-letter airline code and scheduled service into Supabase `airports`.
// Data: OurAirports (public domain), https://ourairports.com/data/
// Run:  npm run import:airports      (uses the service key from your env; prints no secrets; safe to re-run)
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SVC) {
  console.log("Missing Supabase variables. Run `npm run check:supabase` first.");
  process.exit(2);
}
const db = createClient(URL_, SVC, { auth: { persistSession: false } });

/** Minimal CSV parser (handles quoted fields, commas and doubled quotes inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const get = async (file) => {
  const res = await fetch(`https://davidmegginson.github.io/ourairports-data/${file}`);
  if (!res.ok) throw new Error(`download ${file} failed (${res.status})`);
  return parseCsv(await res.text());
};

const [airports, countries] = await Promise.all([get("airports.csv"), get("countries.csv")]);
const countryName = Object.fromEntries(countries.map((c) => [c.code, c.name]));
const KIND = { large_airport: "large", medium_airport: "medium", small_airport: "small" };
const CONTINENT = { AF: "Africa", AN: "Antarctica", AS: "Asia", EU: "Europe", NA: "North America", OC: "Oceania", SA: "South America" };

const rows = airports
  .filter((a) => a.iata_code && KIND[a.type] && a.scheduled_service === "yes")
  .map((a) => ({
    code: a.iata_code.toUpperCase(),
    name: a.name,
    city: a.municipality || a.name,
    country: countryName[a.iso_country] ?? a.iso_country,
    country_code: a.iso_country,
    continent: CONTINENT[a.continent] ?? a.continent,
    lat: Number(a.latitude_deg),
    lon: Number(a.longitude_deg),
    kind: KIND[a.type],
  }))
  .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));

console.log(`Importing ${rows.length} airports…`);
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from("airports").upsert(rows.slice(i, i + 500), { onConflict: "code" });
  if (error) {
    console.log(`✗ failed at row ${i}: ${error.message}`);
    process.exit(1);
  }
}
const { count } = await db.from("airports").select("code", { count: "exact", head: true });
console.log(`✓ done. The airports table now has ${count} rows.`);
