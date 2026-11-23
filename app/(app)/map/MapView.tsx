"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FlightMap } from "@/components/FlightMapLazy";
import type { MapAirport, MapPlane, MapRoute } from "@/components/FlightMap";
import { AIRPORT_COLORS } from "@/lib/mapColors";
import { useNow } from "@/components/useNow";
import { AIRPORTS, flightMiles, type Flight } from "@/lib/core";
import { fmtDate, isPast, toLeg } from "@/lib/itinerary";
import { useFlights } from "@/lib/flightsStore";
import { useFriends } from "@/lib/friendsStore";
import { liveFlight } from "@/lib/live";
import { useLivePositions, type LivePos } from "@/lib/livePositions";
import { distanceMiles } from "@/lib/geo";

type Mode = "all" | "mine" | "friends";

/** "12s ago", "3 min ago"... for a moment in time, ticking every few seconds. Turns amber when it's getting stale. */
function Ago({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  const text = s < 10 ? "just now" : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
  return <span className={s > 120 ? "ago stale" : "ago"} title="When this position was last received">updated {text}</span>;
}

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
  /** On its way right now: how far along (by schedule) and when it lands. */
  live?: { progress: number; lands?: string; real?: LivePos };
  miles: number;
  search: string;
};

const MINE_COLOR = "#1f7ff0";

const searchText = (f: Flight, who: string) =>
  `${who} ${f.number ?? ""} ${f.from} ${f.to} ${f.airline ?? ""} ${f.aircraft ?? ""} ${AIRPORTS[f.from]?.city ?? ""} ${AIRPORTS[f.to]?.city ?? ""}`.toLowerCase();

type LiveEntry = { name: string; username: string; color: string; flight: Flight; progress: number; real?: LivePos };

/** How far along the route a real position is: the share of the (from -> here -> to) distance already flown. */
function progressOf(f: Flight, p: LivePos) {
  const here: [number, number] = [p.lon, p.lat];
  const a = distanceMiles(AIRPORTS[f.from].lngLat, here), b = distanceMiles(here, AIRPORTS[f.to].lngLat);
  return a + b > 0 ? Math.min(0.98, Math.max(0.02, a / (a + b))) : 0.5;
}

function buildItems(myFlights: Flight[], friendLive: LiveEntry[]): Item[] {
  return [
    ...friendLive.map<Item>((l) => ({
      id: l.flight.id,
      kind: "friend",
      title: `${l.flight.from} → ${l.flight.to}`,
      sub: [l.flight.number, l.flight.aircraft].filter(Boolean).join(" · ") || "In flight",
      number: l.flight.number ?? `${l.flight.from}–${l.flight.to}`,
      from: l.flight.from,
      to: l.flight.to,
      color: l.color,
      owner: l.name,
      live: { progress: l.progress, lands: toLeg(l.flight).arrText, real: l.real },
      miles: Math.round(flightMiles(l.flight)),
      search: searchText(l.flight, `${l.name} ${l.username}`),
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
        search: searchText(f, ""),
      })),
  ];
}

