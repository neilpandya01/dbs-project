"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useNow } from "@/components/useNow";
import type { Flight } from "@/lib/core";
import { useFriends, type Person } from "@/lib/friendsStore";
import { liveFlight } from "@/lib/live";
import { useMe } from "@/lib/useMe";

/** "UA 838 · Oct 14": the most recent flight a friend has taken. */
function lastFlight(flights: Flight[], now: Date) {
  const today = now.toISOString().slice(0, 10);
  const last = flights.filter((f) => f.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return null;
  const d = new Date(last.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${last.number ?? `${last.from} → ${last.to}`} · ${d}`;
}

export function FriendsView() {
  const { friends, outgoing, incoming, fresh, loading, error, flightsOf, send, accept, decline, remove, markSeen } = useFriends();
  const me = useMe();
  const now = useNow() ?? new Date();
  // people who accepted since you last looked: shown here, and the red dot in the nav clears
  const [justAccepted, setJustAccepted] = useState<string[]>([]);
  useEffect(() => {
    if (fresh.length === 0) return;
    setJustAccepted((prev) => [...new Set([...prev, ...fresh])]);
    markSeen();
  }, [fresh, markSeen]);
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");

  // friends in the air come first; everyone else follows alphabetically
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (f: Person) => !q || `${f.name} ${f.username}`.toLowerCase().includes(q.replace(/^@/, ""));
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name);
    const isLive = (f: Person) => !!liveFlight(flightsOf(f.id), now);
    const live = friends.filter((f) => isLive(f) && match(f)).sort(byName);
    const rest = friends.filter((f) => !isLive(f) && match(f)).sort(byName);
    return [
      ...(live.length ? [{ title: "In the air now", people: live }] : []),
      ...(rest.length ? [{ title: live.length ? "On the ground" : "Friends", people: rest }] : []),
    ];
  }, [friends, search, flightsOf, now]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = value.trim().replace(/^@/, "").toLowerCase();
    if (!u) return setMsg({ ok: false, text: "Enter a username." });
    if (u === me.username.toLowerCase()) return setMsg({ ok: false, text: "That's you!" });
    setBusy(true);
    const err = await send(u);
    setBusy(false);
    if (err) return setMsg({ ok: false, text: err });
    setValue("");
    setMsg({ ok: true, text: `Request sent to @${u}.` });
  };

  return (
    <>
      {justAccepted.map((u) => {
        const p = friends.find((f) => f.username === u);
        return p ? (
          <div className="notice" key={u} role="status">
            <Avatar name={p.name} color={p.color} size={32} />
            <span className="notice-text"><b>{p.name}</b> accepted your friend request</span>
            <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setJustAccepted((j) => j.filter((x) => x !== u))} aria-label="Dismiss">✕</button>
          </div>
        ) : null;
      })}

      <div className="card" style={justAccepted.length ? { marginTop: 12 } : undefined}>
        <h2>Add a friend</h2>
        <form className="add-row" onSubmit={add}>
          <label className="at" style={{ display: "block" }}>
            <span aria-hidden="true">@</span>
            <input className="input" placeholder="username" aria-label="Friend's username" value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
        </form>
        <p className={`msg ${msg?.ok ? "ok" : "err"}`} role="status" aria-live="polite">{msg?.text}</p>
      </div>

      {error && <p className="msg err" role="alert" style={{ marginTop: 12 }}>Couldn’t refresh friends: {error}</p>}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Requests</h2>
          {incoming.map((p) => (
            <div className="flight-row" key={p.friendshipId}>
              <Avatar name={p.name} color={p.color} size={36} />
              <div className="grow"><b>{p.name}</b><div className="sub">@{p.username}</div></div>
              <button className="btn small primary" onClick={() => accept(p.friendshipId)}>Accept</button>
              <button className="btn small" onClick={() => decline(p.friendshipId)}>Decline</button>
            </div>
          ))}
          {outgoing.map((p) => (
            <div className="flight-row" key={p.friendshipId}>
              <Avatar name={p.name} color={p.color} size={36} />
              <div className="grow"><b>{p.name}</b><div className="sub">@{p.username}</div></div>
              <span className="badge">Pending</span>
              <button className="btn small" onClick={() => remove(p.friendshipId)} aria-label={`Cancel request to @${p.username}`}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      <div className="friends-head">
        <h2 className="sec">Your friends <small>{friends.length}</small></h2>
      </div>
      <div className="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" className="input" placeholder="Search friends by name or username" aria-label="Search friends by name or username" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {sections.map((sec) => (
        <section key={sec.title} className="card friend-list" aria-label={sec.title}>
          <h3 className="friend-list-title">{sec.title} <span className="muted">· {sec.people.length}</span></h3>
          {sec.people.map((f) => {
            const live = liveFlight(flightsOf(f.id), now);
            const last = lastFlight(flightsOf(f.id), now);
            return (
            <Link key={f.username} href={`/friends/${encodeURIComponent(f.username)}`} className="friend-row" aria-label={`View ${f.name}’s profile`}>
              <span className={`friend-avatar${live ? " live" : ""}`}><Avatar name={f.name} color={f.color} size={44} src={f.photo} /></span>
              <span className="friend-main">
                <span className="friend-name">
                  <b>{f.name}</b>
                  {justAccepted.includes(f.username) && <span className="badge accent">New</span>}
                </span>
                <span className="friend-sub muted">@{f.username}{f.home ? ` · ${f.home}` : ""}</span>
                {live ? (
                  <span className="friend-status live"><span className="dot pulse" aria-hidden="true" /> {live.flight.number ?? "In flight"} · {live.flight.from} → {live.flight.to}</span>
                ) : last ? (
                  <span className="friend-status muted">Last flight: {last}</span>
                ) : null}
              </span>
              <span className="row-chev" aria-hidden="true">›</span>
            </Link>
            );
          })}
        </section>
      ))}
      {!loading && friends.length === 0 && (
        <div className="card empty" style={{ marginTop: 12 }}>
          <b>No friends yet</b>
          <p className="muted" style={{ margin: 0 }}>Type a friend’s username above and send them a request. Once they accept, you’ll see each other’s flights.</p>
        </div>
      )}
      {friends.length > 0 && sections.length === 0 && <p className="muted" style={{ textAlign: "center", padding: "24px 0" }}>No friends match “{search}”.</p>}
    </>
  );
}
