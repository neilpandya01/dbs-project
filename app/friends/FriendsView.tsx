"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useFriends, type Person } from "@/lib/friendsStore";
import { DIRECTORY, USER, friendLastFlight } from "@/lib/mock";

export function FriendsView() {
  const { friends, sent, incoming, fresh, send, accept, decline, markSeen } = useFriends();
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
    const live = friends.filter((f) => f.live && match(f)).sort(byName);
    const rest = friends.filter((f) => !f.live && match(f)).sort(byName);
    return [
      ...(live.length ? [{ title: "In the air now", people: live }] : []),
      ...(rest.length ? [{ title: live.length ? "On the ground" : "Friends", people: rest }] : []),
    ];
  }, [friends, search]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const u = value.trim().replace(/^@/, "").toLowerCase();
    if (!u) return setMsg({ ok: false, text: "Enter a username." });
    if (u === USER.username) return setMsg({ ok: false, text: "That's you!" });
    if ([...friends, ...sent].some((f) => f.username === u))
      return setMsg({ ok: false, text: `@${u} is already ${friends.some((f) => f.username === u) ? "your friend" : "pending"}.` });
    const found = [...DIRECTORY, ...incoming].find((p) => p.username === u);
    if (!found) return setMsg({ ok: false, text: `No user @${u} found. (Try @tailstrike or @squawk7700 in this preview.)` });
    send(found);
    setValue("");
    setMsg({ ok: true, text: `Request sent to @${found.username}.` });
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
          <button className="btn primary" type="submit">Send request</button>
        </form>
        <p className={`msg ${msg?.ok ? "ok" : "err"}`} role="status" aria-live="polite">{msg?.text}</p>
      </div>

      {(incoming.length > 0 || sent.length > 0) && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Requests</h2>
          {incoming.map((p) => (
            <div className="flight-row" key={p.username}>
              <Avatar name={p.name} color={p.color} size={36} />
              <div className="grow"><b>{p.name}</b><div className="sub">@{p.username}</div></div>
              <button className="btn small primary" onClick={() => accept(p)}>Accept</button>
              <button className="btn small" onClick={() => decline(p.username)}>Decline</button>
            </div>
          ))}
          {sent.map((p) => (
            <div className="flight-row" key={p.username}>
              <Avatar name={p.name} color={p.color} size={36} />
              <div className="grow"><b>{p.name}</b><div className="sub">@{p.username}</div></div>
              <span className="badge">Pending</span>
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
          {sec.people.map((f) => (
            <Link key={f.username} href={`/friends/${encodeURIComponent(f.username)}`} className="friend-row" aria-label={`View ${f.name}’s profile`}>
              <span className={`friend-avatar${f.live ? " live" : ""}`}><Avatar name={f.name} color={f.color} size={44} /></span>
              <span className="friend-main">
                <span className="friend-name">
                  <b>{f.name}</b>
                  {justAccepted.includes(f.username) && <span className="badge accent">New</span>}
                </span>
                <span className="friend-sub muted">@{f.username} · {f.home}</span>
                {f.live ? (
                  <span className="friend-status live"><span className="dot pulse" aria-hidden="true" /> {f.live.number} · {f.live.from} → {f.live.to}</span>
                ) : friendLastFlight(f.username) ? (
                  <span className="friend-status muted">Last flight: {friendLastFlight(f.username)}</span>
                ) : null}
              </span>
              <span className="row-chev" aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
      ))}
      {sections.length === 0 && <p className="muted" style={{ textAlign: "center", padding: "24px 0" }}>No friends match “{search}”.</p>}
    </>
  );
}
