"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfileLayout } from "@/components/ProfileLayout";
import { Sheet } from "@/components/Sheet";
import { useNow } from "@/components/useNow";
import { useFriends, type Preview } from "@/lib/friendsStore";

const NO_FLIGHTS: never[] = [];

/**
 * Anyone's profile. Friends get the full page (read-only). Everyone else gets a limited view: banner, name and
 * username, with a lock, plus the button that fits where the request stands. The database decides what each
 * person may see, so this can't be bypassed from the browser.
 */
export function FriendProfile({ username }: { username: string }) {
  const { friends, flightsOf, loading, remove } = useFriends();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const now = useNow() ?? new Date();
  const friend = friends.find((f) => f.username.toLowerCase() === username.toLowerCase());

  // once removed, go back to the list without flashing the limited view
  if (done) return <div className="loading-block" role="status">Removed. Going back…</div>;

  if (!friend) {
    if (loading) return <div className="loading-block" role="status">Loading…</div>;
    return <LimitedProfile username={username} now={now} />;
  }

  const doRemove = async () => {
    setBusy(true);
    setRemoveError(null);
    const err = await remove(friend.friendshipId);
    if (err) { setRemoveError(err); setBusy(false); return; }
    setDone(true);
    router.push("/friends");
  };

  return (
    <>
      <Link href="/friends" className="back-link">‹ Friends</Link>
      <ProfileLayout
        who={{ name: friend.name, username: friend.username, home: friend.home, bio: friend.bio, photo: friend.photo, color: friend.color, banner: friend.banner, joined: friend.joined }}
        subtitle={friend.home ? `From ${friend.home}` : "Friend"}
        flights={flightsOf(friend.id)}
        now={now}
        heroActions={
          <>
            <span className="hero-btn static">✓ Friends</span>
            <button className="hero-btn danger" onClick={() => { setRemoveError(null); setConfirming(true); }}>Remove friend</button>
          </>
        }
      />

      {confirming && (
        <Sheet title="Remove friend" onClose={() => !busy && setConfirming(false)}>
          <div className="form">
            <p><b>Remove {friend.name}?</b> You’ll stop seeing each other’s flights. You can send a new request later.</p>
            {removeError && <p className="msg err" role="alert">{removeError}</p>}
            <div className="form-actions">
              <button className="btn danger solid" disabled={busy} onClick={doRemove}>{busy ? "Removing…" : "Yes, remove"}</button>
              <button className="btn" disabled={busy} onClick={() => setConfirming(false)}>Keep</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Someone who isn't a friend (yet): limited preview, and the request button for where things stand. */
function LimitedProfile({ username, now }: { username: string; now: Date }) {
  const { preview, send, accept, decline, remove } = useFriends();
  const router = useRouter();
  const [p, setP] = useState<Preview | null | undefined>(undefined); // undefined = loading, null = no such person
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setP(await preview(username)), [preview, username]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (p?.relation === "self") router.replace("/profile"); }, [p, router]);

  if (p === undefined || p?.relation === "self") return <div className="loading-block" role="status">Loading…</div>;
  if (p === null) {
    return (
      <div className="card empty" style={{ marginTop: 14 }}>
        <b>No one goes by @{username}</b>
        <p className="muted">Check the spelling and try again.</p>
        <Link href="/friends" className="btn primary" style={{ textDecoration: "none", display: "inline-block" }}>Back to friends</Link>
      </div>
    );
  }

  const run = async (action: Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await action;
    if (err) setError(err);
    else await load(); // an accepted request makes them a friend, and the full profile takes over
    setBusy(false);
  };

  const subtitle = { none: "Friends-only profile", requested: "Request sent", incoming: "Request received", friends: "Friends", self: "" }[p.relation];
  const actions =
    p.relation === "none" ? (
      <button className="hero-btn primary" disabled={busy} onClick={() => run(send(p.username))}>Add friend</button>
    ) : p.relation === "requested" ? (
      <>
        <span className="hero-btn static">Requested</span>
        <button className="hero-btn" disabled={busy} onClick={() => p.friendshipId && run(remove(p.friendshipId))}>Cancel request</button>
      </>
    ) : p.relation === "incoming" ? (
      <>
        <button className="hero-btn primary" disabled={busy} onClick={() => p.friendshipId && run(accept(p.friendshipId))}>Accept</button>
        <button className="hero-btn" disabled={busy} onClick={() => p.friendshipId && run(decline(p.friendshipId))}>Decline</button>
      </>
    ) : null;

  return (
    <>
      <Link href="/friends" className="back-link">‹ Friends</Link>
      <ProfileLayout
        limited
        who={{ name: p.name, username: p.username, home: "", bio: "", photo: null, color: p.color, banner: p.banner, joined: "" }}
        subtitle={subtitle}
        flights={NO_FLIGHTS}
        now={now}
        heroActions={actions}
      />
      {error && <p className="msg err" role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </>
  );
}