export function MapView() {
  const { flights } = useFlights();
  const { friends, flightsOf } = useFriends();
  const now = useNow() ?? new Date();
  const real = useLivePositions(true); // also tells the tracker you're watching, so it follows these flights
  // the map is your history: only flights that have landed
  const myFlights = useMemo(() => flights.filter((f) => isPast(f, now)), [flights, now]);
  // Friends in the air right now: a real position from the live tracker when there is one, otherwise the
  // scheduled-time estimate (a plane that hasn't been picked up yet still shows, just by schedule).
  const friendLive = useMemo(
    () =>
      friends.flatMap((fr) => {
        const fl = flightsOf(fr.id);
        const tracked = fl.find((f) => real[f.id]);
        if (tracked) return [{ name: fr.name, username: fr.username, color: fr.color, flight: tracked, progress: progressOf(tracked, real[tracked.id]), real: real[tracked.id] }];
        const l = liveFlight(fl, now);
        return l ? [{ name: fr.name, username: fr.username, color: fr.color, flight: l.flight, progress: l.progress }] : [];
      }),
    [friends, flightsOf, now, real]
  );
  const ITEMS = useMemo(() => buildItems(myFlights, friendLive), [myFlights, friendLive]);
  const [mode, setMode] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelectedRaw] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [airport, setAirport] = useState<string | null>(null);
  const setSelected = (id: string | null) => {
    setSelectedRaw(id);
    if (id) { setOpen(false); setAirport(null); } // phones: tuck the list away to show the flight
  };
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEMS.filter((i) => {
      if (mode === "mine" && i.kind !== "mine") return false;
      if (mode === "friends" && i.kind !== "friend") return false;
      return !q || i.search.includes(q);
    });
  }, [ITEMS, mode, query]);

  const routes: MapRoute[] = visible.map((i) => ({
    id: i.id,
    from: i.from,
    to: i.to,
    color: i.color,
    highlight: i.id === selected,
    progress: i.live?.progress,
    pos: i.live?.real ? ([i.live.real.lon, i.live.real.lat] as [number, number]) : undefined,
  }));
  const planes: MapPlane[] = visible
    .filter((i) => i.live)
    .map((i) => ({
      id: i.id, label: i.owner.split(" ")[0], name: i.owner, color: i.color, from: i.from, to: i.to, progress: i.live!.progress,
      pos: i.live!.real ? ([i.live!.real.lon, i.live!.real.lat] as [number, number]) : undefined,
      heading: i.live!.real?.trackDeg ?? undefined,
    }));

  // who has been to each airport
  const visits = useMemo(() => {
    const m = new Map<string, { me: number; friends: string[] }>();
    const get = (c: string) => m.get(c) ?? m.set(c, { me: 0, friends: [] }).get(c)!;
    for (const f of myFlights) { get(f.from).me++; get(f.to).me++; }
    for (const fr of friends) {
      for (const f of flightsOf(fr.id).filter((x) => isPast(x, now))) {
        for (const c of [f.from, f.to]) if (!get(c).friends.includes(fr.name)) get(c).friends.push(fr.name);
      }
    }
    return m;
  }, [myFlights, friends, flightsOf, now]);

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
  const focus = sel ? { id: sel.id, from: sel.from, to: sel.to } : null;

  return (
    <div className="map-layout">
      <aside className="card map-panel" data-open={open} aria-label="Flights on the map">
        <button className="sheet-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Collapse flight list" : "Expand flight list"}><i /></button>
        <div className="tabs" role="group" aria-label="Filter">
          {(["all", "mine", "friends"] as Mode[]).map((m) => (
            <button key={m} className="tab" aria-pressed={mode === m} onClick={() => { setMode(m); setOpen(true); }}>
              {{ all: "All", mine: "My flights", friends: "Friends live" }[m]}
            </button>
          ))}
        </div>
        <input
          className="input search"
          style={{ marginTop: 10 }}
          type="search"
          placeholder="Search"
          aria-label="Search flights"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="list">
          {visible.length === 0 && (
            <p className="muted" style={{ textAlign: "center", marginTop: 28 }}>
              {ITEMS.length === 0 ? "Nothing to show yet. Add flights you've taken, and friends in the air appear here." : "No flights match."}
            </p>
          )}
          {visible.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center" }}>
              <button className="track-item" aria-pressed={selected === i.id} onClick={() => setSelected(selected === i.id ? null : i.id)}>
                <Avatar name={i.owner} color={i.color} size={34} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b className="mono" style={{ fontSize: 14 }}>{i.title}</b>
                  <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                    {i.owner === "You" ? "" : `${i.owner} · `}{i.sub}
                    {i.live?.real?.seenAt && <> · <Ago iso={i.live.real.seenAt} /></>}
                  </span>
                </span>
                {i.live && <span className="badge good"><span className="dot pulse" />Live</span>}
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
                  <span><b>{Math.round(sel.live.progress * 100)}%</b> there</span>
                  {sel.live.lands && <span>lands <b>{sel.live.lands}</b></span>}
                  {sel.live.real ? (
                    <span className="muted">
                      {[sel.live.real.altFt != null && `${sel.live.real.altFt.toLocaleString()} ft`, sel.live.real.speedKt != null && `${sel.live.real.speedKt} kt`].filter(Boolean).join(" · ")}
                      {sel.live.real.seenAt ? <>{" · "}<Ago iso={sel.live.real.seenAt} /></> : " · live position"}
                    </span>
                  ) : (
                    <span className="muted">by schedule</span>
                  )}
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
