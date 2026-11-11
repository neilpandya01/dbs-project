"use client";

import { useEffect, useState } from "react";
import { AIRPORTS, type Airport } from "./core";
import { useMe } from "./useMe";
import { useSupabase } from "./supabase";

const CACHE_KEY = "wingmates.airports.v2"; // reference data only (no personal information)

type Row = { code: string; name: string; city: string; country: string; country_code: string; continent: string; lat: number; lon: number; kind: Airport["kind"] };

function register(rows: Row[]) {
  for (const r of rows) {
    const a: Airport = { code: r.code, name: r.name, city: r.city, country: r.country, countryCode: r.country_code, continent: r.continent, kind: r.kind, lngLat: [r.lon, r.lat] };
    AIRPORTS[r.code] = a;
  }
}

/**
 * Loads the airport list from Supabase before showing the app, so every screen can look airports up
 * instantly. A copy is kept in the browser so later visits start immediately and refresh quietly.
 */
export function AirportsProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const supabase = useSupabase();
  const [ready, setReady] = useState(Object.keys(AIRPORTS).length > 0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!me.id) return;
    let alive = true;

    // 1. the saved copy, if any, lets the app open right away
    if (!ready) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          register(JSON.parse(cached) as Row[]);
          setReady(true);
        }
      } catch {}
    }

    // 2. the fresh list from Supabase (1000 rows per request)
    (async () => {
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("airports").select("code,name,city,country,country_code,continent,lat,lon,kind").order("code").range(from, from + 999);
        if (error) { if (alive && Object.keys(AIRPORTS).length === 0) setError(error.message); return; }
        rows.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (!alive || rows.length === 0) return;
      register(rows);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch {}
      setError(null);
      setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, supabase, attempt]);

  if (!ready) {
    return (
      <div className="boot" role="status">
        {error ? (
          <>
            <b>Couldn’t load the airport list</b>
            <p className="muted">{error}</p>
            <button className="btn primary" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</button>
          </>
        ) : (
          <span>Loading Wingmates…</span>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

/** All airports, sorted by code (for pickers and search). */
export const airportList = () => Object.values(AIRPORTS).sort((a, b) => a.code.localeCompare(b.code));
