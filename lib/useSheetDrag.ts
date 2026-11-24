"use client";

import { useRef, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from "react";

const CLOSED_H = 112;
const DEAD_ZONE = 24; // px: a small drag does nothing at all (the sheet doesn't budge)

/**
 * The map's bottom sheet on phones: drag the grab bar down to lower it, up to raise it. A small drag does nothing,
 * a significant one (a third of the way, or a quick flick) flips it, and a tap toggles. Spread `grab` on the
 * grab-bar button and put `panelRef` on the sheet.
 */
export function useSheetDrag(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; t: number; h: number; started: boolean; wasOpen: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, t: performance.now(), h: panelRef.current?.offsetHeight ?? CLOSED_H, started: false, wasOpen: open };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current, el = panelRef.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y;
    const along = d.wasOpen ? dy : -dy; // only the direction that can change something counts
    if (!d.started) {
      if (along < DEAD_ZONE) return;
      d.started = true;
    }
    // past the dead zone the sheet follows your finger (measured from where the zone ended, so it doesn't jump)
    const full = (el.parentElement?.clientHeight ?? 600) * 0.78;
    const travelled = Math.max(0, along - DEAD_ZONE);
    const target = d.wasOpen ? d.h - travelled : d.h + travelled;
    el.dataset.dragging = "true";
    el.style.transition = "none";
    el.style.height = `${Math.min(full, Math.max(CLOSED_H, target))}px`;
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current, el = panelRef.current;
    drag.current = null;
    if (!d) return;
    if (el) { delete el.dataset.dragging; el.style.transition = ""; el.style.height = ""; }
    const dy = e.clientY - d.y;
    if (Math.abs(dy) < 10) { setOpen((o) => !o); return; } // a tap
    if (!d.started) return; // a small drag: nothing changes
    const along = d.wasOpen ? dy : -dy;
    const range = (el?.parentElement?.clientHeight ?? 600) * 0.78 - CLOSED_H;
    const speed = along / Math.max(1, performance.now() - d.t); // px per ms
    if (along > Math.max(70, range * 0.33) || (speed > 0.5 && along > 40)) setOpen(!d.wasOpen);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
  };

  return { panelRef, grab: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown } };
}
