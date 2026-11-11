"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FlightForm } from "@/components/FlightForm";
import { resolveUpcoming } from "./itinerary";
import { AIRPORTS, MY_FLIGHTS, type Flight } from "./mock";

const KEY = "wingmates.flights.v1";

type Ctx = {
  flights: Flight[];
  add: (f: Flight) => void;
  update: (f: Flight) => void;
  remove: (id: string) => void;
  /** Open the add/edit sheet. Pass a flight to edit it, nothing to add a new one. */
  openEditor: (f?: Flight) => void;
  reset: () => void;
};

const FlightsContext = createContext<Ctx | null>(null);

function seed(): Flight[] {
  // sample upcoming flights are relative to today; once seeded they are plain dated flights
  const upcoming = resolveUpcoming(new Date()).map(({ dep: _dep, arr: _arr, ...f }) => f);
  return [...MY_FLIGHTS, ...upcoming];
}

const valid = (f: unknown): f is Flight =>
  !!f && typeof f === "object" && "from" in f && "to" in f && "date" in f && "id" in f &&
  (f as Flight).from in AIRPORTS && (f as Flight).to in AIRPORTS;

/**
 * Front-end stand-in for the database: flights live in React state and are saved to
 * this browser's localStorage. Swap the three mutators for Supabase calls later.
 */
export function FlightsProvider({ children }: { children: React.ReactNode }) {
  const [flights, setFlights] = useState<Flight[]>(MY_FLIGHTS); // same on server and first client render
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<{ flight: Flight | null } | null>(null);

  useEffect(() => {
    let next: Flight[] | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) next = (JSON.parse(raw) as unknown[]).filter(valid);
    } catch {}
    setFlights(next ?? seed());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(flights));
  }, [flights, ready]);

  const add = useCallback((f: Flight) => setFlights((l) => [...l, f]), []);
  const update = useCallback((f: Flight) => setFlights((l) => l.map((x) => (x.id === f.id ? f : x))), []);
  const remove = useCallback((id: string) => setFlights((l) => l.filter((x) => x.id !== id)), []);
  const openEditor = useCallback((f?: Flight) => setEditor({ flight: f ?? null }), []);
  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setFlights(seed());
  }, []);

  const value = useMemo(() => ({ flights, add, update, remove, openEditor, reset }), [flights, add, update, remove, openEditor, reset]);

  return (
    <FlightsContext.Provider value={value}>
      {children}
      {editor && (
        <FlightForm
          flight={editor.flight}
          onClose={() => setEditor(null)}
          onSave={(f) => {
            if (editor.flight) update(f);
            else add(f);
            setEditor(null);
          }}
          onDelete={editor.flight ? () => { remove(editor.flight!.id); setEditor(null); } : undefined}
        />
      )}
    </FlightsContext.Provider>
  );
}

export function useFlights() {
  const c = useContext(FlightsContext);
  if (!c) throw new Error("useFlights must be used inside <FlightsProvider>");
  return c;
}
