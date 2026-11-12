"use client";

import { useState } from "react";
import { AirportPicker } from "./AirportPicker";
import { Sheet } from "./Sheet";
import { airlineFor, type Flight } from "@/lib/core";
import { formatFlightNumber, lookupFlightNumber } from "@/lib/flightLookup";

const AIRCRAFT = [
  "Airbus A220-300", "Airbus A320", "Airbus A321", "Airbus A330-900", "Airbus A350-900",
  "Boeing 737-800", "Boeing 737 MAX 8", "Boeing 737 MAX 9", "Boeing 747-8", "Boeing 767-300ER",
  "Boeing 777-300ER", "Boeing 787-8", "Boeing 787-9", "Embraer E175",
];

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "7:45 AM" -> "07:45" (for <input type="time">) */
function to24(t: string) {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t);
  if (!m) return "";
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** "07:45" -> "7:45 AM" */
function from24(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function FlightForm({
  flight,
  knownFlights,
  onSave,
  onDelete,
  onClose,
  onboarding,
}: {
  flight: Flight | null;
  /** Flights you've already logged, so a repeat flight number can fill in its route. */
  knownFlights: Flight[];
  /** Resolve to an error message to show, or null when saved. */
  onSave: (f: Omit<Flight, "id">) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
  onClose: () => void;
  /** First-run step: titled "Add your first flight", and closing it means skipping. */
  onboarding?: boolean;
}) {
  const editing = !!flight;
  const [number, setNumber] = useState(flight?.number ?? "");
  const [date, setDate] = useState(flight?.date ?? localToday());
  const [time, setTime] = useState(flight?.time ? to24(flight.time) : "");
  const [from, setFrom] = useState(flight?.from ?? "");
  const [to, setTo] = useState(flight?.to ?? "");
  const [aircraft, setAircraft] = useState(flight?.aircraft ?? "");
  const [routeTouched, setRouteTouched] = useState(editing);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(flight?.hidden ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onNumber = (raw: string) => {
    const v = formatFlightNumber(raw);
    setNumber(v);
    if (routeTouched) return;
    const hit = lookupFlightNumber(v, knownFlights);
    if (hit) {
      setFrom(hit.from);
      setTo(hit.to);
      if (!aircraft && hit.aircraft) setAircraft(hit.aircraft);
      setHint(`You\u2019ve logged ${v} before: ${hit.from} → ${hit.to}. Check it looks right.`);
    } else {
      setHint(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return setError("Pick a date.");
    if (!from || !to) return setError("Choose where the flight left from and where it landed.");
    if (from === to) return setError("The two airports need to be different.");
    setBusy(true);
    setError(null);
    const err = await onSave({
      date,
      time: time ? from24(time) : undefined,
      number: number.trim() || undefined,
      airline: airlineFor(number),
      from,
      to,
      aircraft: aircraft.trim() || undefined,
      hidden,
    });
    if (err) { setError(err); setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    const err = await onDelete?.();
    if (err) { setError(err); setConfirmDelete(false); setBusy(false); }
  };

  return (
    <Sheet
      title={editing ? "Edit flight" : onboarding ? "Add your first flight" : "Add a flight"}
      onClose={onClose}
      actions={
        onDelete && (
          <button type="button" className="icon-btn danger" onClick={() => setConfirmDelete(true)} aria-label="Delete flight" aria-pressed={confirmDelete}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        )
      }
    >
      <form className="form" onSubmit={submit} noValidate>
        <label>
          <span>Flight number <small>optional</small></span>
          <input className="input mono" value={number} onChange={(e) => onNumber(e.target.value)} placeholder="UA 1234" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </label>
        {hint && <p className="form-hint found">{hint}</p>}

        <div className="form-row">
          <label>
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            <span>Departs <small>optional</small></span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <AirportPicker label="From" value={from} onPick={(c) => { setFrom(c); setRouteTouched(true); setHint(null); }} />
        <AirportPicker label="To" value={to} onPick={(c) => { setTo(c); setRouteTouched(true); setHint(null); }} />

        <label>
          <span>Aircraft <small>optional</small></span>
          <input className="input" list="aircraft-types" value={aircraft} onChange={(e) => setAircraft(e.target.value)} placeholder="Boeing 737-900" />
          <datalist id="aircraft-types">{AIRCRAFT.map((a) => <option key={a} value={a} />)}</datalist>
        </label>

        <label className="check-row">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          <span>Hide this flight from friends<small> only you will see it</small></span>
        </label>

        <p className="form-hint">Connecting flights? Add each flight on its own. Flights close together are joined as one trip (with the layover) while they’re in “Flying soon”.</p>

        {error && <p className="msg err" role="alert">{error}</p>}

        {confirmDelete && onDelete ? (
          <div className="confirm-delete" role="alertdialog" aria-label="Confirm delete">
            <p><b>Delete this flight?</b> It will be removed from your stats and map.</p>
            <div className="form-actions">
              <button type="button" className="btn danger solid" onClick={doDelete} disabled={busy}>Yes, delete</button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add flight"}</button>
            <button type="button" className="btn" onClick={onClose}>{onboarding ? "Skip for now" : "Cancel"}</button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
