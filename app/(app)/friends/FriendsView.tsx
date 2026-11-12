"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useNow } from "@/components/useNow";
import { useFriends, type Person, type Relation } from "@/lib/friendsStore";
import { liveFlight } from "@/lib/live";
import { useProfile } from "@/lib/profileStore";

export function FriendsView() {
  const { friends, outgoing, incoming, fresh, loading, error, flightsOf, find, preview, accept, decline, remove, markSeen } = useFriends();
  const { profile } = useProfile();
  const router = useRouter();
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

  // removing a friend straight from the list (asks first)
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);
  /** Run a request action; if it fails, say so instead of silently doing nothing. */
  const act = async (p: Promise<string | null>) => { const err = await p; setRemoveMsg(err ? `That didn’t work: ${err}` : null); };
  const removeFriend = async (f: Person) => {
    setRemoving(true);
    const err = await remove(f.friendshipId);
    setRemoving(false);
    if (err) return setRemoveMsg(`Couldn’t remove ${f.name}: ${err}`);
    setConfirmId(null);
  };

  // The five closest username matches for what's typed so far.
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ username: string; name: string; relation: Relation }[]>([]);
  useEffect(() => {
    const q = value.trim().replace(/^@/, "");
    if (q.length < 2) { setSuggestions([]); setSearchError(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      find(q)
        .then((r) => { if (alive) { setSuggestions(r.filter((s) => s.username.toLowerCase() !== profile.username.toLowerCase())); setSearchError(null); } })
        .catch((e: Error) => { if (alive) { setSuggestions([]); setSearchError(e.message); } });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [value, find, profile.username]);

  /** Open the person's profile (limited until they're a friend), where the request button lives. */
  const lookUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = value.trim().replace(/^@/, "").toLowerCase();
    if (!u) return setMsg({ ok: false, text: "Enter a username." });
    if (u === profile.username.toLowerCase()) return setMsg({ ok: false, text: "That's you!" });
    setBusy(true);
    // an exact username opens right away; otherwise the closest match does
    const found = (await preview(u)) ?? (await find(u).catch(() => []))[0];
    setBusy(false);
    if (!found) return setMsg({ ok: false, text: `No one found for “${u}”.` });
    router.push(`/friends/${encodeURIComponent(found.username)}`);
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
        <h2>Find people</h2>
        <form className="add-row" onSubmit={lookUp}>
          <label className="at" style={{ display: "block" }}>
            <span aria-hidden="true">@</span>
            <input className="input"  aria-label="Username" value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Looking…" : "Find"}</button>
        </form>
        {searchError && <p className="msg err" role="alert">Search isn’t working: {searchError}</p>}
        {suggestions.length > 0 && (
          <ul className="suggest-list" aria-label="Closest matches">
            {suggestions.map((s) => (
              <li key={s.username}>
                <Link href={`/friends/${encodeURIComponent(s.username)}`} className="suggest-row">
                  <span><b>{s.name}</b> <span className="muted">@{s.username}</span></span>
                  {s.relation !== "none" && <span className="badge">{{ friends: "Friends", requested: "Requested", incoming: "Wants to connect", self: "", none: "" }[s.relation]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className={`msg ${msg?.ok ? "ok" : "err"}`} role="status" aria-live="polite">{msg?.text}</p>
      </div>

      {error && <p className="msg err" role="alert" style={{ marginTop: 12 }}>Couldn’t refresh friends: {error}</p>}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Requests</h2>
          {incoming.map((p) => (
            <div className="flight-row" key={p.friendshipId}>
              <Avatar name={p.name} color={p.color} size={36} />
              <Link href={`/friends/${encodeURIComponent(p.username)}`} className="grow" style={{ color: "inherit", textDecoration: "none" }}><b>{p.name}</b><div className="sub">@{p.username}</div></Link>
              <button className="btn small primary" onClick={() => act(accept(p.friendshipId))}>Accept</button>
              <button className="btn small" onClick={() => act(decline(p.friendshipId))}>Decline</button>
            </div>
          ))}
          {outgoing.map((p) => (
            <div className="flight-row" key={p.friendshipId}>
              <Avatar name={p.name} color={p.color} size={36} />
              <Link href={`/friends/${encodeURIComponent(p.username)}`} className="grow" style={{ color: "inherit", textDecoration: "none" }}><b>{p.name}</b><div className="sub">@{p.username}</div></Link>
              <span className="badge">Requested</span>
              <button className="btn small" onClick={() => act(remove(p.friendshipId))} aria-label={`Cancel request to @${p.username}`}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      <div className="friends-head">
        <h2 className="sec">Your friends <small>{friends.length}</small></h2>
      </div>
      <div className="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" className="input" placeholder="Search" aria-label="Search friends by name or username" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {removeMsg && <p className="msg err" role="alert">{removeMsg}</p>}
      {sections.map((sec) => (
        <section key={sec.title} className="card friend-list" aria-label={sec.title}>
          <h3 className="friend-list-title">{sec.title} <span className="muted">· {sec.people.length}</span></h3>
          {sec.people.map((f) => {
            const live = liveFlight(flightsOf(f.id), now);
            return (
            <div key={f.username} className="friend-row-wrap">
            {confirmId === f.id ? (
              <div className="confirm-delete friend-confirm" role="alertdialog" aria-label={`Remove ${f.name}`}>
                <p><b>Remove {f.name}?</b> You’ll stop seeing each other’s flights. You can send a new request later.</p>
                <div className="form-actions">
                  <button type="button" className="btn danger solid" disabled={removing} onClick={() => removeFriend(f)}>{removing ? "Removing…" : "Yes, remove"}</button>
                  <button type="button" className="btn" disabled={removing} onClick={() => setConfirmId(null)}>Keep</button>
                </div>
              </div>
            ) : (
              <>
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
                  ) : null}
                </span>
              </Link>
                <button type="button" className="friend-remove" onClick={() => { setConfirmId(f.id); setRemoveMsg(null); }} aria-label={`Remove ${f.name} as a friend`}>Remove</button>
              </>
            )}
            </div>
            );
          })}
        </section>
      ))}
      {!loading && friends.length === 0 && (
        <div className="card empty" style={{ marginTop: 12 }}>
          <b>No friends yet</b>
          <p className="muted" style={{ margin: 0 }}>Find people by username above and send a request. Once it’s accepted, you’ll see each other’s flights.</p>
        </div>
      )}
      {friends.length > 0 && sections.length === 0 && <p className="muted" style={{ textAlign: "center", padding: "24px 0" }}>No friends match “{search}”.</p>}
    </>
  );
}
