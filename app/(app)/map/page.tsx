import type { Metadata } from "next";
import { MapView } from "./MapView";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <>
      <div className="page-head map-head">
        <h1>Flight map</h1>
        <p>Track your history and watch friends in the air. Star a flight to keep it on your radar.</p>
      </div>
      <MapView />
    </>
  );
}
