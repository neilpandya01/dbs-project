"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchCities, type Place } from "@/lib/cities";

/** Type-ahead city search. The value is always a place the search returned, never free text. */
export function CityPicker({ id, value, onPick, label = "Home city" }: { id?: string; value: string; onPick: (place: Place) => void; label?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const listId = `${auto}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abort = useRef<AbortController>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    abort.current?.abort();
    const q = query.trim();
    if (q.length < 2) { setResults([]); setStatus("idle"); return; }
    setStatus("loading");
    timer.current = setTimeout(async () => {
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        setResults(await searchCities(q, ctl.signal));
        setStatus("idle");
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 300);
    return () => { clearTimeout(timer.current); abort.current?.abort(); };
  }, [query]);

  const choose = (p: Place) => { onPick(p); setQuery(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); setQuery(""); }
  };

  const q = query.trim();
  return (
    <div className="combo">
      <label htmlFor={inputId}><span>{label}</span></label>
      <input
        id={inputId}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${auto}-opt-${active}` : undefined}
        aria-required="true"
        autoComplete="off"
        placeholder="Search for a city…"
        value={open ? query : value}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
        onKeyDown={onKey}
      />
      {open && (
        <ul className="combo-list" id={listId} role="listbox" aria-label={`${label} results`}>
          {q.length < 2 && <li className="combo-empty">Type at least 2 letters of a city or town.</li>}
          {q.length >= 2 && status === "loading" && results.length === 0 && <li className="combo-empty">Searching…</li>}
          {status === "error" && <li className="combo-empty">Couldn’t reach city search. Check your connection and try again.</li>}
          {q.length >= 2 && status === "idle" && results.length === 0 && <li className="combo-empty">No city found for “{q}”. Try the city name alone.</li>}
          {results.map((r, i) => (
            <li
              key={r.label}
              id={`${auto}-opt-${i}`}
              role="option"
              aria-selected={r.label === value}
              className={`combo-opt${i === active ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); choose(r); }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{r.label}</span>
            </li>
          ))}
          <li className="combo-credit" aria-hidden="true">Search by Open-Meteo · GeoNames</li>
        </ul>
      )}
    </div>
  );
}
