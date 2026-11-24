"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AirportPicker } from "@/components/AirportPicker";
import { Avatar } from "@/components/Avatar";
import { CommentItem } from "@/components/CommentItem";
import { Photos } from "@/components/Photos";
import { ThreadForm } from "@/components/ThreadForm";
import { UserLink } from "@/components/UserLink";
import { YouTag } from "@/components/YouTag";
import { AIRPORTS, airportsNear } from "@/lib/core";
import { useFlights } from "@/lib/flightsStore";
import { useFriends } from "@/lib/friendsStore";
import { useProfile } from "@/lib/profileStore";
import { useSupabase } from "@/lib/supabase";
import {
  COMMENT_COLUMNS, THREAD_COLUMNS, activity, ago, colorFor, deleteComment, deleteThread, editComment, flagThread, hotScore, hotspots,
  saveThread, voteThread, type Comment, type Thread, type ThreadValues,
} from "@/lib/threads";
import { useMe } from "@/lib/useMe";

type Sort = "hot" | "new" | "top";
type Scope = "all" | "friends" | "mine" | "comments";
/** One of your comments, with the thread it's on. */
type MyComment = Comment & { reports: { id: string; title: string } | null };

function Tags({ tags, onPick }: { tags: string[]; onPick?: (code: string) => void }) {
  return (
    <>
      {tags.map((t) =>
        onPick ? (
          <button key={t} type="button" className="tag mono tag-btn" onClick={() => onPick(t)} title={AIRPORTS[t] ? `${AIRPORTS[t].name}: show threads about ${t}` : undefined}>{t}</button>
        ) : (
          <span key={t} className="tag mono">{t}</span>
        )
      )}
    </>
  );
}

function ThreadCard({ t, now, mine, friend, voted, flagged, onVote, onFlag, onEdit, onDelete, onPickAirport }: {
  t: Thread; now: number; mine: boolean; friend: boolean; voted: boolean; flagged: boolean;
  onVote: () => void; onFlag: () => void; onEdit: () => void; onDelete: () => void; onPickAirport: (code: string) => void;
}) {
  return (
    <article className={`post${mine ? " mine" : ""}`}>
      <UserLink username={t.author_username}><Avatar name={t.author_name || t.author_username} color={colorFor(t.author_username)} size={38} /></UserLink>
      <div className="post-main">
        <div className="post-head">
          <UserLink username={t.author_username}><b>@{t.author_username}</b></UserLink>
          {mine && <YouTag />}
          {friend && <span className="badge accent">Friend</span>}
          <span className="muted">{ago(t.created_at, now)}{t.edited_at ? " · edited" : ""}</span>
          <span className="spacer" />
          <Tags tags={t.airports} onPick={onPickAirport} />
        </div>
        <h3><Link href={`/news/${t.id}`} className="thread-link">{t.title}</Link></h3>
        {t.body && <p className="clamp3">{t.body}</p>}
        <Photos images={t.images} />
        <div className="post-actions">
          <button className="pill" aria-pressed={voted} onClick={onVote}>▲ Helpful · {t.helpful}</button>
          <Link href={`/news/${t.id}`} className="pill" style={{ textDecoration: "none", color: "inherit" }}>
            💬 {t.comment_count === 1 ? "1 comment" : `${t.comment_count} comments`}
          </Link>
          {mine ? (
            <>
              <button className="pill ghost" onClick={onEdit}>Edit</button>
              <button className="pill ghost" onClick={onDelete}>Delete</button>
            </>
          ) : (
            <button className="pill ghost" aria-pressed={flagged} onClick={onFlag} disabled={flagged}>{flagged ? "Flagged" : "Flag"}</button>
          )}
        </div>
      </div>
    </article>
  );
}

