"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CommentItem } from "@/components/CommentItem";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ImageAttach } from "@/components/ImageAttach";
import { Photos } from "@/components/Photos";
import { ThreadForm } from "@/components/ThreadForm";
import { UserLink } from "@/components/UserLink";
import { YouTag } from "@/components/YouTag";
import { AIRPORTS } from "@/lib/core";
import { useFriends } from "@/lib/friendsStore";
import { useSupabase } from "@/lib/supabase";
import {
  COMMENT_COLUMNS, COMMENT_MAX, MAX_COMMENT_IMAGES, THREAD_COLUMNS, addComment, ago, colorFor, deleteComment, deleteThread, editComment,
  flagThread, saveThread, voteThread, type Comment, type Thread, type ThreadValues,
} from "@/lib/threads";
import { useMe } from "@/lib/useMe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One thread, in full, with its replies and a box to reply. Your own thread and comments can be edited or deleted here. */
export function ThreadView({ id }: { id: string }) {
  const supabase = useSupabase();
  const me = useMe();
  const router = useRouter();
  const { friends } = useFriends();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined); // undefined = loading, null = not found
  const [comments, setComments] = useState<Comment[]>([]);
  const [voted, setVoted] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!me.id) return;
    if (!UUID.test(id)) { setThread(null); return; }
    let alive = true;
    (async () => {
      const [t, c, v, f] = await Promise.all([
        supabase.from("reports").select(THREAD_COLUMNS).eq("id", id).maybeSingle(),
        supabase.from("report_comments").select(COMMENT_COLUMNS).eq("report_id", id).order("created_at", { ascending: true }),
        supabase.from("report_votes").select("report_id").eq("report_id", id),
        supabase.from("report_flags").select("report_id").eq("report_id", id),
      ]);
      if (!alive) return;
      setThread((t.data as Thread | null) ?? null);
      setComments((c.data ?? []) as Comment[]);
      setVoted((v.data ?? []).length > 0);
      setFlagged((f.data ?? []).length > 0);
      setNow(Date.now());
    })();
    return () => { alive = false; };
  }, [id, me.id, supabase]);

  if (thread === undefined) return <div className="loading-block" role="status">Loading thread…</div>;
  if (thread === null) {
    return (
      <>
        <Link href="/news" className="back-link">‹ News</Link>
        <div className="card empty"><b>This thread isn’t available</b><p className="muted" style={{ margin: "6px 0 0" }}>It may have been deleted.</p></div>
      </>
    );
  }

  const mine = thread.user_id === me.id;
  const friend = friends.some((f) => f.id === thread.user_id);

  const vote = async () => {
    const on = voted;
    setVoted(!on);
    setThread((t) => (t ? { ...t, helpful: Math.max(0, t.helpful + (on ? -1 : 1)) } : t));
    if (await voteThread(supabase, thread.id, on)) {
      setVoted(on);
      setThread((t) => (t ? { ...t, helpful: Math.max(0, t.helpful + (on ? 1 : -1)) } : t));
    }
  };
  const flag = async () => {
    const on = flagged;
    setFlagged(!on);
    if (await flagThread(supabase, thread.id, on)) setFlagged(on);
  };
  const del = async () => {
    if (!(await deleteThread(supabase, thread))) router.push("/news");
  };
  const saveEdit = async (v: ThreadValues) => {
    const res = await saveThread(supabase, me.id, thread, v);
    if (res.error || !res.thread) return res.error ?? "Couldn’t save the thread.";
    setThread(res.thread);
    setEditing(false);
    return null;
  };

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && files.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await addComment(supabase, me.id, thread.id, body, files);
    if (res.error || !res.comment) setError(res.error ?? "Couldn’t post your comment.");
    else {
      setComments((c) => [...c, res.comment!]);
      setThread((t) => (t ? { ...t, comment_count: t.comment_count + 1 } : t));
      setText("");
      setFiles([]);
      setNow(Date.now());
    }
    setBusy(false);
  };
  const saveComment = async (c: Comment, body: string, kept: string[]) => {
    const res = await editComment(supabase, c, body, kept);
    if (res.error || !res.comment) return res.error ?? "Couldn’t save.";
    setComments((cs) => cs.map((x) => (x.id === c.id ? res.comment! : x)));
    return null;
  };
  const delComment = async (c: Comment) => {
    const err = await deleteComment(supabase, c);
    if (err) return setError(err);
    setComments((cs) => cs.filter((x) => x.id !== c.id));
    setThread((t) => (t ? { ...t, comment_count: Math.max(0, t.comment_count - 1) } : t));
  };

  return (
    <>
      <Link href="/news" className="back-link">‹ News</Link>
      <article className={`post thread-full${mine ? " mine" : ""}`}>
        <UserLink username={thread.author_username}><Avatar name={thread.author_name || thread.author_username} color={colorFor(thread.author_username)} size={42} /></UserLink>
        <div className="post-main">
          <div className="post-head">
            <UserLink username={thread.author_username}><b>@{thread.author_username}</b></UserLink>
            {mine && <YouTag />}
            {friend && <span className="badge accent">Friend</span>}
            {thread.friends_only && <span className="badge" title="Only the author and their friends can see this thread">🔒 Friends only</span>}
            <span className="muted">{ago(thread.created_at, now)}{thread.edited_at ? " · edited" : ""}</span>
            <span className="spacer" />
            {thread.airports.map((c) => <span key={c} className="tag mono" title={AIRPORTS[c]?.name}>{c}</span>)}
          </div>
          <h1 className="thread-title">{thread.title}</h1>
          {thread.body && <p className="thread-body">{thread.body}</p>}
          <Photos images={thread.images} size="large" />
          <div className="post-actions">
            <button className="pill" aria-pressed={voted} onClick={vote}>▲ Helpful · {thread.helpful}</button>
            {mine ? (
              <>
                <button className="pill ghost" onClick={() => setEditing(true)}>Edit</button>
                <button className="pill ghost" onClick={() => setConfirmDel(true)} aria-pressed={confirmDel}>Delete</button>
              </>
            ) : (
              <button className="pill ghost" aria-pressed={flagged} onClick={flag} title={flagged ? "Take your flag back" : "Report this thread"}>{flagged ? "Flagged · Undo" : "Flag"}</button>
            )}
          </div>
          {confirmDel && (
            <ConfirmDelete title="Delete this thread?" detail="Its comments and photos will be deleted too. This can’t be undone." onConfirm={del} onCancel={() => setConfirmDel(false)} />
          )}
        </div>
      </article>

      <h2 className="sec">{thread.comment_count === 1 ? "1 comment" : `${thread.comment_count} comments`}</h2>

      <form className="comment-form" onSubmit={reply}>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} placeholder="Add a comment…" aria-label="Add a comment" />
        <ImageAttach kept={[]} onKeptChange={() => {}} files={files} onFilesChange={setFiles} max={MAX_COMMENT_IMAGES} />
        <div className="comment-form-row">
          <small className="muted">{text.length}/{COMMENT_MAX}</small>
          <button type="submit" className="btn primary" disabled={busy || (!text.trim() && files.length === 0)}>{busy ? "Posting…" : "Reply"}</button>
        </div>
        {error && <p className="msg err" role="alert">{error}</p>}
      </form>

      <div className="comments">
        {comments.length === 0 && <p className="muted empty-line">No comments yet. Start the conversation.</p>}
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            c={c}
            now={now}
            mine={c.user_id === me.id}
            onSave={(body, kept) => saveComment(c, body, kept)}
            onDelete={() => delComment(c)}
          />
        ))}
      </div>

      {editing && <ThreadForm thread={thread} onClose={() => setEditing(false)} onSave={saveEdit} />}
    </>
  );
}
