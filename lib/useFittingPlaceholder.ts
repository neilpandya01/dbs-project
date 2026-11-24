"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A search-box hint that always fits the box. Lists as many of `terms` as fit before the end, and finishes with "…"
 * ("Search airline, flight no., airport…"), re-measuring when the screen is resized or rotated.
 */
export function useFittingPlaceholder(terms: string[], lead = "Search") {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(`${lead}…`);
  const key = terms.join("|");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const cs = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8; // a little slack, and the clear (x) button
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx || room <= 0) return;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      for (let k = terms.length; k >= 1; k--) {
        const t = `${lead} ${terms.slice(0, k).join(", ")}…`;
        if (ctx.measureText(t).width <= room) return setText(t);
      }
      setText(`${lead}…`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lead]);

  return { ref, placeholder: text };
}
