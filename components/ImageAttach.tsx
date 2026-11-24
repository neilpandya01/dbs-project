"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { imageSrc, shrinkImage } from "@/lib/threads";

/**
 * Attach photos: shows the photos already attached (each removable), the new ones picked (each removable), and a button
 * to add more up to `max`. New photos are shrunk in the browser first; they're uploaded when the post is saved.
 */
export function ImageAttach({ kept, onKeptChange, files, onFilesChange, max, canAdd = true }: {
  kept: string[]; onKeptChange: (paths: string[]) => void;
  files: File[]; onFilesChange: (files: File[]) => void;
  max: number; canAdd?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const total = kept.length + files.length;
  if (!canAdd && kept.length === 0) return null;

  const pick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);
    const room = max - total;
    const next: File[] = [];
    try {
      for (const f of Array.from(list).slice(0, room)) next.push(await shrinkImage(f));
      if (list.length > room) setError(`You can attach up to ${max} photos.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo couldn’t be added.");
    }
    if (next.length) onFilesChange([...files, ...next]);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="attach">
      <div className="attach-row">
        {kept.map((p) => {
          const src = imageSrc(p);
          return src ? (
            <div key={p} className="attach-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <button type="button" onClick={() => onKeptChange(kept.filter((x) => x !== p))} aria-label="Remove photo">✕</button>
            </div>
          ) : null;
        })}
        {previews.map((u, i) => (
          <div key={u} className="attach-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" />
            <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} aria-label="Remove photo">✕</button>
          </div>
        ))}
        {canAdd && total < max && (
          <button type="button" className="attach-add" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Adding…" : "📷 Add photo"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => pick(e.target.files)} />
      {error && <p className="msg err" role="alert">{error}</p>}
    </div>
  );
}
