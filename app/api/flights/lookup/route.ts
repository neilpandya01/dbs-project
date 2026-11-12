import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LookupFlight, LookupResult, LookupStatus } from "@/lib/lookupTypes";

/**
 * Flight lookup by flight number + date, using AeroDataBox (via RapidAPI).
 *
 *   GET  -> { available, reason? }          is lookup switched on for this person right now?
 *   POST { number, date } -> LookupResult   the matching flights, "none", "unavailable" or "error"
 *
 * Why this lives on the server: the API key must never reach the browser, and every call spends from a
 * small shared free allowance. So before calling the API we (1) require a signed-in user, (2) validate the
 * input, (3) answer from the cache if we can, (4) stop once 95% of the allowance is used, and (5) give each
 * person a daily number of real lookups. After every call we record how much allowance is left, from the
 * rate-limit headers RapidAPI sends back.
 */

const PROVIDER = "aerodatabox";
const HOST = "aerodatabox.p.rapidapi.com";
const STOP_AT_USED = 0.95; // stop lookups when this much of the allowance is used
const PER_USER_PER_DAY = 10;
const WINDOW_DAYS = 365; // the API covers about a year either side of today
const TTL_PAST_MS = 30 * 24 * 3600_000;
const TTL_FUTURE_MS = 3 * 3600_000;
const TTL_NONE_MS = 30 * 60_000;

type Reason = NonNullable<LookupStatus["reason"]>;

const json = (body: LookupResult | LookupStatus | { error: string }, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Why lookups are off for this person right now, or null if they're on. Never calls the API. */
async function blockedReason(userId: string): Promise<Reason | null> {
  if (!process.env.RAPIDAPI_KEY) return "not_configured";
  const db = supabaseAdmin();
  const { data: q } = await db.from("api_quota").select("units_limit,units_remaining").eq("provider", PROVIDER).maybeSingle();
  if (q && q.units_limit > 0 && q.units_remaining <= Math.ceil(q.units_limit * (1 - STOP_AT_USED))) return "quota";
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db.from("flight_lookup_log").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= PER_USER_PER_DAY) return "user_limit";
  return null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return json({ error: "Sign in first" }, 401);
  try {
    const reason = await blockedReason(userId);
    return json(reason ? { available: false, reason } : { available: true });
  } catch {
    return json({ available: false, reason: "not_configured" });
  }
}

/** "ua 2679" -> "UA2679", or null if it doesn't look like a flight number. */
function cleanNumber(raw: unknown) {
  if (typeof raw !== "string") return null;
  const v = raw.toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(v) ? v : null;
}

/** A real calendar date within a year of today, or null. */
function cleanDate(raw: unknown) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const t = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== raw) return null;
  return Math.abs(t - Date.now()) <= (WINDOW_DAYS + 1) * 86_400_000 ? raw : null;
}

/** "2026-10-11 17:15-04:00" -> "5:15 PM" */
function clock(local?: string) {
  const m = /\s(\d{2}):(\d{2})/.exec(local ?? "");
  if (!m) return undefined;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** "2026-10-11 21:15Z" -> "2026-10-11T21:15:00.000Z", or undefined if it isn't a real moment. */
function utcIso(utc?: string) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})Z$/.exec(utc ?? "");
  if (!m) return undefined;
  const t = Date.parse(`${m[1]}T${m[2]}:00Z`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/** Only keep a time zone name the runtime recognises (like "America/New_York"). */
function zone(tz?: string) {
  if (!tz || tz.length > 64) return undefined;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return undefined; }
}

type Raw = {
  number?: string;
  codeshareStatus?: string;
  departure?: { airport?: { iata?: string; municipalityName?: string; timeZone?: string }; scheduledTime?: { local?: string; utc?: string } };
  arrival?: { airport?: { iata?: string; municipalityName?: string; timeZone?: string }; scheduledTime?: { local?: string; utc?: string } };
  aircraft?: { reg?: string; model?: string };
  airline?: { name?: string };
};

