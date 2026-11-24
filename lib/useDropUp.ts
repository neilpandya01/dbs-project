"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Should a dropdown under `ref` open upward? True when there isn't room for it below (the bottom of the screen, or
 * of the sheet/panel it sits in, is too close) and there is more room above. `watch` re-checks when the list changes.
 */
export function useDropUp(ref: RefObject<HTMLElement | null>, open: boolean, watch?: unknown) {
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) { setUp(false); return; }
    const r = el.getBoundingClientRect();
    let bottom = window.innerHeight, top = 0;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll" || o === "hidden") {
        const pr = p.getBoundingClientRect();
        bottom = Math.min(bottom, pr.bottom);
        top = Math.max(top, pr.top);
      }
    }
    const below = bottom - r.bottom, above = r.top - top;
    setUp(below < 270 && above > below);
  }, [ref, open, watch]);
  return up;
}
