"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AirportPicker } from "@/components/AirportPicker";
import { AirportTags } from "@/components/AirportTags";
import { Avatar } from "@/components/Avatar";
import { UserLink } from "@/components/UserLink";
import { Sheet } from "@/components/Sheet";
import { AIRPORTS, airportsNear } from "@/lib/core";
import { useFlights } from "@/lib/flightsStore";
import { useProfile } from "@/lib/profileStore";
import { useSupabase } from "@/lib/supabase";
import {
  BODY_MAX, THREAD_COLUMNS, TITLE_MAX, activity, ago, colorFor, deleteThread, flagThread, hotScore, hotspots, trending, voteThread,
  type Thread,
} from "@/lib/threads";
import { useMe } from "@/lib/useMe";

type Sort = "hot" | "new" | "top";

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

function ThreadCard({ t, now, mine, voted, flagged, onVote, onFlag, onDelete, onPickAirport }: {
  t: Thread; now: number; mine: boolean; voted: boolean; flagged: boolean;
  onVote: () => void; onFlag: () => void; onDelete: () => void; onPickAirport: (code: string) => void;
}) {
  return (
    <article className="post">
      <UserLink username={t.author_username}><Avatar name={t.author_name || t.author_username} color={colorFor(t.author_username)} size={38} /></UserLink>
      <div className="post-main">
        <div className="post-head">
          <UserLink username={t.author_username}><b>@{t.author_username}</b></UserLink>
          <span className="muted">{ago(t.created_at, now)}</span>
          <span className="spacer" />
          <Tags tags={t.airports} onPick={onPickAirport} />
        </div>
        <h3><Link href={`/news/${t.id}`} className="thread-link">{t.title}</Link></h3>
        {t.body && <p className="clamp3">{t.body}</p>}
        <div className="post-actions">
          <button className="pill" aria-pressed={voted} onClick={onVote}>▲ Helpful · {t.helpful}</button>
          <Link href={`/news/${t.id}`} className="pill" style={{ textDecoration: "none", color: "inherit" }}>
            💬 {t.comment_count === 1 ? "1 comment" : `${t.comment_count} comments`}
          </Link>
          {mine ? (
            <button className="pill ghost" onClick={onDelete}>Delete</button>
          ) : (
            <button className="pill ghost" aria-pressed={flagged} onClick={onFlag} disabled={flagged}>{flagged ? "Flagged" : "Flag"}</button>
          )}
        </div>
      </div>
    </article>
  );
}

