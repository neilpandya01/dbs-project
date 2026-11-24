"use client";

import { useState } from "react";

/** The "are you sure?" box shown before anything is deleted. Matches the one used for flights. */
export function ConfirmDelete({ title, detail, onConfirm, onCancel }: {
  title: string; detail: string; onConfirm: () => void | Promise<unknown>; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="confirm-delete" role="alertdialog" aria-label={title} style={{ marginTop: 10 }}>
      <p><b>{title}</b> {detail}</p>
      <div className="form-actions">
        <button type="button" className="btn danger solid" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>Keep it</button>
      </div>
    </div>
  );
}
