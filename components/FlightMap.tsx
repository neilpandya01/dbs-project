"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { greatCircleLine, linePoint, type LngLat } from "@/lib/geo";
import { AIRPORTS } from "@/lib/core";
import { AIRPORT_COLORS } from "@/lib/mapColors";

export type MapRoute = { id: string; from: string; to: string; color?: string; highlight?: boolean; progress?: number };
export type MapAirport = { code: string; kind: "me" | "friend" | "both" };
export type MapPlane = { id: string; label: string; name: string; color: string; from: string; to: string; progress: number };

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

type Feature = { type: "Feature"; properties: Record<string, string | number>; geometry: { type: "LineString"; coordinates: LngLat[] } };

const STEPS = 200;
const PLANE_PATH = "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";

function routeLine(from: string, to: string) {
  return greatCircleLine(AIRPORTS[from].lngLat, AIRPORTS[to].lngLat, STEPS);
}

function routesToGeoJSON(routes: MapRoute[]) {
  const features: Feature[] = [];
  for (const r of routes) {
    const line = routeLine(r.from, r.to);
    const base = { id: r.id, color: r.color ?? "#1f7ff0", highlight: r.highlight ? 1 : 0 };
    if (r.progress == null) {
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
      properties: { code: a.code, kind: a.kind },
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
  focus?: { from: string; to: string } | null;
  interactive?: boolean;
  className?: string;
};

export function FlightMap({ routes, planes = [], selectedPlane, onSelectPlane, airports = [], onSelectAirport, focus, interactive = true, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const markers = useRef<maplibregl.Marker[]>([]);
  const latest = useRef({ routes, planes, selectedPlane, onSelectPlane, airports, onSelectAirport });
  latest.current = { routes, planes, selectedPlane, onSelectPlane, airports, onSelectAirport };

  const drawRoutes = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const data = routesToGeoJSON(latest.current.routes);
    new Set(latest.current.routes.map((r) => r.color ?? "#1f7ff0")).forEach((c) => ensureArrow(m, c));
    const src = m.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
  };

  const drawAirports = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("airports") as maplibregl.GeoJSONSource | undefined)?.setData(airportsToGeoJSON(latest.current.airports));
  };

  const drawMarkers = () => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    const { planes, selectedPlane, onSelectPlane } = latest.current;
    for (const p of planes) {
      const { pos, heading } = linePoint(routeLine(p.from, p.to), p.progress);
      const node = document.createElement("button");
      node.className = "plane-marker" + (p.id === selectedPlane ? " selected" : "");
      node.setAttribute("aria-label", `${p.name} in flight, heading ${Math.round(heading)} degrees`);
      // Built with DOM calls and textContent, never innerHTML: the label is a person's display name,
      // which another user controls, so it must never be parsed as HTML.
      const color = /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : "#1f7ff0";
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "plane-icon");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.style.transform = `rotate(${heading}deg)`;
      svg.style.color = color;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", PLANE_PATH);
      path.setAttribute("fill", "currentColor");
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "1.4");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("paint-order", "stroke");
      svg.appendChild(path);
      const tag = document.createElement("span");
      tag.className = "plane-tag";
      tag.style.setProperty("--c", color);
      tag.textContent = p.label;
      node.append(svg, tag);
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectPlane?.(p.id);
      });
      markers.current.push(new maplibregl.Marker({ element: node }).setLngLat(pos as LngLat).addTo(m));
    }
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
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left");
    if (interactive) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const setup = () => {
      new Set(latest.current.routes.map((r) => r.color ?? "#1f7ff0")).forEach((c) => ensureArrow(m, c));
      if (!m.getSource("routes")) {
        m.addSource("routes", { type: "geojson", data: routesToGeoJSON(latest.current.routes) });
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
            "text-field": ["get", "code"],
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
      ready.current = true;
    };
    m.on("style.load", setup);
    m.on("click", "airports-dot", (e) => {
      const code = e.features?.[0]?.properties?.code;
      if (code) latest.current.onSelectAirport?.(String(code));
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
      markers.current.forEach((x) => x.remove());
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
  }, [focus]);

  return <div ref={el} className={className ?? "map-canvas"} role="application" aria-label="Flight map" />;
}
