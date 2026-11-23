"use client";

import { useId, useMemo, useState } from "react";
import { AIRCRAFT_TYPES, canonicalAircraft, manufacturerOf } from "@/lib/aircraft";

const MAKER_ORDER = [...new Set(AIRCRAFT_TYPES.map((a) => manufacturerOf(a.name)))];
const makerOrder = (name: string) => MAKER_ORDER.indexOf(manufacturerOf(name));

/**
 * Aircraft dropdown built into the app (not the browser's own suggestion list). Opens to the full catalog
 * grouped by maker; typing narrows it by name or ICAO code. A type that isn't in the catalog can still be
 * used as typed.
 */
export function AircraftPicker({ value, onPick }: { value: string; onPick: (name: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const rank = (a: (typeof AIRCRAFT_TYPES)[number]) => {
      if (!q) return 0;
      const n = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const code = a.icao.toLowerCase();
      if (code === q) return 0;
      if (n.endsWith(q) || n.split(/(?=[a-z]\d)/).some((p) => p.startsWith(q))) return 1;
      if (n.includes(q) || code.startsWith(q)) return 2;
      return 99;
    };
    return AIRCRAFT_TYPES.map((a) => [a, rank(a)] as const)
      .filter(([, r]) => r < 99)
      .sort((x, y) => (q ? x[1] - y[1] : makerOrder(x[0].name) - makerOrder(y[0].name)))
      .map(([a]) => a);
  }, [query]);

  const typed = query.trim();
  const canUseTyped = typed && !options.some((a) => a.name.toLowerCase() === typed.toLowerCase());
  // flat list used for keyboard navigation: [custom?] + options
  const rows = [...(canUseTyped ? [{ name: canonicalAircraft(typed) ?? typed, icao: "", custom: true }] : []), ...options.map((a) => ({ ...a, custom: false }))];

  const choose = (name: string) => { onPick(name); setQuery(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (rows[active]) choose(rows[active].name); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); setQuery(""); }
  };

  let lastMaker = "";
  return (
    <div className="combo">
      <label htmlFor={id}><span>Aircraft <small>optional</small></span></label>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Choose or search, like 737, A320 or E175"
        value={open ? query : value}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
        onKeyDown={onKey}
        maxLength={60}
      />
      {open && (
        <ul className="combo-list" id={`${id}-list`} role="listbox" aria-label="Aircraft types">
          {value && !query && (
            <li className="combo-opt" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); choose(""); }}>
              <span>Clear aircraft</span>
            </li>
          )}
          {rows.length === 0 && <li className="combo-empty">No aircraft matches “{typed}”.</li>}
          {rows.map((a, i) => {
            const maker = a.custom ? "" : manufacturerOf(a.name);
            const header = !a.custom && maker !== lastMaker ? (lastMaker = maker) : null;
            return (
              <li key={a.custom ? "custom" : a.name} role="presentation" style={{ display: "contents" }}>
                {header && <div className="combo-credit" role="presentation">{header}</div>}
                <div
                  role="option"
                  aria-selected={a.name === value}
                  className={`combo-opt${i === active ? " active" : ""}`}
                  ref={(el) => { if (el && i === active) el.scrollIntoView({ block: "nearest" }); }}
                  onMouseDown={(e) => { e.preventDefault(); choose(a.name); }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{a.custom ? <>Use “{a.name}”</> : a.name}</span>
                  {!a.custom && <span className="muted mono">{a.icao}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
