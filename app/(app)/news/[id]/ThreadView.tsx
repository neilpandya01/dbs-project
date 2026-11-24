"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AIRPORTS } from "@/lib/core";
import { useSupabase } from "@/lib/supabase";
import {
  COMMENT_COLUMNS, COMMENT_MAX, THREAD_COLUMNS, ago, colorFor, deleteThread, flagThread, voteThread,
  type Comment, type Thread,
} from "@/lib/threads";
import { useMe } from "@/lib/useMe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One thread, in full, with its replies and a box to reply. */
export function ThreadView({ id }: { id: string }) {
  const supabase = useSupabase();
  const me = useMe();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined); // undefined = loading, null = not found
  const [comments, setComments] = useState<Comment[]>([]);
  const [voted, setVoted] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [text, setText] = useState("");
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
    setFlagged(true);
    if (await flagThread(supabase, thread.id)) setFlagged(false);
  };
  const del = async () => {
    if (!(await deleteThread(supabase, thread.id))) router.push("/news");
  };

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.from("report_comments").insert({ report_id: thread.id, body }).select(COMMENT_COLUMNS).single();
    if (err) setError(err.message);
    else {
      setComments((c) => [...c, data as Comment]);
      setThread((t) => (t ? { ...t, comment_count: t.comment_count + 1 } : t));
      setText("");
      setNow(Date.now());
    }
    setBusy(false);
  };
  const delComment = async (cid: string) => {
    const { error: err } = await supabase.from("report_comments").delete().eq("id", cid);
    if (err) return setError(err.message);
    setComments((c) => c.filter((x) => x.id !== cid));
    setThread((t) => (t ? { ...t, comment_count: Math.max(0, t.comment_count - 1) } : t));
  };

  return (
    <>
      <Link href="/news" className="back-link">‹ News</Link>
      <article className="post thread-full">
        <Avatar name={thread.author_name || thread.author_username} color={colorFor(thread.author_username)} size={42} />
        <div className="post-main">
          <div className="post-head">
            <b>@{thread.author_username}</b>
            <span className="muted">{ago(thread.created_at, now)}</span>
            <span className="spacer" />
            {thread.airports.map((c) => <span key={c} className="tag mono" title={AIRPORTS[c]?.name}>{c}</span>)}
          </div>
          <h1 className="thread-title">{thread.title}</h1>
          {thread.body && <p className="thread-body">{thread.body}</p>}
          <div className="post-actions">
            <button className="pill" aria-pressed={voted} onClick={vote}>▲ Helpful · {thread.helpful}</button>
            {mine ? (
              <button className="pill ghost" onClick={del}>Delete</button>
            ) : (
              <button className="pill ghost" aria-pressed={flagged} onClick={flag} disabled={flagged}>{flagged ? "Flagged" : "Flag"}</button>
            )}
          </div>
        </div>
      </article>

      <h2 className="sec">{thread.comment_count === 1 ? "1 comment" : `${thread.comment_count} comments`}</h2>

      <form className="comment-form" onSubmit={reply}>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} placeholder="Add a comment…" aria-label="Add a comment" />
        <div className="comment-form-row">
          <small className="muted">{text.length}/{COMMENT_MAX}</small>
          <button type="submit" className="btn primary" disabled={busy || !text.trim()}>{busy ? "Posting…" : "Reply"}</button>
        </div>
        {error && <p className="msg err" role="alert">{error}</p>}
      </form>

      <div className="comments">
        {comments.length === 0 && <p className="muted empty-line">No comments yet. Start the conversation.</p>}
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <Avatar name={c.author_name || c.author_username} color={colorFor(c.author_username)} size={32} />
            <div className="comment-main">
              <div className="post-head">
                <b>@{c.author_username}</b>
                <span className="muted">{ago(c.created_at, now)}</span>
                <span className="spacer" />
                {c.user_id === me.id && <button className="pill ghost" onClick={() => delComment(c.id)}>Delete</button>}
              </div>
              <p>{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