export function NewsView() {
  const { profile } = useProfile();
  const { flights } = useFlights();
  const { friends } = useFriends();
  const me = useMe();
  const supabase = useSupabase();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [myComments, setMyComments] = useState<MyComment[] | null>(null); // loaded the first time you open "My comments"
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<Sort>("hot");
  const [mine, setMine] = useState(false);
  const [airports, setAirports] = useState<string[]>([]); // show only threads tagged with any of these airports
  const addAirport = (code: string) => code && setAirports((a) => (a.includes(code) ? a : [...a, code]));
  const [form, setForm] = useState<{ thread: Thread | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!me.id) return;
    let alive = true;
    (async () => {
      const [r, v, f] = await Promise.all([
        supabase.from("reports").select(THREAD_COLUMNS).order("created_at", { ascending: false }).limit(200),
        supabase.from("report_votes").select("report_id"),
        supabase.from("report_flags").select("report_id"),
      ]);
      if (!alive) return;
      if (r.error) setError(r.error.message);
      else {
        setThreads((r.data ?? []) as Thread[]);
        setVoted(new Set((v.data ?? []).map((x) => x.report_id as string)));
        setFlagged(new Set((f.data ?? []).map((x) => x.report_id as string)));
        setError(null);
      }
      setNow(Date.now());
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [me.id, supabase]);

  useEffect(() => {
    if (scope !== "comments" || myComments || !me.id) return;
    let alive = true;
    supabase.from("report_comments").select(`${COMMENT_COLUMNS},reports(id,title)`).eq("user_id", me.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e.message);
        else setMyComments((data ?? []) as unknown as MyComment[]);
      });
    return () => { alive = false; };
  }, [scope, myComments, me.id, supabase]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  // "My airports": near your home city, plus every airport you've flown to or from
  const myAirports = useMemo(
    () => new Set([...(profile.homePlace ? airportsNear(profile.homePlace.lat, profile.homePlace.lon) : []), ...flights.flatMap((f) => [f.from, f.to])]),
    [profile.homePlace, flights]
  );

  // summaries built from volume: which airports are busy right now, and which threads people are reacting to
  const spots = useMemo(() => hotspots(threads, now), [threads, now]);

  const counts = useMemo(() => ({
    friends: threads.filter((t) => friendIds.has(t.user_id)).length,
    mine: threads.filter((t) => t.user_id === me.id).length,
  }), [threads, friendIds, me.id]);

  const list = useMemo(() => {
    const f = threads.filter((t) =>
      (scope === "all" || (scope === "friends" && friendIds.has(t.user_id)) || (scope === "mine" && t.user_id === me.id)) &&
      (!mine || t.airports.some((c) => myAirports.has(c))) &&
      (airports.length === 0 || t.airports.some((c) => airports.includes(c)))
    );
    if (sort === "new") return [...f].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    if (sort === "top") return [...f].sort((a, b) => activity(b) - activity(a) || Date.parse(b.created_at) - Date.parse(a.created_at));
    return [...f].sort((a, b) => hotScore(b, now) - hotScore(a, now));
  }, [threads, scope, friendIds, me.id, mine, myAirports, airports, sort, now]);

  const save = async (v: ThreadValues) => {
    const existing = form?.thread ?? null;
    const res = await saveThread(supabase, me.id, existing, v);
    if (res.error || !res.thread) return res.error ?? "Couldn’t save the thread.";
    setThreads((r) => (existing ? r.map((x) => (x.id === existing.id ? res.thread! : x)) : [res.thread!, ...r]));
    setNow(Date.now());
    setForm(null);
    return null;
  };

  const vote = async (id: string) => {
    const on = voted.has(id);
    setVoted((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
    setThreads((rs) => rs.map((r) => (r.id === id ? { ...r, helpful: Math.max(0, r.helpful + (on ? -1 : 1)) } : r)));
    if (await voteThread(supabase, id, on)) {
      setVoted((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
      setThreads((rs) => rs.map((r) => (r.id === id ? { ...r, helpful: Math.max(0, r.helpful + (on ? 1 : -1)) } : r)));
    }
  };
  const flag = async (id: string) => {
    setFlagged((s) => new Set(s).add(id));
    if (await flagThread(supabase, id)) setFlagged((s) => { const n = new Set(s); n.delete(id); return n; });
  };
  const del = async (t: Thread) => {
    if (!(await deleteThread(supabase, t))) setThreads((rs) => rs.filter((r) => r.id !== t.id));
  };

  const saveMyComment = async (c: MyComment, body: string, kept: string[]) => {
    const res = await editComment(supabase, c, body, kept);
    if (res.error || !res.comment) return res.error ?? "Couldn’t save.";
    setMyComments((cs) => (cs ?? []).map((x) => (x.id === c.id ? { ...x, ...res.comment! } : x)));
    return null;
  };
  const delMyComment = async (c: MyComment) => {
    if (await deleteComment(supabase, c)) return;
    setMyComments((cs) => (cs ?? []).filter((x) => x.id !== c.id));
    setThreads((ts) => ts.map((t) => (t.id === c.report_id ? { ...t, comment_count: Math.max(0, t.comment_count - 1) } : t)));
  };

  const SCOPES: [Scope, string][] = [
    ["all", "All"],
    ["friends", counts.friends > 0 ? `Friends · ${counts.friends}` : "Friends"],
    ["mine", counts.mine > 0 ? `My threads · ${counts.mine}` : "My threads"],
    ["comments", "My comments"],
  ];
  const SORTS: [Sort, string][] = [["hot", "🔥 Hot"], ["new", "New"], ["top", "Top"]];

  if (loading) return <div className="loading-block" role="status">Loading threads…</div>;

  return (
    <>
      {error && <p className="msg err" role="alert">Couldn’t load threads: {error}</p>}

      <div className="section-bar" style={{ margin: "0 0 12px" }}>
        <div className="chip-bar scope-bar" role="group" aria-label="Whose threads" style={{ margin: 0, padding: 0 }}>
          {SCOPES.map(([s, label]) => (
            <button key={s} className="chip-btn" aria-pressed={scope === s} onClick={() => setScope(s)}>{label}</button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setForm({ thread: null })}>＋ Start a thread</button>
      </div>

      {scope === "all" && spots.length > 0 && airports.length === 0 && (
        <section aria-label="Developing now">
          <h2 className="sec">Developing now <small>busiest airports, last 24 h</small></h2>
          <div className="hotspots">
            {spots.map((s) => (
              <button key={s.code} type="button" className="hotspot" onClick={() => addAirport(s.code)} aria-label={`Show threads about ${s.code}`}>
                <div className="hotspot-code mono">{s.code}<span>{AIRPORTS[s.code]?.city}</span></div>
                <div className="hotspot-stats">
                  <b>{s.threads.length}</b> {s.threads.length === 1 ? "report" : "reports"} · <b>{s.comments}</b> {s.comments === 1 ? "comment" : "comments"}
                </div>
                <p>Latest buzz: “{s.top.title}”</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {scope === "comments" ? (
        <section aria-label="My comments">
          {myComments === null ? (
            <div className="loading-block" role="status">Loading your comments…</div>
          ) : myComments.length > 0 ? (
            <div className="card comments-card">
              {myComments.map((c) => (
                <CommentItem
                  key={c.id}
                  c={c}
                  now={now}
                  mine
                  thread={c.reports}
                  onSave={(body, kept) => saveMyComment(c, body, kept)}
                  onDelete={() => delMyComment(c)}
                />
              ))}
            </div>
          ) : (
            <div className="card empty"><b>No comments yet</b><p className="muted" style={{ margin: "6px 0 0" }}>Comments you write on threads show up here, so you can edit or delete them.</p></div>
          )}
        </section>
      ) : (
        <>
          <div className="chip-bar" role="group" aria-label="Sort and filter threads" style={{ marginTop: scope === "all" ? 16 : 0 }}>
            {SORTS.map(([s, label]) => (
              <button key={s} className="chip-btn" aria-pressed={sort === s} onClick={() => setSort(s)}>{label}</button>
            ))}
            <button className="chip-btn mine" aria-pressed={mine} onClick={() => setMine((m) => !m)}>★ My airports</button>
          </div>

          <div className="airport-filter">
            {airports.length > 0 && (
              <div className="airport-filter-on">
                <div className="chips-row" aria-label="Airports you're filtering by">
                  {airports.map((c) => (
                    <button key={c} type="button" className="tag mono tag-remove" onClick={() => setAirports((a) => a.filter((x) => x !== c))} aria-label={`Stop filtering by ${c}`} title={AIRPORTS[c]?.name}>
                      {c} ✕
                    </button>
                  ))}
                </div>
                <button className="linkish" onClick={() => setAirports([])}>Clear all</button>
              </div>
            )}
            <AirportPicker label={airports.length > 0 ? "Add another airport" : "Filter by airport"} value="" onPick={addAirport} />
          </div>

          {list.length > 0 ? (
            <div className="posts" style={{ marginTop: 12 }}>
              {list.map((t) => (
                <ThreadCard
                  key={t.id}
                  t={t}
                  now={now}
                  mine={t.user_id === me.id}
                  friend={friendIds.has(t.user_id)}
                  voted={voted.has(t.id)}
                  flagged={flagged.has(t.id)}
                  onVote={() => vote(t.id)}
                  onFlag={() => flag(t.id)}
                  onEdit={() => setForm({ thread: t })}
                  onDelete={() => del(t)}
                  onPickAirport={addAirport}
                />
              ))}
            </div>
          ) : (
            <div className="card empty" style={{ marginTop: 12 }}>
              <b>
                {airports.length > 0 || mine ? "No threads match" : scope === "friends" ? "No threads from friends yet" : scope === "mine" ? "You haven’t started a thread yet" : "No threads yet"}
              </b>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                {airports.length > 0 || mine ? "Try other airports, or clear the filters." : scope === "friends" ? "Threads your friends post show up here." : "Be the first to share what you’re seeing at an airport."}
              </p>
            </div>
          )}
        </>
      )}

      {form && <ThreadForm thread={form.thread} onClose={() => setForm(null)} onSave={save} />}
    </>
  );
}
