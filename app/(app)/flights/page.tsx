import type { Metadata } from "next";
import { FlightsView } from "./FlightsView";

export const metadata: Metadata = { title: "Flights" };

export default function FlightsPage() {
  return <FlightsView />;
}
