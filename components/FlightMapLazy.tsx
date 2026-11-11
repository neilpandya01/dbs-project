"use client";

import dynamic from "next/dynamic";

// MapLibre touches `window`, so only load it in the browser.
export const FlightMap = dynamic(() => import("./FlightMap").then((m) => m.FlightMap), {
  ssr: false,
  loading: () => <div className="map-canvas" aria-busy="true" />,
});
