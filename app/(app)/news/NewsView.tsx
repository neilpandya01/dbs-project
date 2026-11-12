"use client";

import { useEffect, useMemo, useState } from "react";
import { AirportPicker } from "@/components/AirportPicker";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import { airportsNear } from "@/lib/core";
import { useFlights } from "@/lib/flightsStore";
import { useProfile } from "@/lib/profileStore";
import { useSupabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";

type Filter = "all" | "alert" | "headline" | "report";

/** A row of Supabase `news_items`: headlines and airport alerts that background workers will fill in later. */
type NewsRow = {
  id: string; kind: "headline" | "alert"; severity: "info" | "delay" | "stop" | null; title: string; summary: string;
  source: string; url: string | null; tags: string[]; published_at: string;
};
/** A row of Supabase `reports`: posts from people using Wingmates. */
type ReportRow = {
  id: string; user_id: string; author_username: string; author_name: string; airport: string | null;
  title: string; body: string; helpful: number; created_at: string;
};

const SEV = {
  stop: { label: "Ground stop", cls: "stop" },
  delay: { label: "Delays", cls: "delay" },
  info: { label: "Advisory", cls: "info" },
} as const;

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

/** A steady colour for a username, so the same person always gets the same avatar. */
function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

const safeUrl = (u: string | null) => (u && /^https:\/\//i.test(u) ? u : null);

function Tags({ tags }: { tags: string[] }) {
  return <>{tags.map((t) => <span key={t} className="tag mono">{t}</span>)}</>;
}

function StatusTile({ n, now }: { n: NewsRow; now: number }) {
  const sev = SEV[n.severity ?? "info"];
  return (
    <article className={`board-tile ${sev.cls}`}>
      <div className="code mono">{n.tags[0] ?? "—"}</div>
      <div className="state"><i /> {sev.label}</div>
      <p>{n.summary || n.title}</p>
      <time>{n.source} · {ago(n.published_at, now)}</time>
    </article>
  );
}

function Featured({ n, now }: { n: NewsRow; now: number }) {
  const url = safeUrl(n.url);
  return (
    <article className="featured">
      <div className="kicker">Top story · {n.source}</div>
      <h3>{n.title}</h3>
      {n.summary && <p>{n.summary}</p>}
      <div className="byline"><Tags tags={n.tags} /><span>{ago(n.published_at, now)}</span></div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="source-link">Read at {n.source} ↗</a>}
    </article>
  );
}

function Story({ n, now }: { n: NewsRow; now: number }) {
  const url = safeUrl(n.url);
  return (
    <article className="story">
      <div className="kicker">{n.source} · {ago(n.published_at, now)}</div>
      <h3>{n.title}</h3>
      {n.summary && <p>{n.summary}</p>}
      <div className="byline">
        <Tags tags={n.tags} />
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="source-link" style={{ marginLeft: "auto" }}>Read at source ↗</a>}
      </div>
    </article>
  );
}

