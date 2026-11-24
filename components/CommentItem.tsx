"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { ImageAttach } from "./ImageAttach";
import { Photos } from "./Photos";
import { UserLink } from "./UserLink";
import { YouTag } from "./YouTag";
import { COMMENT_MAX, ago, colorFor, type Comment } from "@/lib/threads";

/** One comment. Yours can be edited (text, and which photos stay) or deleted right here. */
export function CommentItem({ c, now, mine, thread, onSave, onDelete }: {
  c: Comment; now: number; mine: boolean;
  /** When shown outside its thread (in "My comments"), which thread it's on. */
  thread?: { id: string; title: string } | null;
  onSave: (body: string, kept: string[]) => Promise<string | null>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [kept, setKept] = useState(c.images);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim() && kept.length === 0) return setError("A comment needs some text or a photo.");
    setBusy(true);
    setError(null);
    const err = await onSave(text.trim(), kept);
    setBusy(false);
    if (err) setError(err);
    else setEditing(false);
  };

  return (
    <div className={`comment${mine ? " mine" : ""}`}>
      <UserLink username={c.author_username}><Avatar name={c.author_name || c.author_username} color={colorFor(c.author_username)} size={32} /></UserLink>
      <div className="comment-main">
        <div className="post-head">
          <UserLink username={c.author_username}><b>@{c.author_username}</b></UserLink>
          {mine && <YouTag />}
          <span className="muted">{ago(c.created_at, now)}{c.edited_at ? " · edited" : ""}</span>
          <span className="spacer" />
          {mine && !editing && (
            <>
              <button className="pill ghost" onClick={() => { setText(c.body); setKept(c.images); setEditing(true); }}>Edit</button>
              <button className="pill ghost" onClick={onDelete}>Delete</button>
            </>
          )}
        </div>
        {thread && <p className="comment-on muted">on <Link href={`/news/${thread.id}`} className="thread-link">{thread.title}</Link></p>}
        {editing ? (
          <div className="comment-edit">
            <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} aria-label="Edit your comment" />
            <ImageAttach kept={kept} onKeptChange={setKept} files={[]} onFilesChange={() => {}} max={0} canAdd={false} />
            {error && <p className="msg err" role="alert">{error}</p>}
            <div className="form-actions">
              <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {c.body && <p>{c.body}</p>}
            <Photos images={c.images} />
          </>
        )}
      </div>
    </div>
  );
}
