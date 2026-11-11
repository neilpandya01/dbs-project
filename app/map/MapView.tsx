"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FlightMap } from "@/components/FlightMapLazy";
import type { MapAirport, MapPlane, MapRoute } from "@/components/FlightMap";
import { AIRPORT_COLORS } from "@/lib/mapColors";
import { useNow } from "@/components/useNow";
import { fmtDate, isPast } from "@/lib/itinerary";
import { useFlights } from "@/lib/flightsStore";
import { AIRPORTS, FRIENDS, flightMiles, friendVisited, type Flight } from "@/lib/mock";

type Mode = "all" | "mine" | "friends" | "starred";

type Item = {
  id: string;
  kind: "mine" | "friend";
  title: string; // route
  sub: string;
  number: string;
  from: string;
  to: string;
  color: string;
  owner: string;
  live?: { progress: number; altitudeFt: number; speedKts: number; aircraft: string };
  miles: number;
  search: string;
};

const MINE_COLOR = "#1f7ff0";

function buildItems(myFlights: Flight[]): Item[] {
  return [
  ...FRIENDS.filter((f) => f.live).map<Item>((f) => ({
    id: `live-${f.username}`,
    kind: "friend",
    title: `${f.live!.from} → ${f.live!.to}`,
    sub: `${f.live!.number} · ${f.live!.aircraft}`,
    number: f.live!.number,
    from: f.live!.from,
    to: f.live!.to,
    color: f.color,
    owner: f.name,
    live: f.live,
    miles: Math.round(flightMiles({ from: f.live!.from, to: f.live!.to } as never)),
    search: `${f.name} ${f.username} ${f.live!.number} ${f.live!.from} ${f.live!.to} ${f.live!.aircraft}`.toLowerCase(),
  })),
  ...[...myFlights]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map<Item>((f) => ({
      id: f.id,
      kind: "mine",
      title: `${f.from} → ${f.to}`,
      sub: [f.number, fmtDate(f.date)].filter(Boolean).join(" · "),
      number: f.number ?? `${f.from}–${f.to}`,
      from: f.from,
      to: f.to,
      color: MINE_COLOR,
      owner: "You",
      miles: Math.round(flightMiles(f)),
      search: `${f.number ?? ""} ${f.from} ${f.to} ${f.airline ?? ""} ${f.aircraft ?? ""} ${AIRPORTS[f.from].city} ${AIRPORTS[f.to].city}`.toLowerCase(),
    })),
];
}