function ThreadForm({ onClose, onPost }: { onClose: () => void; onPost: (airports: string[], title: string, body: string) => Promise<string | null> }) {
  const [airports, setAirports] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) return setError("Give your thread a short title (at least 3 characters).");
    setBusy(true);
    setError(null);
    const err = await onPost(airports, title.trim(), body.trim());
    if (err) { setError(err); setBusy(false); }
  };

  return (
    <Sheet title="Start a thread" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="form-hint">Share what you see: a diversion, a delay, a rare visitor, airport news. Anyone on Wingmates can read it and reply.</p>
        <label>
          <span>Title <small>{title.length}/{TITLE_MAX}</small></span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} />
        </label>
        <label>
          <span>Details <small>optional · {body.length}/{BODY_MAX}</small></span>
          <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} />
        </label>
        <AirportTags value={airports} onChange={setAirports} />
        {error && <p className="msg err" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Posting…" : "Post thread"}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}

export function NewsView() {
  const { profile } = useProfile();
  const { flights } = useFlights();
  const me = useMe();
  const supabase = useSupabase();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("hot");
  const [mine, setMine] = useState(false);
  const [airport, setAirport] = useState(""); // show only threads tagged with this airport
  const [posting, setPosting] = useState(false);
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

  // "My airports": near your home city, plus every airport you've flown to or from
  const myAirports = useMemo(
    () => new Set([...(profile.homePlace ? airportsNear(profile.homePlace.lat, profile.homePlace.lon) : []), ...flights.flatMap((f) => [f.from, f.to])]),
    [profile.homePlace, flights]
  );

  // summaries built from volume: which airports are busy right now, and which threads people are reacting to
  const spots = useMemo(() => hotspots(threads, now), [threads, now]);
  const hot = useMemo(() => trending(threads, now), [threads, now]);

  const list = useMemo(() => {
    const f = threads.filter((t) => (!mine || t.airports.some((c) => myAirports.has(c))) && (!airport || t.airports.includes(airport)));
    if (sort === "new") return [...f].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    if (sort === "top") return [...f].sort((a, b) => activity(b) - activity(a) || Date.parse(b.created_at) - Date.parse(a.created_at));
    return [...f].sort((a, b) => hotScore(b, now) - hotScore(a, now));
  }, [threads, mine, myAirports, airport, sort, now]);

  const post = async (airports: string[], title: string, body: string) => {
    const { data, error: e } = await supabase.from("reports").insert({ airports, title, body }).select(THREAD_COLUMNS).single();
    if (e) return e.message;
    setThreads((r) => [data as Thread, ...r]);
    setNow(Date.now());
    setPosting(false);
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
  const del = async (id: string) => {
    if (!(await deleteThread(supabase, id))) setThreads((rs) => rs.filter((r) => r.id !== id));
  };

  const SORTS: [Sort, string][] = [["hot", "🔥 Hot"], ["new", "New"], ["top", "Top"]];

  if (loading) return <div className="loading-block" role="status">Loading threads…</div>;

  return (
    <>
      {error && <p className="msg err" role="alert">Couldn’t load threads: {error}</p>}

      <div className="section-bar" style={{ margin: "0 0 10px" }}>
        <h2 className="sec" style={{ margin: 0 }}>Community threads <small>reported by Wingmates</small></h2>
        <button className="btn primary" onClick={() => setPosting(true)}>＋ Start a thread</button>
      </div>

      {spots.length > 0 && !airport && (
        <section aria-label="Developing now">
          <h2 className="sec">Developing now <small>airports with the most reports in the last 24 hours</small></h2>
          <div className="hotspots">
            {spots.map((s) => (
              <button key={s.code} type="button" className="hotspot" onClick={() => setAirport(s.code)} aria-label={`Show threads about ${s.code}`}>
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

      {hot.length > 0 && !airport && (
        <section aria-label="Trending threads">
          <h2 className="sec">Trending <small>what people are reacting to</small></h2>
          <div className="trending">
            {hot.map((t, i) => (
              <Link key={t.id} href={`/news/${t.id}`} className="trend-row">
                <span className="trend-n">{i + 1}</span>
                <span className="trend-main">
                  <b>{t.title}</b>
                  <span className="muted">▲ {t.helpful} · 💬 {t.comment_count}{t.airports.length > 0 ? ` · ${t.airports.join(", ")}` : ""}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="chip-bar" role="group" aria-label="Sort and filter threads" style={{ marginTop: 16 }}>
        {SORTS.map(([s, label]) => (
          <button key={s} className="chip-btn" aria-pressed={sort === s} onClick={() => setSort(s)}>{label}</button>
        ))}
        <button className="chip-btn mine" aria-pressed={mine} onClick={() => setMine((m) => !m)}>★ My airports</button>
      </div>

      <div className="airport-filter">
        {airport ? (
          <div className="airport-filter-on">
            <span>Showing threads about <b className="mono">{airport}</b>{AIRPORTS[airport] ? ` · ${AIRPORTS[airport].name}` : ""}</span>
            <button className="linkish" onClick={() => setAirport("")}>Clear</button>
          </div>
        ) : (
          <AirportPicker label="Filter by airport" optional value="" onPick={setAirport} />
        )}
      </div>

      {list.length > 0 ? (
        <div className="posts" style={{ marginTop: 12 }}>
          {list.map((t) => (
            <ThreadCard
              key={t.id}
              t={t}
              now={now}
              mine={t.user_id === me.id}
              voted={voted.has(t.id)}
              flagged={flagged.has(t.id)}
              onVote={() => vote(t.id)}
              onFlag={() => flag(t.id)}
              onDelete={() => del(t.id)}
              onPickAirport={setAirport}
            />
          ))}
        </div>
      ) : (
        <div className="card empty" style={{ marginTop: 12 }}>
          <b>{airport || mine ? "No threads match" : "No threads yet"}</b>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {airport || mine ? "Try another airport, or clear the filters." : "Be the first to share what you’re seeing at an airport."}
          </p>
        </div>
      )}

      {posting && <ThreadForm onClose={() => setPosting(false)} onPost={post} />}
    </>
  );
}
