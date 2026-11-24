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
import { useProfile } from "@/lib/profileStore";
import { liveFlight } from "@/lib/live";
import { useLivePositions, type LivePos } from "@/lib/livePositions";
import { bearing, distanceMiles } from "@/lib/geo";
import { livePhase, phaseLabel, routeProgress, type Phase } from "@/lib/liveDisplay";

type Mode = "all" | "mine" | "friends";

/**
 * "just now" for the first 5 seconds, then "6s ago", "7s ago"... every second until a minute, then changes once a
 * minute, exactly when the minute rolls over. Turns amber when it's getting stale.
 */
function Ago({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  const age = Math.max(0, now - Date.parse(iso));
  useEffect(() => {
    const wait = age < 60_000 ? 1000 : 60_000 - (age % 60_000) + 50;
    const id = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(id);
  }, [age]);
  const s = Math.floor(age / 1000);
  const text = s < 6 ? "just now" : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
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
  photo?: string | null;
  /** Friends who have also flown this route (either direction), for routes in your own history. */
  sharedWith: string[];
  /** The picture/initials shown next to the row: your own profile for your flights, the friend's for theirs. */
  face: { name: string; color: string; photo: string | null };
  /** On its way right now: how far along (from its real position) and its scheduled arrival. */
  live?: { progress: number; lands?: string; real: LivePos; phase: Phase };
  miles: number;
  search: string;
};

const MINE_COLOR = "#1f7ff0";

const searchText = (f: Flight, who: string) =>
  `${who} ${f.number ?? ""} ${f.from} ${f.to} ${f.airline ?? ""} ${f.aircraft ?? ""} ${AIRPORTS[f.from]?.city ?? ""} ${AIRPORTS[f.to]?.city ?? ""}`.toLowerCase();

type LiveEntry = { name: string; username: string; color: string; photo: string | null; flight: Flight; progress: number; real: LivePos; phase: Phase };

function progressOf(f: Flight, p: LivePos) {
  return routeProgress(AIRPORTS[f.from].lngLat, AIRPORTS[f.to].lngLat, [p.lon, p.lat]);
}

/** The same two airports in either direction count as one route. */
const pairKey = (a: string, b: string) => [a, b].sort().join("-");

function buildItems(myFlights: Flight[], friendLive: LiveEntry[], me: { name: string; color: string; photo: string | null }, shared: Map<string, string[]>): Item[] {
  return [
    ...friendLive.map<Item>((l) => ({
      id: l.flight.id,
      kind: "friend",
      title: `${l.flight.from} → ${l.flight.to}`,
      sub: [l.flight.number, l.flight.aircraft].filter(Boolean).join(" · ") || phaseLabel(l.phase, l.real),
      number: l.flight.number ?? `${l.flight.from}–${l.flight.to}`,
      from: l.flight.from,
      to: l.flight.to,
      color: l.color,
      owner: l.name,
      photo: l.photo,
      face: { name: l.name, color: l.color, photo: l.photo },
      sharedWith: [],
      live: { progress: l.progress, lands: toLeg(l.flight).arrText, real: l.real, phase: l.phase },
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
        // your own routes are blue, and purple when a friend has flown the same route
        color: shared.has(pairKey(f.from, f.to)) ? AIRPORT_COLORS.both : MINE_COLOR,
        owner: "You",
        face: me,
        sharedWith: shared.get(pairKey(f.from, f.to)) ?? [],
        miles: Math.round(flightMiles(f)),
        search: searchText(f, ""),
      })),
  ];
}

export function MapView() {
  const { flights } = useFlights();
  const { friends, flightsOf } = useFriends();
  const { profile } = useProfile();
  const now = useNow() ?? new Date();
  const { positions: real, down: trackingDown } = useLivePositions(true); // also tells the tracker you're watching, so it follows these flights
  // the map is your history: only flights that have landed
  const myFlights = useMemo(() => flights.filter((f) => isPast(f, now)), [flights, now]);
  const tick = useNow(5000) ?? new Date(); // re-checks every few seconds which positions have gone stale
  // Friends shown on the map: only where the tracker has a fresh, real position, and it makes sense for the stage:
  // at the departure airport, in flight, or at the arrival airport. A plane that went off radar is simply not shown,
  // and nothing is ever estimated from the schedule (that would show a delayed or cancelled flight as flying).
  const friendLive = useMemo(
    () =>
      friends.flatMap((fr) => {
        for (const flight of flightsOf(fr.id)) {
          const p = real[flight.id];
          if (!p) continue;
          const phase = livePhase(p, AIRPORTS[flight.from].lngLat, AIRPORTS[flight.to].lngLat, tick.getTime());
          if (phase) return [{ name: fr.name, username: fr.username, color: fr.color, photo: fr.photo, flight, phase, progress: phase === "airborne" ? progressOf(flight, p) : 0, real: p }];
        }
        return [];
      }),
    [friends, flightsOf, real, tick]
  );
  // Only used for the "can't load" notice below: a friend's flight is scheduled to be flying but isn't shown.
  const scheduledButUnseen = useMemo(
    () => friends.some((fr) => { const l = liveFlight(flightsOf(fr.id), now); return !!l && !friendLive.some((x) => x.flight.id === l.flight.id); }),
    [friends, flightsOf, now, friendLive]
  );
  // routes you share with friends: which friends have flown each route you have flown (friend-only routes are never drawn)
  const shared = useMemo(() => {
    const mine = new Set(myFlights.map((f) => pairKey(f.from, f.to)));
    const m = new Map<string, string[]>();
    for (const fr of friends) {
      for (const f of flightsOf(fr.id)) {
        const k = pairKey(f.from, f.to);
        if (!isPast(f, now) || !mine.has(k)) continue;
        const names = m.get(k) ?? [];
        if (!names.includes(fr.name)) m.set(k, [...names, fr.name]);
      }
    }
    return m;
  }, [myFlights, friends, flightsOf, now]);
  const ITEMS = useMemo(() => buildItems(myFlights, friendLive, { name: profile.name, color: profile.color, photo: profile.photo }, shared), [myFlights, friendLive, profile.name, profile.color, profile.photo, shared]);
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

  const routes: MapRoute[] = (() => {
    const out: MapRoute[] = [];
    const seen = new Set<string>();
    const selItem = selected ? ITEMS.find((x) => x.id === selected) : undefined;
    const selKey = selItem ? pairKey(selItem.from, selItem.to) : null;
    for (const i of visible) {
      if (i.live?.phase === "arrival") continue; // at the arrival airport the flight is over: no route
      if (i.kind === "mine") {
        const k = pairKey(i.from, i.to);
        if (seen.has(k)) continue; // flying ORD-LAX five times is still one line
        seen.add(k);
        out.push({ id: i.id, from: i.from, to: i.to, color: i.color, highlight: k === selKey });
      } else {
        out.push({
          id: i.id, from: i.from, to: i.to, color: i.color, highlight: i.id === selected,
          // in flight: solid to the plane, dotted onward. On the ground at the departure airport: only the dotted line
          // onward from where the plane is (it hasn't gone anywhere yet). Nothing at all once it has arrived.
          progress: i.live?.phase === "airborne" ? i.live.progress : undefined,
          pos: i.live ? ([i.live.real.lon, i.live.real.lat] as [number, number]) : undefined,
          aheadOnly: i.live?.phase === "departure",
        });
      }
    }
    return out;
  })();
  const planes: MapPlane[] = visible
    .filter((i) => i.live)
    .map((i) => ({
      id: i.id, label: i.owner.split(" ")[0], name: i.owner, color: i.color, photo: i.photo, from: i.from, to: i.to, progress: i.live!.progress,
      pos: [i.live!.real.lon, i.live!.real.lat] as [number, number],
      heading: bearing([i.live!.real.lon, i.live!.real.lat], AIRPORTS[i.to].lngLat),
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
  // a friend may be flying right now by schedule, but we can't show where the plane is
  const noLivePositions = trackingDown && scheduledButUnseen;
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
                <Avatar name={i.face.name || i.owner} color={i.face.color} src={i.face.photo} size={34} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b className="mono" style={{ fontSize: 14 }}>{i.title}</b>{i.kind === "mine" && <> <span className="badge accent">You</span></>}
                  <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                    {i.owner === "You" ? "" : `${i.owner} · `}{i.sub}
                    {i.live?.real?.seenAt && <> · <Ago iso={i.live.real.seenAt} /></>}
                  </span>
                </span>
                {i.live && <span className="badge good"><span className="dot pulse" />{phaseLabel(i.live.phase, i.live.real)}</span>}
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="map-box">
        {noLivePositions && (
          <div className="map-warn" role="status">
            <b>Live positions aren’t loading right now.</b> A friend’s flight may be in progress, but we can’t see where the plane is.
            Planes will appear here as soon as live data comes back.
          </div>
        )}
        <FlightMap routes={routes} planes={planes} selectedPlane={selected} onSelectPlane={setSelected} airports={airports} onSelectAirport={pickAirport} focus={focus} />
        <ul className="map-legend" aria-label="Map legend">
          <li><i style={{ background: AIRPORT_COLORS.me }} />Only you</li>
          <li><i style={{ background: AIRPORT_COLORS.friend }} />Only friends</li>
          <li><i style={{ background: AIRPORT_COLORS.both }} />You &amp; friends</li>
          <li><i className="line" style={{ background: AIRPORT_COLORS.both }} />Shared route</li>
        </ul>
        {apt && (
          <div className="card map-overlay">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <b className="mono">{apt.code} · {apt.info.city}</b>
                <div style={{ fontSize: 13 }}>{apt.info.name}</div>
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
                  <span><b>{phaseLabel(sel.live.phase, sel.live.real)}</b></span>
                  {sel.live.phase === "airborne" && <span><b>{Math.round(sel.live.progress * 100)}%</b> there</span>}
                  {sel.live.lands && sel.live.phase !== "arrival" && <span>scheduled arrival <b>{sel.live.lands}</b></span>}
                  <span className="muted">
                    {[sel.live.phase === "airborne" && sel.live.real.altFt != null && `${sel.live.real.altFt.toLocaleString()} ft`, sel.live.real.speedKt != null && `${sel.live.real.speedKt} kt`].filter(Boolean).join(" · ")}
                    {sel.live.real.seenAt ? <>{" · "}<Ago iso={sel.live.real.seenAt} /></> : null}
                  </span>
                </>
              ) : (
                <span className="muted">
                  {sel.kind === "mine" && sel.sharedWith.length > 0 ? `Shared route · also flown by ${sel.sharedWith.join(", ")}` : "Completed flight"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
