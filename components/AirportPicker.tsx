"use client";

import { useId, useMemo, useState } from "react";
import { airportList } from "@/lib/airports";
import { AIRPORTS } from "@/lib/core";

const KIND_RANK = { large: 0, medium: 1, small: 2 } as const;

/** Search airports by code, city, name or country. The value is always a real airport code. */
export function AirportPicker({ label, value, onPick, optional }: { label: string; value: string; onPick: (code: string) => void; optional?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const all = useMemo(() => airportList(), []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const score = (a: (typeof all)[number]) => {
      const code = a.code.toLowerCase(), city = a.city.toLowerCase(), name = a.name.toLowerCase(), country = a.country.toLowerCase();
      if (code === q) return 0;
      if (code.startsWith(q)) return 1;
      if (city.startsWith(q)) return 2;
      if (city.includes(q) || name.includes(q)) return 3;
      if (country.startsWith(q)) return 4;
      return 99;
    };
    return all
      .map((a) => [a, score(a)] as const)
      .filter(([, s]) => s < 99)
      .sort((x, y) => x[1] - y[1] || KIND_RANK[x[0].kind] - KIND_RANK[y[0].kind] || x[0].code.localeCompare(y[0].code))
      .slice(0, 8)
      .map(([a]) => a);
  }, [all, query]);

  const shown = value && AIRPORTS[value] ? `${value} · ${AIRPORTS[value].city}` : "";
  const choose = (code: string) => { onPick(code); setQuery(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (matches[active]) choose(matches[active].code); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); setQuery(""); }
  };

  return (
    <div className="combo">
      <label htmlFor={id}><span>{label}{optional && <small> optional</small>}</span></label>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        placeholder="Search airport or city"
        value={open ? query : shown}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
        onKeyDown={onKey}
      />
      {open && (
        <ul className="combo-list" id={`${id}-list`} role="listbox" aria-label={`${label} results`}>
          {!query.trim() && <li className="combo-empty">Type a code (ORD), city, or airport name.</li>}
          {query.trim() && matches.length === 0 && <li className="combo-empty">No airport matches “{query.trim()}”.</li>}
          {matches.map((a, i) => (
            <li
              key={a.code}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={a.code === value}
              className={`combo-opt${i === active ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); choose(a.code); }}
              onMouseEnter={() => setActive(i)}
            >
              <span><b className="mono">{a.code}</b> · {a.city}<small className="muted"> {a.name}</small></span>
              <span className="muted">{a.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
