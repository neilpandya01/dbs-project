"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProfileLayout } from "@/components/ProfileLayout";
import { useNow } from "@/components/useNow";
import { useFriends } from "@/lib/friendsStore";

/** A friend's profile: the same page as yours, read-only. Only friends can open it (the database enforces that too). */
export function FriendProfile({ username }: { username: string }) {
  const { friends, flightsOf, loading, remove } = useFriends();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const now = useNow() ?? new Date();
  const friend = friends.find((f) => f.username.toLowerCase() === username.toLowerCase());

  if (!friend) {
    if (loading) return <div className="loading-block" role="status">Loading…</div>;
    return (
      <div className="card empty" style={{ marginTop: 14 }}>
        <b>@{username} isn’t one of your friends yet</b>
        <p className="muted">Profiles are only visible to friends. Send a request from the Friends tab.</p>
        <Link href="/friends" className="btn primary" style={{ textDecoration: "none", display: "inline-block" }}>Back to friends</Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/friends" className="back-link">‹ Friends</Link>
      <ProfileLayout
        who={{ name: friend.name, username: friend.username, home: friend.home, bio: friend.bio, photo: friend.photo, color: friend.color, banner: friend.banner, joined: friend.joined }}
        subtitle={friend.home ? `From ${friend.home}` : "Friend"}
        flights={flightsOf(friend.id)}
        now={now}
      />

      <div className="remove-friend">
        {!confirming ? (
          <button className="linkish danger-link" onClick={() => setConfirming(true)}>Remove friend</button>
        ) : (
          <div className="confirm-delete" role="alertdialog" aria-label="Confirm remove friend">
            <p><b>Remove {friend.name} as a friend?</b> You’ll stop seeing each other’s flights. You can send a new request later.</p>
            <div className="form-actions">
              <button className="btn danger solid" onClick={async () => {
                const err = await remove(friend.friendshipId);
                if (err) { setRemoveError(err); setConfirming(false); } else router.push("/friends");
              }}>Yes, remove</button>
              <button className="btn" onClick={() => setConfirming(false)}>Keep</button>
            </div>
          </div>
        )}
        {removeError && <p className="msg err" role="alert">{removeError}</p>}
      </div>
    </>
  );
}