function Report({ r, now, mine, voted, flagged, onVote, onFlag, onDelete }: {
  r: ReportRow; now: number; mine: boolean; voted: boolean; flagged: boolean;
  onVote: () => void; onFlag: () => void; onDelete: () => void;
}) {
  return (
    <article className="post">
      <Avatar name={r.author_name || r.author_username} color={colorFor(r.author_username)} size={38} />
      <div className="post-main">
        <div className="post-head">
          <b>@{r.author_username}</b>
          <span className="muted">{ago(r.created_at, now)}</span>
          <span className="spacer" />
          {r.airport && <Tags tags={[r.airport]} />}
        </div>
        <h3>{r.title}</h3>
        {r.body && <p>{r.body}</p>}
        <div className="post-actions">
          <button className="pill" aria-pressed={voted} onClick={onVote}>▲ Helpful · {r.helpful}</button>
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

function ReportForm({ onClose, onPost }: { onClose: () => void; onPost: (airport: string, title: string, body: string) => Promise<string | null> }) {
  const [airport, setAirport] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) return setError("Give your report a short title (at least 3 characters).");
    setBusy(true);
    setError(null);
    const err = await onPost(airport, title.trim(), body.trim());
    if (err) { setError(err); setBusy(false); }
  };

  return (
    <Sheet title="Post a report" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="form-hint">Share what you see: a diversion, a delay, a rare visitor, airport news. Reports are visible to everyone on Wingmates.</p>
        <AirportPicker label="Airport" optional value={airport} onPick={setAirport} />
        <label>
          <span>Title <small>{title.length}/120</small></span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label>
          <span>Details <small>optional · {body.length}/500</small></span>
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} />
        </label>
        {error && <p className="msg err" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Posting…" : "Post report"}</button>
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

  const [feed, setFeed] = useState<NewsRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [mine, setMine] = useState(false);
  const [posting, setPosting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!me.id) return;
    let alive = true;
    (async () => {
      const [n, r, v, f] = await Promise.all([
        supabase.from("news_items").select("*").order("published_at", { ascending: false }).limit(60),
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(60),
        supabase.from("report_votes").select("report_id"),
        supabase.from("report_flags").select("report_id"),
      ]);
      if (!alive) return;
      const err = n.error ?? r.error;
      if (err) setError(err.message);
      else {
        setFeed((n.data ?? []) as NewsRow[]);
        setReports((r.data ?? []) as ReportRow[]);
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

  const alerts = useMemo(() => feed.filter((n) => n.kind === "alert" && (!mine || n.tags.some((t) => myAirports.has(t)))), [feed, mine, myAirports]);
  const headlines = useMemo(() => feed.filter((n) => n.kind === "headline" && (!mine || n.tags.some((t) => myAirports.has(t)))), [feed, mine, myAirports]);
  const posts = useMemo(() => reports.filter((r) => !mine || (r.airport && myAirports.has(r.airport))), [reports, mine, myAirports]);

  const show = (k: Exclude<Filter, "all">) => filter === "all" || filter === k;

  const post = async (airport: string, title: string, body: string) => {
    const { data, error: e } = await supabase.from("reports").insert({ airport: airport || null, title, body }).select("*").single();
    if (e) return e.message;
    setReports((r) => [data as ReportRow, ...r]);
    setNow(Date.now());
    setPosting(false);
    return null;
  };

  const vote = async (id: string) => {
    const on = voted.has(id);
    setVoted((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, helpful: Math.max(0, r.helpful + (on ? -1 : 1)) } : r)));
    const { error: e } = on ? await supabase.from("report_votes").delete().eq("report_id", id) : await supabase.from("report_votes").insert({ report_id: id });
    if (e) {
      setVoted((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
      setReports((rs) => rs.map((r) => (r.id === id ? { ...r, helpful: Math.max(0, r.helpful + (on ? 1 : -1)) } : r)));
    }
  };
  const flag = async (id: string) => {
    setFlagged((s) => new Set(s).add(id));
    const { error: e } = await supabase.rpc("flag_report", { p_id: id });
    if (e) setFlagged((s) => { const n = new Set(s); n.delete(id); return n; });
  };
  const del = async (id: string) => {
    const { error: e } = await supabase.from("reports").delete().eq("id", id);
    if (!e) setReports((rs) => rs.filter((r) => r.id !== id));
  };

  const FILTERS: [Filter, string][] = [["all", "Everything"], ["alert", "Alerts"], ["headline", "Headlines"], ["report", "From the field"]];

  if (loading) return <div className="loading-block" role="status">Loading news…</div>;

  return (
    <>
      {error && <p className="msg err" role="alert">Couldn’t load news: {error}</p>}
      <div className="chip-bar" role="group" aria-label="Filter news">
        {FILTERS.map(([f, label]) => (
          <button key={f} className="chip-btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
        ))}
        <button className="chip-btn mine" aria-pressed={mine} onClick={() => setMine((m) => !m)}>★ My airports</button>
      </div>

      {show("alert") && (
        <section aria-label="Airport status">
          <h2 className="sec">Airport status <small>live</small></h2>
          {alerts.length > 0 ? (
            <div className={`board ${filter === "alert" ? "wrap" : ""}`}>{alerts.map((n) => <StatusTile key={n.id} n={n} now={now} />)}</div>
          ) : (
            <p className="muted empty-line">{mine ? "No alerts for your airports." : "Live airport alerts (ground stops, delays) are coming soon."}</p>
          )}
        </section>
      )}

      {show("headline") && (
        <section aria-label="Headlines">
          <h2 className="sec">Headlines</h2>
          {headlines.length > 0 ? (
            <>
              <Featured n={headlines[0]} now={now} />
              <div className="stories">{headlines.slice(1).map((n) => <Story key={n.id} n={n} now={now} />)}</div>
            </>
          ) : (
            <p className="muted empty-line">{mine ? "No headlines for your airports." : "Aviation headlines are coming soon."}</p>
          )}
        </section>
      )}

      {show("report") && (
        <section aria-label="Reports from the field">
          <div className="section-bar" style={{ margin: "22px 0 10px" }}>
            <h2 className="sec" style={{ margin: 0 }}>From the field <small>posted by Wingmates</small></h2>
            <button className="btn primary" onClick={() => setPosting(true)}>＋ Post a report</button>
          </div>
          {posts.length > 0 ? (
            <div className="posts">
              {posts.map((r) => (
                <Report
                  key={r.id}
                  r={r}
                  now={now}
                  mine={r.user_id === me.id}
                  voted={voted.has(r.id)}
                  flagged={flagged.has(r.id)}
                  onVote={() => vote(r.id)}
                  onFlag={() => flag(r.id)}
                  onDelete={() => del(r.id)}
                />
              ))}
            </div>
          ) : (
            <div className="card empty">
              <b>{mine ? "No reports for your airports yet" : "No reports yet"}</b>
              <p className="muted" style={{ margin: "6px 0 0" }}>Be the first to share what you’re seeing at an airport.</p>
            </div>
          )}
        </section>
      )}

      {posting && <ReportForm onClose={() => setPosting(false)} onPost={post} />}
    </>
  );
}
