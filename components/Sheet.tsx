"use client";

import { useEffect, useRef } from "react";

// open sheets, last = top-most (a flight editor can open on top of a "see all" list)
const openSheets: symbol[] = [];

export function Sheet({ title, onClose, actions, children }: { title: string; onClose: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const me = Symbol("sheet");
    openSheets.push(me);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && openSheets[openSheets.length - 1] === me && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      openSheets.splice(openSheets.indexOf(me), 1);
      if (openSheets.length === 0) document.body.style.overflow = "";
      prev?.focus();
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <div className="head-actions">
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