/** AeroDataBox's answer -> our shape. Codeshare duplicates are dropped; legs missing an airport code are skipped. */
function normalize(raw: unknown): LookupFlight[] {
  if (!Array.isArray(raw)) return [];
  const all = raw as Raw[];
  const operated = all.filter((f) => f.codeshareStatus === "IsOperator");
  const out: LookupFlight[] = [];
  for (const f of operated.length ? operated : all) {
    const from = f.departure?.airport?.iata, to = f.arrival?.airport?.iata;
    if (!from || !to) continue;
    out.push({
      number: String(f.number ?? "").slice(0, 12),
      airline: f.airline?.name?.slice(0, 60),
      aircraft: f.aircraft?.model?.slice(0, 60),
      registration: f.aircraft?.reg?.slice(0, 12),
      from, to,
      fromCity: f.departure?.airport?.municipalityName,
      toCity: f.arrival?.airport?.municipalityName,
      depTime: clock(f.departure?.scheduledTime?.local),
      arrTime: clock(f.arrival?.scheduledTime?.local),
      depAt: utcIso(f.departure?.scheduledTime?.utc),
      arrAt: utcIso(f.arrival?.scheduledTime?.utc),
      depTz: zone(f.departure?.airport?.timeZone),
      arrTz: zone(f.arrival?.airport?.timeZone),
    });
  }
  return out;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return json({ error: "Sign in first" }, 401);

  let body: { number?: unknown; date?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const number = cleanNumber(body.number);
  const date = cleanDate(body.date);
  if (!number) return json({ error: "Enter a flight number like UA 2679." }, 400);
  if (!date) return json({ error: "Pick a date within a year of today." }, 400);

  try {
    const db = supabaseAdmin();
    const key = `v2|${number}|${date}`; // v2: results now include exact times and time zones

    // 1. cache: free, so it comes before every limit
    const { data: hit } = await db.from("flight_lookup_cache").select("found,payload").eq("cache_key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (hit) return json(hit.found ? { status: "ok", flights: hit.payload as LookupFlight[] } : { status: "none" });

    // 2. allowance and per-person limit
    const blocked = await blockedReason(userId);
    if (blocked) return json({ status: "unavailable", reason: blocked });

    // 3. the real call (fixed host; number and date are validated above)
    const url = `https://${HOST}/flights/number/${number}/${date}?dateLocalRole=Departure`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!, "X-RapidAPI-Host": HOST },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    } catch {
      return json({ status: "error", message: "The flight lookup timed out." });
    }

    // 4. remember what's left of the allowance (RapidAPI reports it on every response)
    const limit = Number(res.headers.get("x-ratelimit-api-units-limit"));
    const left = Number(res.headers.get("x-ratelimit-api-units-remaining"));
    if (res.headers.get("x-ratelimit-api-units-limit") && Number.isFinite(limit) && Number.isFinite(left)) {
      await db.from("api_quota").upsert({ provider: PROVIDER, units_limit: limit, units_remaining: left, updated_at: new Date().toISOString() });
    }

    if (res.status === 429) return json({ status: "unavailable", reason: "quota" });
    const empty = res.status === 204 || res.status === 404;
    if (!res.ok && !empty) return json({ status: "error", message: "The flight lookup isn't working right now." });

    // the API answered, so this counts toward the person's daily allowance
    await db.from("flight_lookup_log").insert({ user_id: userId });

    const flights = empty ? [] : normalize(await res.json().catch(() => []));
    const isPast = date < new Date().toISOString().slice(0, 10);
    const ttl = flights.length === 0 ? TTL_NONE_MS : isPast ? TTL_PAST_MS : TTL_FUTURE_MS;
    await db.from("flight_lookup_cache").upsert({ cache_key: key, found: flights.length > 0, payload: flights, expires_at: new Date(Date.now() + ttl).toISOString() });

    return json(flights.length ? { status: "ok", flights } : { status: "none" });
  } catch {
    return json({ status: "error", message: "The flight lookup isn't working right now." });
  }
}
