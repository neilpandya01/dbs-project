"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useProfile } from "@/lib/profileStore";
import { FRIENDS, MY_FLIGHTS, NEWS, airportsInMetro, airportsNear, type NewsItem } from "@/lib/mock";

type Filter = "all" | "alert" | "headline" | "report";

const SEV = {
  stop: { label: "Ground stop", cls: "stop" },
  delay: { label: "Delays", cls: "delay" },
  info: { label: "Advisory", cls: "info" },
} as const;

const COLORS = Object.fromEntries(FRIENDS.map((f) => [`@${f.username}`, f.color]));

function StatusTile({ n }: { n: NewsItem }) {
  const sev = SEV[n.severity ?? "info"];
  return (
    <article className={`board-tile ${sev.cls}`}>
      <div className="code mono">{n.tags[0]}</div>
      <div className="state"><i /> {sev.label}</div>
      <p>{n.summary}</p>
      <time>{n.source} · {n.when}</time>
    </article>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return <>{tags.map((t) => <span key={t} className="tag mono">{t}</span>)}</>;
}

function Featured({ n }: { n: NewsItem }) {
  return (
    <article className="featured">
      <div className="kicker">Top story · {n.source}</div>
      <h3>{n.title}</h3>
      <p>{n.summary}</p>
      <div className="byline"><Tags tags={n.tags} /><span>{n.when}</span></div>
    </article>
  );
}

function Story({ n }: { n: NewsItem }) {
  return (
    <article className="story">
      <div className="kicker">{n.source} · {n.when}</div>
      <h3>{n.title}</h3>
      <p>{n.summary}</p>
      <div className="byline"><Tags tags={n.tags} /></div>
    </article>
  );
}

function Report({ n }: { n: NewsItem }) {
  const [helpful, setHelpful] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const color = COLORS[n.author ?? ""] ?? "#1f7ff0";
  const name = (n.author ?? "").replace("@", "");
  return (
    <article className="post">
      <Avatar name={name} color={color} size={38} />
      <div className="post-main">
        <div className="post-head">
          <b>{n.author}</b>
          <span className="muted">{n.when}</span>
          <span className="spacer" />
          <Tags tags={n.tags.slice(0, 2)} />
        </div>
        <h3>{n.title}</h3>
        <p>{n.summary}</p>
        <div className="post-actions">
          <button className="pill" aria-pressed={helpful} onClick={() => setHelpful((h) => !h)}>
            ▲ Helpful · {(n.helpful ?? 0) + (helpful ? 1 : 0)}
          </button>
          <button className="pill ghost" aria-pressed={flagged} onClick={() => setFlagged(true)} disabled={flagged}>
            {flagged ? "Flagged" : "Flag"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function NewsView() {
  const { profile } = useProfile();
  const MY_AIRPORTS = useMemo(
    () => new Set([
      ...(profile.homePlace ? airportsNear(profile.homePlace.lat, profile.homePlace.lon) : airportsInMetro(profile.home)),
      ...MY_FLIGHTS.flatMap((f) => [f.from, f.to]),
    ]),
    [profile.home, profile.homePlace]
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [mine, setMine] = useState(false);

  const pick = (kind: NewsItem["kind"]) =>
    NEWS.filter((n) => n.kind === kind && (!mine || n.tags.some((t) => MY_AIRPORTS.has(t))));
  const alerts = useMemo(() => pick("alert"), [mine, MY_AIRPORTS]); // eslint-disable-line react-hooks/exhaustive-deps
  const headlines = useMemo(() => pick("headline"), [mine, MY_AIRPORTS]); // eslint-disable-line react-hooks/exhaustive-deps
  const reports = useMemo(() => pick("report"), [mine, MY_AIRPORTS]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (k: Exclude<Filter, "all">) => filter === "all" || filter === k;
  const empty = (show("alert") ? alerts.length : 0) + (show("headline") ? headlines.length : 0) + (show("report") ? reports.length : 0) === 0;

  const FILTERS: [Filter, string][] = [["all", "Everything"], ["alert", "Alerts"], ["headline", "Headlines"], ["report", "From the field"]];

  return (
    <>
      <div className="chip-bar" role="group" aria-label="Filter news">
        {FILTERS.map(([f, label]) => (
          <button key={f} className="chip-btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
        ))}
        <button className="chip-btn mine" aria-pressed={mine} onClick={() => setMine((m) => !m)}>
          ★ My airports
        </button>
      </div>

      {show("alert") && alerts.length > 0 && (
        <section aria-label="Airport status">
          <h2 className="sec">Airport status <small>live</small></h2>
          <div className={`board ${filter === "alert" ? "wrap" : ""}`}>
            {alerts.map((n) => <StatusTile key={n.id} n={n} />)}
          </div>
        </section>
      )}

      {show("headline") && headlines.length > 0 && (
        <section aria-label="Headlines">
          <h2 className="sec">Headlines</h2>
          <Featured n={headlines[0]} />
          <div className="stories">{headlines.slice(1).map((n) => <Story key={n.id} n={n} />)}</div>
        </section>
      )}

      {show("report") && reports.length > 0 && (
        <section aria-label="Reports from the field">
          <h2 className="sec">From the field <small>spotted by Wingmates</small></h2>
          <div className="posts">{reports.map((n) => <Report key={n.id} n={n} />)}</div>
        </section>
      )}

      {empty && <p className="muted" style={{ textAlign: "center", padding: "40px 0" }}>Nothing here for your airports right now.</p>}
    </>
  );
}