export function MapView() {
  const { flights } = useFlights();
  const now = useNow() ?? new Date();
  // the map is your history: only flights that have landed
  const myFlights = useMemo(() => flights.filter((f) => isPast(f, now)), [flights, now]);
  const ITEMS = useMemo(() => buildItems(myFlights), [myFlights]);
  const [mode, setMode] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelectedRaw] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [airport, setAirport] = useState<string | null>(null);
  const setSelected = (id: string | null) => {
    setSelectedRaw(id);
    if (id) { setOpen(false); setAirport(null); } // phones: tuck the list away to show the flight
  };
  const [starred, setStarred] = useState<Set<string>>(new Set(["f1", "live-skyler"]));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEMS.filter((i) => {
      if (mode === "mine" && i.kind !== "mine") return false;
      if (mode === "friends" && i.kind !== "friend") return false;
      if (mode === "starred" && !starred.has(i.id)) return false;
      return !q || i.search.includes(q);
    });
  }, [ITEMS, mode, query, starred]);

  const routes: MapRoute[] = visible.map((i) => ({
    id: i.id,
    from: i.from,
    to: i.to,
    color: i.color,
    highlight: i.id === selected || starred.has(i.id),
    progress: i.live?.progress,
  }));
  const planes: MapPlane[] = visible
    .filter((i) => i.live)
    .map((i) => ({ id: i.id, label: i.owner.split(" ")[0], name: i.owner, color: i.color, from: i.from, to: i.to, progress: i.live!.progress }));

  // who has been to each airport
  const visits = useMemo(() => {
    const m = new Map<string, { me: number; friends: string[] }>();
    const get = (c: string) => m.get(c) ?? m.set(c, { me: 0, friends: [] }).get(c)!;
    for (const f of myFlights) { get(f.from).me++; get(f.to).me++; }
    for (const fr of FRIENDS) for (const c of friendVisited(fr)) if (!get(c).friends.includes(fr.name)) get(c).friends.push(fr.name);
    return m;
  }, [myFlights]);

  const airports: MapAirport[] = useMemo(() => {
    const out: MapAirport[] = [];
    for (const [code, v] of visits) {
      const me = v.me > 0 && mode !== "friends";
      const fr = v.friends.length > 0 && mode !== "mine";
      if (me && fr) out.push({ code, kind: "both" });
      else if (me) out.push({ code, kind: "me" });
      else if (fr) out.push({ code, kind: "friend" });
    }
    return out;
  }, [visits, mode]);

  const pickAirport = (code: string) => {
    setSelectedRaw(null);
    setAirport(code);
    setOpen(false);
  };
  const apt = airport ? { code: airport, info: AIRPORTS[airport], v: visits.get(airport)! } : null;

  const sel = ITEMS.find((i) => i.id === selected);
  const focus = sel ? { from: sel.from, to: sel.to } : null;

  const toggleStar = (id: string) =>
    setStarred((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="map-layout">
      <aside className="card map-panel" data-open={open} aria-label="Flights to track">
        <button className="sheet-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Collapse flight list" : "Expand flight list"}><i /></button>
        <div className="tabs" role="group" aria-label="Filter">
          {(["all", "mine", "friends", "starred"] as Mode[]).map((m) => (
            <button key={m} className="tab" aria-pressed={mode === m} onClick={() => { setMode(m); setOpen(true); }}>
              {{ all: "All", mine: "My flights", friends: "Friends live", starred: "★ Tracked" }[m]}
            </button>
          ))}
        </div>
        <input
          className="input search"
          style={{ marginTop: 10 }}
          type="search"
          placeholder="Search flight, airport, friend…"
          aria-label="Search flights"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="list">
          {visible.length === 0 && <p className="muted" style={{ textAlign: "center", marginTop: 28 }}>No flights match.</p>}
          {visible.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center" }}>
              <button className="track-item" aria-pressed={selected === i.id} onClick={() => setSelected(selected === i.id ? null : i.id)}>
                <Avatar name={i.owner} color={i.color} size={34} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b className="mono" style={{ fontSize: 14 }}>{i.title}</b>
                  <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                    {i.owner === "You" ? "" : `${i.owner} · `}{i.sub}
                  </span>
                </span>
                {i.live && <span className="badge good"><span className="dot pulse" />Live</span>}
              </button>
              <button
                className="star"
                aria-pressed={starred.has(i.id)}
                aria-label={starred.has(i.id) ? `Stop tracking ${i.number}` : `Track ${i.number}`}
                onClick={() => toggleStar(i.id)}
              >
                {starred.has(i.id) ? "★" : "☆"}
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="map-box">
        <FlightMap routes={routes} planes={planes} selectedPlane={selected} onSelectPlane={setSelected} airports={airports} onSelectAirport={pickAirport} focus={focus} />
        <ul className="map-legend" aria-label="Airport legend">
          <li><i style={{ background: AIRPORT_COLORS.me }} />You</li>
          <li><i style={{ background: AIRPORT_COLORS.friend }} />Friends</li>
          <li><i style={{ background: AIRPORT_COLORS.both }} />Both</li>
        </ul>
        {apt && (
          <div className="card map-overlay">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <b className="mono">{apt.code} · {apt.info.city}</b>
                <div className="muted" style={{ fontSize: 13 }}>{apt.info.country}</div>
              </div>
              <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setAirport(null)} aria-label="Close details">✕</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 14, display: "grid", gap: 4 }}>
              {apt.v.me > 0 && <span><b>You</b> · {apt.v.me} visit{apt.v.me > 1 ? "s" : ""}</span>}
              {apt.v.friends.length > 0 && <span><b>Friends</b> · {apt.v.friends.join(", ")}</span>}
            </div>
          </div>
        )}
        {sel && !apt && (
          <div className="card map-overlay">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <b className="mono">{AIRPORTS[sel.from].city} → {AIRPORTS[sel.to].city}</b>
                <div className="muted" style={{ fontSize: 13 }}>{sel.owner === "You" ? "You" : sel.owner} · {sel.sub}</div>
              </div>
              <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setSelected(null)} aria-label="Close details">✕</button>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 13, flexWrap: "wrap" }}>
              <span><b>{sel.miles.toLocaleString()}</b> mi</span>
              {sel.live ? (
                <>
                  <span><b>{sel.live.altitudeFt.toLocaleString()}</b> ft</span>
                  <span><b>{sel.live.speedKts}</b> kts</span>
                  <span><b>{Math.round(sel.live.progress * 100)}%</b> there</span>
                </>
              ) : (
                <span className="muted">Completed flight</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
