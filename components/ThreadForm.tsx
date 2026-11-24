"use client";

import { useState } from "react";
import { AirportTags } from "./AirportTags";
import { ImageAttach } from "./ImageAttach";
import { Sheet } from "./Sheet";
import { BODY_MAX, BODY_MIN, MAX_THREAD_IMAGES, TITLE_MAX, type Thread, type ThreadValues } from "@/lib/threads";

/** Start a thread, or edit one of yours (pass `thread`). Title and a description are required. */
export function ThreadForm({ thread, onClose, onSave }: { thread: Thread | null; onClose: () => void; onSave: (v: ThreadValues) => Promise<string | null> }) {
  const [airports, setAirports] = useState<string[]>(thread?.airports ?? []);
  const [title, setTitle] = useState(thread?.title ?? "");
  const [body, setBody] = useState(thread?.body ?? "");
  const [kept, setKept] = useState<string[]>(thread?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [friendsOnly, setFriendsOnly] = useState(thread?.friends_only ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) return setError("Give your thread a short title (at least 3 characters).");
    if (body.trim().length < BODY_MIN) return setError(`Add a description of what’s happening (at least ${BODY_MIN} characters).`);
    setBusy(true);
    setError(null);
    const err = await onSave({ title: title.trim(), body: body.trim(), airports, kept, files, friendsOnly });
    if (err) { setError(err); setBusy(false); }
  };

  return (
    <Sheet title={thread ? "Edit thread" : "Start a thread"} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>
          <span>Title <small>{title.length}/{TITLE_MAX}</small></span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} />
        </label>
        <label>
          <span>Description <small>{body.length}/{BODY_MAX}</small></span>
          <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} required aria-required="true" placeholder="What’s happening? Where, and when?" />
        </label>
        <ImageAttach kept={kept} onKeptChange={setKept} files={files} onFilesChange={setFiles} max={MAX_THREAD_IMAGES} />
        <AirportTags value={airports} onChange={setAirports} />
        <label className="check-row">
          <input type="checkbox" checked={friendsOnly} onChange={(e) => setFriendsOnly(e.target.checked)} />
          <span>Friends only <small className="muted">· only you and your friends can see this thread</small></span>
        </label>
        {error && <p className="msg err" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : thread ? "Save changes" : "Post thread"}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}
