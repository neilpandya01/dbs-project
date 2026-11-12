import type { Metadata } from "next";
import { MapView } from "./MapView";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <>
      <div className="page-head map-head">
        <h1>Flight map</h1>
        <p>See where you’ve flown and watch friends in the air.</p>
      </div>
      <MapView />
    </>
  );
}
