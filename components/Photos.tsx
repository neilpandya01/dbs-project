"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isImagePath } from "@/lib/threads";
import { useImageUrls } from "@/lib/useImageUrls";

/** Photos attached to a thread or comment. Click one to view it large in the app (no new tab), with arrows for the rest. */
export function Photos({ images, size = "small" }: { images: string[]; size?: "small" | "large" }) {
  const list = images.filter(isImagePath);
  const { urls, retry } = useImageUrls(list);
  const [open, setOpen] = useState<number | null>(null);
  if (list.length === 0) return null;
  // the viewer only pages through photos whose link has arrived
  const ready = list.filter((p) => urls[p]);
  return (
    <>
      <div className={`photos ${size}`}>
        {list.map((p) =>
          urls[p] ? (
            <button key={p} type="button" className="photo-btn" onClick={() => setOpen(ready.indexOf(p))} aria-label={`View photo ${ready.indexOf(p) + 1} of ${ready.length}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[p]} alt="" loading="lazy" onError={() => retry(p)} />
            </button>
          ) : (
            <div key={p} className="photo-btn photo-pending" aria-hidden="true" />
          )
        )}
      </div>
      {open !== null && ready[open] && <Lightbox srcs={ready.map((p) => urls[p])} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ srcs, index, onIndex, onClose }: { srcs: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const n = srcs.length;
  const go = (d: number) => onIndex((index + d + n) % n);
  useEffect(() => {
    // capture phase + preventDefault, so Esc closes just the photo and not a sheet underneath it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (n > 1 && e.key === "ArrowLeft") go(-1);
      else if (n > 1 && e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey, true); document.body.style.overflow = prev; };
  });
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={srcs[index]} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="lightbox-btn lightbox-close" onClick={onClose} aria-label="Close photo">✕</button>
      {n > 1 && (
        <>
          <button type="button" className="lightbox-btn lightbox-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo">‹</button>
          <button type="button" className="lightbox-btn lightbox-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo">›</button>
          <span className="lightbox-count" onClick={(e) => e.stopPropagation()}>{index + 1} / {n}</span>
        </>
      )}
    </div>,
    document.body,
  );
}
