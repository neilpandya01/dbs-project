"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlightMap } from "@/components/FlightMapLazy";
import type { MapAirport, MapRoute } from "@/components/FlightMap";
import { useNow } from "@/components/useNow";
import { AIRPORTS, flightHours, flightMiles } from "@/lib/core";
import { useFriends } from "@/lib/friendsStore";
import { fmtDate, isPast } from "@/lib/itinerary";
import { AIRPORT_COLORS } from "@/lib/mapColors";
import { useSheetDrag } from "@/lib/useSheetDrag";

const pairKey = (a: string, b: string) => [a, b].sort().join("-");
const fmtHours = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`; };

/**
 * A friend's own map: only the flights they've taken (and haven't hidden), with a list to go through them. It is
 * completely separate from your map: none of your flights and no live planes. Friends only (the database decides).
 */
export function FriendMapView({ username }: { username: string }) {
  const { friends, flightsOf, loading } = useFriends();
  const friend = friends.find((f) => f.username.toLowerCase() === username.toLowerCase());
  const now = useNow() ?? new Date();
  const [query, setQuery] = useState("");
  const [selected, setSelectedRaw] = useState<string | null>(null);
  const [airport, setAirport] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { panelRef, grab } = useSheetDrag(open, setOpen);

  const flights = useMemo(
    () => (friend ? flightsOf(friend.id).filter((f) => AIRPORTS[f.from] && AIRPORTS[f.to] && isPast(f, now)).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [friend, flightsOf, now]
  );
  const color = friend?.color && /^#[0-9a-f]{6}$/i.test(friend.color) ? friend.color : AIRPORT_COLORS.friend;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter((f) =>
      `${f.number ?? ""} ${f.from} ${f.to} ${f.airline ?? ""} ${f.aircraft ?? ""} ${AIRPORTS[f.from].city} ${AIRPORTS[f.to].city}`.toLowerCase().includes(q)
    );
  }, [flights, query]);

  const sel = flights.find((f) => f.id === selected);
  const selKey = sel ? pairKey(sel.from, sel.to) : null;
  const routes: MapRoute[] = useMemo(() => {
    const seen = new Set<string>();
    const out: MapRoute[] = [];
    for (const f of visible) {
      const k = pairKey(f.from, f.to);
      if (seen.has(k)) continue; // flying the same route five times is still one line
      seen.add(k);
      out.push({ id: f.id, from: f.from, to: f.to, color, highlight: k === selKey });
    }
    return out;
  }, [visible, color, selKey]);
  const airports: MapAirport[] = useMemo(
    () => [...new Set(visible.flatMap((f) => [f.from, f.to]))].map((code) => ({ code, kind: "friend" as const })),
    [visible]
  );

  const visits = useMemo(() => {
    const m = new Map<string, { n: number; last: string }>();
    for (const f of flights) for (const c of [f.from, f.to]) {
      const v = m.get(c) ?? { n: 0, last: "" };
      v.n++;
      if (f.date > v.last) v.last = f.date;
      m.set(c, v);
    }
    return m;
  }, [flights]);

  const setSelected = (id: string | null) => {
    setSelectedRaw(id);
    if (id) { setOpen(false); setAirport(null); }
  };
  const pickAirport = (code: string) => { setSelectedRaw(null); setAirport(code); setOpen(false); };
  const apt = airport && AIRPORTS[airport] ? { code: airport, info: AIRPORTS[airport], v: visits.get(airport) } : null;
  const first = friend?.name.split(" ")[0] ?? username;

  if (!friend) {
    if (loading) return <div className="loading-block" role="status">Loading…</div>;
    return (
      <div className="card empty" style={{ marginTop: 14 }}>
        <b>Only friends can see this map</b>
        <p className="muted">You can view @{username}’s flights once you’re friends.</p>
        <Link href={`/friends/${encodeURIComponent(username)}`} className="btn primary" style={{ textDecoration: "none", display: "inline-block" }}>Back to profile</Link>
      </div>
    );
  }

  return (
    <div className="map-layout">
      <aside className="card map-panel" ref={panelRef} data-open={open} aria-label={`${first}’s flights`}>
        <button className="sheet-handle" {...grab} aria-expanded={open} aria-label={open ? "Collapse flight list" : "Expand flight list"}><i /></button>
        <div className="friend-map-head">
          <Link href={`/friends/${encodeURIComponent(friend.username)}`} className="back-link" style={{ margin: 0 }}>‹ {first}’s profile</Link>
          <span className="muted">{flights.length === 1 ? "1 flight" : `${flights.length} flights`}</span>
        </div>
        <input className="input search" style={{ marginTop: 10 }} type="search" placeholder="Search their flights" aria-label="Search their flights" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="list">
          {visible.length === 0 && (
            <p className="muted" style={{ textAlign: "center", marginTop: 28 }}>{flights.length === 0 ? `${first} hasn’t logged any flights that are visible to you yet.` : "No flights match."}</p>
          )}
          {visible.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center" }}>
              <button className="track-item" aria-pressed={selected === f.id} onClick={() => setSelected(selected === f.id ? null : f.id)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b className="mono" style={{ fontSize: 14 }}>{f.from} → {f.to}</b>
                  <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{[f.number, f.airline, fmtDate(f.date)].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="map-box">
        <FlightMap routes={routes} selectedPlane={null} airports={airports} onSelectAirport={pickAirport} focus={sel ? { id: sel.id, from: sel.from, to: sel.to } : null} />
        <ul className="map-legend" aria-label="Map legend">
          <li><i style={{ background: AIRPORT_COLORS.friend }} /><i className="line" style={{ background: color }} />{first}’s flights</li>
        </ul>
        {apt && (
          <div className="card map-overlay detail-card" role="dialog" aria-label={`${apt.info.name} details`}>
            <span className="detail-grab" aria-hidden="true" />
            <div className="detail-head">
              <span className="detail-code mono">{apt.code}</span>
              <div className="detail-title">
                <b>{apt.info.name}</b>
                <span className="muted">{apt.info.city}, {apt.info.country}</span>
              </div>
              <button className="icon-btn" onClick={() => setAirport(null)} aria-label="Close details">✕</button>
            </div>
            {apt.v && (
              <div className="detail-rows">
                <div className="detail-row"><i style={{ background: AIRPORT_COLORS.friend }} /><span><b>{first}</b> · {apt.v.n} visit{apt.v.n > 1 ? "s" : ""}{apt.v.last && <span className="muted"> · last {fmtDate(apt.v.last)}</span>}</span></div>
              </div>
            )}
          </div>
        )}
        {sel && !apt && (
          <div className="card map-overlay detail-card" role="dialog" aria-label="Flight details">
            <span className="detail-grab" aria-hidden="true" />
            <div className="detail-head">
              <div className="detail-title">
                <b className="mono detail-route">{sel.from} → {sel.to}</b>
                <span className="muted">{AIRPORTS[sel.from].city} to {AIRPORTS[sel.to].city}</span>
                <span className="muted">{[sel.number, fmtDate(sel.date)].filter(Boolean).join(" · ")}</span>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close details">✕</button>
            </div>
            <div className="detail-stats">
              <div><b>{Math.round(flightMiles(sel)).toLocaleString()}</b><span>miles</span></div>
              <div><b>{fmtHours(flightHours(sel))}</b><span>est. flight time</span></div>
              {sel.airline && <div><b>{sel.airline}</b><span>airline</span></div>}
              {sel.aircraft && <div><b>{sel.aircraft}</b><span>aircraft</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
