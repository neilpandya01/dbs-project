"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FlightForm } from "@/components/FlightForm";
import { toFlight, toRow, type FlightRow } from "./db";
import type { Flight } from "./core";
import { useSupabase } from "./supabase";
import { useMe } from "./useMe";

type Ctx = {
  /** Your own flights (past and upcoming). */
  flights: Flight[];
  loading: boolean;
  error: string | null;
  /** Each returns an error message, or null when it worked. */
  add: (f: Omit<Flight, "id">) => Promise<string | null>;
  update: (f: Flight) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  /** Open the add/edit sheet. Pass a flight to edit it, nothing to add a new one. */
  openEditor: (f?: Flight) => void;
};

const FlightsContext = createContext<Ctx | null>(null);

/** Your flights, stored in Supabase `flights` (only you can change them; friends can read the ones you haven't hidden). */
export function FlightsProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const supabase = useSupabase();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ flight: Flight | null } | null>(null);

  useEffect(() => {
    if (!me.id) return;
    let alive = true;
    setLoading(true);
    supabase
      .from("flights")
      .select("*")
      .eq("user_id", me.id) // my own; RLS would also return friends' visible flights
      .order("flown_on", { ascending: false })
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e.message);
        else { setFlights((data as FlightRow[]).map(toFlight)); setError(null); }
        setLoading(false);
      });
    return () => { alive = false; };
  }, [me.id, supabase]);

  const add = useCallback(
    async (f: Omit<Flight, "id">) => {
      const { data, error: e } = await supabase.from("flights").insert(toRow(f)).select("*").single();
      if (e) return e.message;
      setFlights((l) => [...l, toFlight(data as FlightRow)]);
      return null;
    },
    [supabase]
  );
  const update = useCallback(
    async (f: Flight) => {
      const { data, error: e } = await supabase.from("flights").update(toRow(f)).eq("id", f.id).select("*").single();
      if (e) return e.message;
      setFlights((l) => l.map((x) => (x.id === f.id ? toFlight(data as FlightRow) : x)));
      return null;
    },
    [supabase]
  );
  const remove = useCallback(
    async (id: string) => {
      const { error: e } = await supabase.from("flights").delete().eq("id", id);
      if (e) return e.message;
      setFlights((l) => l.filter((x) => x.id !== id));
      return null;
    },
    [supabase]
  );
  const openEditor = useCallback((f?: Flight) => setEditor({ flight: f ?? null }), []);

  const value = useMemo(() => ({ flights, loading, error, add, update, remove, openEditor }), [flights, loading, error, add, update, remove, openEditor]);

  return (
    <FlightsContext.Provider value={value}>
      {children}
      {editor && (
        <FlightForm
          flight={editor.flight}
          knownFlights={flights}
          onClose={() => setEditor(null)}
          onSave={async (f) => {
            const err = editor.flight ? await update({ ...f, id: editor.flight.id }) : await add(f);
            if (!err) setEditor(null);
            return err;
          }}
          onDelete={
            editor.flight
              ? async () => {
                  const err = await remove(editor.flight!.id);
                  if (!err) setEditor(null);
                  return err;
                }
              : undefined
          }
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
