"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { greatCircleLine, linePoint, type LngLat } from "@/lib/geo";
import { AIRPORTS } from "@/lib/core";
import { AIRPORT_COLORS } from "@/lib/mapColors";
import { textOn } from "./Avatar";

export type MapRoute = { id: string; from: string; to: string; color?: string; highlight?: boolean; progress?: number;
  /** The aircraft's real position. When set, the solid line runs origin -> here and the dotted line here -> destination, so a plane that has veered off the direct route is drawn where it really is. */
  pos?: LngLat;
  /** With `pos`: don't draw the dotted line ahead of the plane (keeps friends' lines from cluttering your own routes). */
  hideAhead?: boolean;
  /** With `pos`: draw only the dotted line from the plane to the destination (a plane still on the ground has flown nowhere, so no solid line). */
  aheadOnly?: boolean };
export type MapAirport = { code: string; kind: "me" | "friend" | "both" };
export type MapPlane = { id: string; label: string; name: string; color: string; from: string; to: string; progress: number;
  /** The aircraft's real position and heading, when the live tracker has one. Otherwise it sits on the route line by progress. */
  pos?: LngLat; heading?: number;
  /** The person's profile picture (an image URL or data URL). Without one, their initials are shown. */
  photo?: string | null };

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

type Feature = { type: "Feature"; properties: Record<string, string | number>; geometry: { type: "LineString"; coordinates: LngLat[] } };

const STEPS = 200;

const isDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Mix a #rrggbb colour with white so it stands out on a dark map. Other formats are returned unchanged. */
function lighten(hex: string, amount = 0.38) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const c = [0, 2, 4].map((i) => Math.round(parseInt(m[1].slice(i, i + 2), 16) + (255 - parseInt(m[1].slice(i, i + 2), 16)) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
const routeColor = (c: string | undefined, dark: boolean) => (dark ? lighten(c ?? "#1f7ff0") : c ?? "#1f7ff0");

function routeLine(from: string, to: string) {
  return greatCircleLine(AIRPORTS[from].lngLat, AIRPORTS[to].lngLat, STEPS);
}

function routesToGeoJSON(routes: MapRoute[], dark = isDark()) {
  const features: Feature[] = [];
  for (const r of routes) {
    const line = routeLine(r.from, r.to);
    const base = { id: r.id, color: routeColor(r.color, dark), highlight: r.highlight ? 1 : 0 };
    if (r.pos) {
      const a = AIRPORTS[r.from].lngLat, b = AIRPORTS[r.to].lngLat;
      if (!r.aheadOnly) features.push({ type: "Feature", properties: { ...base, part: "flown", arrows: 1 }, geometry: { type: "LineString", coordinates: greatCircleLine(a, r.pos, 80) } });
      if (!r.hideAhead) features.push({ type: "Feature", properties: { ...base, part: "rest", arrows: 0 }, geometry: { type: "LineString", coordinates: greatCircleLine(r.pos, b, 80) } });
    } else if (r.progress == null) {
      features.push({ type: "Feature", properties: { ...base, part: "all", arrows: r.highlight ? 1 : 0 }, geometry: { type: "LineString", coordinates: line } });
    } else {
      const i = Math.max(1, Math.min(STEPS - 1, Math.round(r.progress * STEPS)));
      features.push({ type: "Feature", properties: { ...base, part: "flown", arrows: 1 }, geometry: { type: "LineString", coordinates: line.slice(0, i + 1) } });
      features.push({ type: "Feature", properties: { ...base, part: "rest", arrows: 0 }, geometry: { type: "LineString", coordinates: line.slice(i) } });
    }
  }
  return { type: "FeatureCollection" as const, features };
}

function airportsToGeoJSON(list: MapAirport[]) {
  return {
    type: "FeatureCollection" as const,
    features: list.map((a) => ({
      type: "Feature" as const,
      properties: { code: a.code, kind: a.kind, city: AIRPORTS[a.code].city },
      geometry: { type: "Point" as const, coordinates: AIRPORTS[a.code].lngLat },
    })),
  };
}

/** A white-outlined chevron pointing east; MapLibre rotates it along the line direction. */
function ensureArrow(m: maplibregl.Map, color: string) {
  const id = `arrow-${color}`;
  if (m.hasImage(id)) return;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.lineCap = g.lineJoin = "round";
  g.beginPath();
  g.moveTo(9, 7); g.lineTo(23, 16); g.lineTo(9, 25); g.lineTo(13, 16); g.closePath();
  g.lineWidth = 4; g.strokeStyle = "#fff"; g.stroke();
  g.fillStyle = color; g.fill();
  m.addImage(id, g.getImageData(0, 0, 32, 32), { pixelRatio: 2 });
}

type Props = {
  routes: MapRoute[];
  planes?: MapPlane[];
  selectedPlane?: string | null;
  onSelectPlane?: (id: string) => void;
  airports?: MapAirport[];
  onSelectAirport?: (code: string) => void;
  /** Zoom to this route when `id` changes (not on every re-render, so the viewer's own zoom is left alone). */
  focus?: { id: string; from: string; to: string } | null;
  interactive?: boolean;
  className?: string;
};

export function FlightMap({ routes, planes = [], selectedPlane, onSelectPlane, airports = [], onSelectAirport, focus, interactive = true, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  /** one marker per plane, kept between updates and moved to each new reported position */
  type PlaneMarker = { marker: maplibregl.Marker; node: HTMLButtonElement; key: string; from: LngLat; to: LngLat; cur: LngLat; t0: number };
  const planeMarkers = useRef(new Map<string, PlaneMarker>());
  const latest = useRef({ routes, planes, selectedPlane, onSelectPlane, airports, onSelectAirport });
  latest.current = { routes, planes, selectedPlane, onSelectPlane, airports, onSelectAirport };

  const drawRoutes = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const dark = isDark();
    // a plane's route line follows the plane's gliding marker, not just its last saved position
    const live = latest.current.routes.map((r) => {
      const pm = r.pos ? planeMarkers.current.get(r.id) : undefined;
      return pm ? { ...r, pos: pm.cur } : r;
    });
    new Set(live.map((r) => routeColor(r.color, dark))).forEach((c) => ensureArrow(m, c));
    const src = m.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(routesToGeoJSON(live, dark));
  };

  const drawAirports = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("airports") as maplibregl.GeoJSONSource | undefined)?.setData(airportsToGeoJSON(latest.current.airports));
  };

  const drawMarkers = () => {
    const m = map.current;
    if (!m) return;
    const { planes, selectedPlane } = latest.current;
    const now = performance.now();
    const keep = new Set<string>();
    for (const p of planes) {
      keep.add(p.id);
      const onLine = linePoint(routeLine(p.from, p.to), p.progress);
      const pos = (p.pos ?? onLine.pos) as LngLat;
      const heading = p.heading ?? onLine.heading;
      const color = /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : "#1f7ff0";
      const key = `${p.name}|${p.label}|${color}|${p.photo ?? ""}`;
      let pm = planeMarkers.current.get(p.id);
      if (pm && pm.key !== key) { pm.marker.remove(); planeMarkers.current.delete(p.id); pm = undefined; } // their picture or name changed: rebuild
      if (!pm) {
        const node = document.createElement("button");
        // Built with DOM calls and textContent, never innerHTML: the label is a person's display name,
        // which another user controls, so it must never be parsed as HTML.
        // The marker is the person's profile picture (or their initials on their colour), ringed in their colour.
        const face = document.createElement("span");
        face.className = "plane-face";
        face.style.setProperty("--c", color);
        face.style.background = color;
        face.style.color = textOn(color);
        if (p.photo && /^(data:image\/|https:\/\/)/.test(p.photo)) {
          const img = document.createElement("img");
          img.alt = "";
          img.src = p.photo;
          face.appendChild(img);
        } else {
          face.textContent = p.name.split(/[\s,.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        }
        const tag = document.createElement("span");
        tag.className = "plane-tag";
        tag.style.setProperty("--c", color);
        tag.textContent = p.label;
        node.append(face, tag);
        node.addEventListener("click", (e) => {
          e.stopPropagation();
          latest.current.onSelectPlane?.(p.id);
        });
        const marker = new maplibregl.Marker({ element: node }).setLngLat(pos).addTo(m);
        pm = { marker, node, key, from: pos, to: pos, cur: pos, t0: now };
        planeMarkers.current.set(p.id, pm);
      } else if (pm.cur[0] !== pos[0] || pm.cur[1] !== pos[1]) {
        // the raw position, as reported: no smoothing or animation between updates
        pm.from = pm.to = pm.cur = pos;
        pm.marker.setLngLat(pos);
      }
      pm.node.className = "plane-marker" + (p.id === selectedPlane ? " selected" : "");
      pm.node.setAttribute("aria-label", `${p.name} in flight, heading ${Math.round(heading)} degrees`);
    }
    for (const [id, pm] of planeMarkers.current) if (!keep.has(id)) { pm.marker.remove(); planeMarkers.current.delete(id); }
    drawRoutes(); // the route lines start at the plane, so they follow its new position
  };

  // create the map once
  useEffect(() => {
    if (!el.current) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const m = new maplibregl.Map({
      container: el.current,
      style: dark.matches ? STYLE_DARK : STYLE_LIGHT,
      center: [-60, 38],
      zoom: 1.6,
      attributionControl: false,
      interactive,
    });
    map.current = m;
    // More responsive zooming. MapLibre's defaults (1/450 for a mouse wheel, 1/100 for a trackpad pinch) feel sluggish,
    // so each notch / pinch distance now zooms about four times as far.
    if (interactive) {
      m.scrollZoom.setWheelZoomRate(1 / 110);
      m.scrollZoom.setZoomRate(1 / 28);
    }
    // The map credit starts collapsed to the little "i" (tap it to read the credit). On a wide screen it sits bottom-right so
    // the opened credit never runs under the legend; on a phone the bottom is covered by the panel, so it stays top-left.
    m.addControl(new maplibregl.AttributionControl({ compact: true }), window.matchMedia("(max-width: 860px)").matches ? "top-left" : "bottom-right");
    const collapseCredit = () => {
      const c = m.getContainer().querySelector(".maplibregl-ctrl-attrib");
      c?.classList.remove("maplibregl-compact-show");
      c?.removeAttribute("open");
    };
    collapseCredit();
    m.once("load", collapseCredit);
    if (interactive) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const setup = () => {
      new Set(latest.current.routes.map((r) => routeColor(r.color, dark.matches))).forEach((c) => ensureArrow(m, c));
      if (!m.getSource("routes")) {
        m.addSource("routes", { type: "geojson", data: routesToGeoJSON(latest.current.routes) });
        // a light edge under the lines, used on the dark map so the colours don't sink into it
        m.addLayer({
          id: "routes-casing",
          type: "line",
          source: "routes",
          filter: ["!=", ["get", "part"], "rest"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": ["case", ["==", ["get", "part"], "flown"], 8, 6], "line-opacity": 0 },
        });
        m.addLayer({
          id: "routes-rest",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "part"], "rest"],
          layout: { "line-cap": "butt", "line-join": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.55, "line-dasharray": [1.5, 2] },
        });
        m.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          filter: ["!=", ["get", "part"], "rest"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["case", ["==", ["get", "part"], "flown"], 4.5, ["==", ["get", "highlight"], 1], 4, 2],
            "line-opacity": ["case", ["==", ["get", "part"], "all"], ["case", ["==", ["get", "highlight"], 1], 1, 0.55], 1],
          },
        });
        m.addLayer({
          id: "routes-arrows",
          type: "symbol",
          source: "routes",
          filter: ["all", ["==", ["get", "arrows"], 1], ["!=", ["get", "part"], "rest"]],
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 60,
            "icon-image": ["concat", "arrow-", ["get", "color"]],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 0.9,
          },
        });
      }
      if (!m.getSource("airports")) {
        m.addSource("airports", { type: "geojson", data: airportsToGeoJSON(latest.current.airports) });
        m.addLayer({
          id: "airports-dot",
          type: "circle",
          source: "airports",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 6, 8],
            "circle-color": ["match", ["get", "kind"], "me", AIRPORT_COLORS.me, "friend", AIRPORT_COLORS.friend, AIRPORT_COLORS.both],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "airports-label",
          type: "symbol",
          source: "airports",
          minzoom: 2.6,
          layout: {
            // the code from a moderate zoom; the city as well once you are zoomed in further
            "text-field": ["step", ["zoom"], ["get", "code"], 4.5, ["concat", ["get", "code"], " · ", ["get", "city"]]],
            "text-font": ["Noto Sans Bold"],
            "text-size": 11,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": "#0d2340", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
        });
      }
      applyTheme(m, dark.matches);
      ready.current = true;
    };

    // Colours that read well on each map: on the dark one, lighter lines with a pale edge, stronger dotted
    // lines, and light airport labels with a dark outline.
    const applyTheme = (map: maplibregl.Map, isDarkMap: boolean) => {
      if (map.getLayer("routes-casing")) map.setPaintProperty("routes-casing", "line-opacity", isDarkMap ? 0.55 : 0);
      if (map.getLayer("routes-rest")) {
        map.setPaintProperty("routes-rest", "line-opacity", isDarkMap ? 0.95 : 0.55);
        map.setPaintProperty("routes-rest", "line-width", isDarkMap ? 3.6 : 3);
      }
      if (map.getLayer("routes-line")) {
        map.setPaintProperty("routes-line", "line-opacity", ["case", ["==", ["get", "part"], "all"], ["case", ["==", ["get", "highlight"], 1], 1, isDarkMap ? 0.9 : 0.55], 1]);
      }
      if (map.getLayer("airports-label")) {
        map.setPaintProperty("airports-label", "text-color", isDarkMap ? "#eaf3ff" : "#0d2340");
        map.setPaintProperty("airports-label", "text-halo-color", isDarkMap ? "#0b1b33" : "#ffffff");
      }
      if (map.getLayer("airports-dot")) map.setPaintProperty("airports-dot", "circle-stroke-width", isDarkMap ? 2.5 : 2);
    };
    m.on("style.load", setup);
    // A forgiving tap target: pick the nearest airport dot within a few pixels of the tap (bigger on touch screens),
    // instead of needing to land exactly on the small dot.
    m.on("click", (e) => {
      if (!m.getLayer("airports-dot")) return;
      const r = window.matchMedia("(pointer: coarse)").matches ? 28 : 12;
      const { x, y } = e.point;
      const hits = m.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: ["airports-dot"] });
      let best: { code: string; d: number } | null = null;
      for (const f of hits) {
        const code = f.properties?.code;
        if (!code || f.geometry.type !== "Point") continue;
        const p = m.project(f.geometry.coordinates as [number, number]);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d <= r && (!best || d < best.d)) best = { code: String(code), d };
      }
      if (best) latest.current.onSelectAirport?.(best.code);
    });
    m.on("mouseenter", "airports-dot", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "airports-dot", () => (m.getCanvas().style.cursor = ""));

    const onScheme = (e: MediaQueryListEvent) => {
      ready.current = false;
      m.setStyle(e.matches ? STYLE_DARK : STYLE_LIGHT);
    };
    dark.addEventListener("change", onScheme);

    // fit all routes on first load
    m.once("load", () => {
      const pts = latest.current.routes.flatMap((r) => [AIRPORTS[r.from].lngLat, AIRPORTS[r.to].lngLat]);
      if (pts.length > 1) {
        const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
        m.fitBounds(bounds, { padding: 50, duration: 0, maxZoom: 4 });
      }
      drawMarkers();
    });

    return () => {
      dark.removeEventListener("change", onScheme);
      planeMarkers.current.forEach((pm) => pm.marker.remove());
      planeMarkers.current.clear();
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(drawRoutes, [routes]);
  useEffect(drawAirports, [airports]);
  useEffect(drawMarkers, [planes, selectedPlane]);

  useEffect(() => {
    const m = map.current;
    if (!m || !focus) return;
    // use the unwrapped line so routes crossing the antimeridian fit the short way round
    const line = routeLine(focus.from, focus.to);
    const bounds = line.reduce((bb, pt) => bb.extend(pt), new maplibregl.LngLatBounds(line[0], line[0]));
    const mobile = window.innerWidth <= 860;
    m.fitBounds(bounds, { padding: { top: 70, bottom: mobile ? 190 : 150, left: 50, right: 50 }, duration: 800, maxZoom: 5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id]);

  return <div ref={el} className={className ?? "map-canvas"} role="application" aria-label="Flight map" />;
}
