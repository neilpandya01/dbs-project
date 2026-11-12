"use client";

import { useEffect, useRef, useState } from "react";
import { AirportPicker } from "./AirportPicker";
import { Sheet } from "./Sheet";
import { AIRPORTS, airlineFor, type Flight } from "@/lib/core";
import { fetchLookupStatus, formatFlightNumber, lookupFlight, lookupFlightNumber } from "@/lib/flightLookup";
import { toLeg } from "@/lib/itinerary";
import type { LookupFlight } from "@/lib/lookupTypes";

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
  // The card shows times from toLeg, so the form starts from the very same values: what you see on the card is what you edit.
  const shown = flight ? toLeg(flight) : null;
  // Adding a flight starts with just a flight number and date to look up; editing goes straight to the form.
  const [step, setStep] = useState<"lookup" | "pick" | "form">(editing ? "form" : "lookup");
  const [matches, setMatches] = useState<LookupFlight[]>([]);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [number, setNumber] = useState(flight?.number ?? "");
  const [date, setDate] = useState(flight?.date ?? localToday());
  const [time, setTime] = useState(shown?.depText ? to24(shown.depText) : flight?.time ? to24(flight.time) : "");
  const [arrTime, setArrTime] = useState(shown?.arrText ? to24(shown.arrText) : "");
  const [from, setFrom] = useState(flight?.from ?? "");
  const [to, setTo] = useState(flight?.to ?? "");
  const [airline, setAirline] = useState(flight?.airline ?? "");
  const [aircraft, setAircraft] = useState(flight?.aircraft ?? "");
  const [registration, setRegistration] = useState(flight?.registration ?? "");
  const [seat, setSeat] = useState(flight?.seat ?? "");
  const [notes, setNotes] = useState(flight?.notes ?? "");
  const [source, setSource] = useState<"manual" | "lookup">(flight?.source ?? "manual");
  // exact moments + airport time zones from the lookup; dropped if the date or either time is edited by hand
  const [exact, setExact] = useState<Pick<Flight, "depAt" | "arrAt" | "depTz" | "arrTz"> | null>(
    flight?.depAt && flight.arrAt && flight.depTz && flight.arrTz ? { depAt: flight.depAt, arrAt: flight.arrAt, depTz: flight.depTz, arrTz: flight.arrTz } : null
  );
  const [routeTouched, setRouteTouched] = useState(editing);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(flight?.hidden ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // The delete confirmation is at the bottom of a long form: scroll it into view so it's never missed.
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [confirmDelete]);

  // If lookups are switched off (allowance nearly used, or today's limit reached), skip straight to manual entry.
  useEffect(() => {
    if (editing) return;
    let alive = true;
    fetchLookupStatus().then((s) => {
      if (!alive || s.available) return;
      setStep((cur) => (cur === "lookup" ? "form" : cur));
      setHint(s.reason === "user_limit" ? "You’ve used today’s flight lookups. Add the details below." : "Flight lookup is switched off right now. Add the details below.");
    });
    return () => { alive = false; };
  }, [editing]);

  const onNumber = (raw: string) => {
    const v = formatFlightNumber(raw);
    setNumber(v);
    if (step !== "form" || routeTouched) return;
    const hit = lookupFlightNumber(v, knownFlights);
    if (hit) {
      setFrom(hit.from);
      setTo(hit.to);
      if (!aircraft && hit.aircraft) setAircraft(hit.aircraft);
      setHint(`You’ve logged ${v} before: ${hit.from} → ${hit.to}. Check it looks right.`);
    } else {
      setHint(null);
    }
  };

  /** Fill the form with one flight the lookup found. */
  const apply = (f: LookupFlight) => {
    setNumber(formatFlightNumber(f.number));
    setAirline(f.airline ?? airlineFor(f.number) ?? "");
    setAircraft(f.aircraft ?? "");
    setRegistration(f.registration ?? "");
    setTime(f.depTime ? to24(f.depTime) : "");
    setArrTime(f.arrTime ? to24(f.arrTime) : "");
    const missing = [f.from, f.to].filter((c) => !AIRPORTS[c]);
    setFrom(AIRPORTS[f.from] ? f.from : "");
    setTo(AIRPORTS[f.to] ? f.to : "");
    setRouteTouched(true);
    setSource("lookup");
    setExact(f.depAt && f.arrAt && f.depTz && f.arrTz ? { depAt: f.depAt, arrAt: f.arrAt, depTz: f.depTz, arrTz: f.arrTz } : null);
    setDate(f.depAt && f.depTz ? new Date(f.depAt).toLocaleDateString("en-CA", { timeZone: f.depTz }) : date);
    setHint(missing.length ? `Filled in from the lookup, but we don’t have ${missing.join(" and ")} in our airport list. Choose ${missing.length > 1 ? "them" : "it"} below.` : "Filled in from the flight lookup. Check it looks right, then add your seat or notes.");
    setError(null);
    setStep("form");
  };

  const manual = () => {
    setLookupError(null);
    setHint(null);
    setStep("form");
  };

  const doLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-Z0-9]{2} ?\d{1,4}[A-Z]?$/.test(number.trim())) return setLookupError("Enter a flight number like UA 2679.");
    if (!date) return setLookupError("Pick a date.");
    setLooking(true);
    setLookupError(null);
    const r = await lookupFlight(number, date);
    setLooking(false);
    if (r.status === "ok") return r.flights.length === 1 ? apply(r.flights[0]) : (setMatches(r.flights), setStep("pick"));
    if (r.status === "none") return setLookupError("No flights found. Try a different flight number and date or add information manually.");
    if (r.status === "unavailable") {
      setStep("form");
      return setHint(r.reason === "user_limit" ? "You’ve used today’s flight lookups. Add the details below." : "Flight lookup is switched off right now. Add the details below.");
    }
    setLookupError(`${r.message} Try again, or add information manually.`);
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
      arrTime: arrTime ? from24(arrTime) : undefined,
      number: number.trim() || undefined,
      airline: airline.trim() || airlineFor(number),
      from,
      to,
      aircraft: aircraft.trim() || undefined,
      registration: registration.trim().toUpperCase() || undefined,
      seat: seat.trim().toUpperCase() || undefined,
      notes: notes.trim() || undefined,
      source,
      ...exact,
      hidden,
    });
    if (err) { setError(err); setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    const err = await onDelete?.();
    if (err) { setError(err); setConfirmDelete(false); setBusy(false); }
  };

  const title = editing ? "Edit flight" : onboarding ? "Add your first flight" : "Add a flight";
  const closeLabel = onboarding ? "Skip for now" : "Cancel";

  if (step === "lookup") {
    return (
      <Sheet title={title} onClose={onClose}>
        <form className="form" onSubmit={doLookup} noValidate>
          <label>
            <span>Flight number</span>
            <input className="input mono" value={number} onChange={(e) => { setNumber(formatFlightNumber(e.target.value)); setLookupError(null); }}  autoCapitalize="characters" autoComplete="off" spellCheck={false} autoFocus />
          </label>
          <label>
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setLookupError(null); }} required />
          </label>
          {lookupError && <p className="msg err" role="alert">{lookupError}</p>}
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={looking}>{looking ? "Looking up…" : "Look up flight"}</button>
            <button type="button" className="btn" onClick={manual} disabled={looking}>Add manually</button>
            <button type="button" className="btn" onClick={onClose}>{closeLabel}</button>
          </div>
        </form>
      </Sheet>
    );
  }

  if (step === "pick") {
    return (
      <Sheet title="Which flight?" onClose={onClose}>
        <div className="form">
          <p className="form-hint">We found {matches.length} flights for {number} on {date}. Choose yours.</p>
          <ul className="pick-list">
            {matches.map((m, i) => (
              <li key={i}>
                <button type="button" className="pick-row" onClick={() => apply(m)}>
                  <b className="mono">{m.from} → {m.to}</b>
                  <span className="muted">{[m.fromCity, m.toCity].filter(Boolean).join(" to ")}</span>
                  <span className="muted">{[m.depTime && `Departs ${m.depTime}`, m.arrTime && `Arrives ${m.arrTime}`, m.aircraft].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setStep("lookup")}>Back</button>
            <button type="button" className="btn" onClick={manual}>Add manually</button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={title}
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
        {!editing && <button type="button" className="link-btn" onClick={() => setStep("lookup")}>← Look up a different flight</button>}
        {hint && <p className="form-hint found">{hint}</p>}

        <label>
          <span>Flight number <small>optional</small></span>
          <input className="input mono" value={number} onChange={(e) => onNumber(e.target.value)}  autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </label>

        <div className="form-row">
          <label>
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setExact(null); }} required />
          </label>
          <label>
            <span>Departs <small>optional · local time</small></span>
            <input className="input" type="time" value={time} onChange={(e) => { setTime(e.target.value); setExact(null); }} />
          </label>
        </div>

        <AirportPicker label="From" value={from} onPick={(c) => { setFrom(c); setRouteTouched(true); setHint(null); setExact(null); }} />
        <AirportPicker label="To" value={to} onPick={(c) => { setTo(c); setRouteTouched(true); setHint(null); setExact(null); }} />

        <div className="form-row">
          <label>
            <span>Arrives <small>optional · local time</small></span>
            <input className="input" type="time" value={arrTime} onChange={(e) => { setArrTime(e.target.value); setExact(null); }} />
          </label>
          <label>
            <span>Airline <small>optional</small></span>
            <input className="input" value={airline} onChange={(e) => setAirline(e.target.value)} maxLength={60} autoComplete="off" />
          </label>
        </div>

        <label>
          <span>Aircraft <small>optional</small></span>
          <input className="input" list="aircraft-types" value={aircraft} onChange={(e) => setAircraft(e.target.value)} maxLength={60} />
          <datalist id="aircraft-types">{AIRCRAFT.map((a) => <option key={a} value={a} />)}</datalist>
        </label>

        <div className="form-row">
          <label>
            <span>Registration <small>optional</small></span>
            <input className="input mono" value={registration} onChange={(e) => setRegistration(e.target.value)} maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          </label>
          <label>
            <span>Seat <small>optional</small></span>
            <input className="input mono" value={seat} onChange={(e) => setSeat(e.target.value)} maxLength={8} autoCapitalize="characters" autoComplete="off" />
          </label>
        </div>

        <label>
          <span>Notes <small>optional · {notes.length}/500</small></span>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </label>

        <label className="check-row">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          <span>Hide this flight from friends<small> only you will see it</small></span>
        </label>

        <p className="form-hint">Connecting flights? Add each flight on its own. Flights close together are joined as one trip (with the layover) while they’re in “Flying soon”.</p>

        {error && <p className="msg err" role="alert">{error}</p>}

        {confirmDelete && onDelete ? (
          <div className="confirm-delete" role="alertdialog" aria-label="Confirm delete" ref={confirmRef}>
            <p><b>Delete this flight?</b> It will be removed from your stats and map.</p>
            <div className="form-actions">
              <button type="button" className="btn danger solid" onClick={doDelete} disabled={busy}>Yes, delete</button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add flight"}</button>
            <button type="button" className="btn" onClick={onClose}>{closeLabel}</button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
