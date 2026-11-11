"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProfileLayout } from "@/components/ProfileLayout";
import { useNow } from "@/components/useNow";
import { friendFlights } from "@/lib/friendFlights";
import { useFriends } from "@/lib/friendsStore";

/** A friend's profile: the same page as yours, read-only. */
export function FriendProfile({ username }: { username: string }) {
  const { friends } = useFriends();
  const nowOrNull = useNow();
  const now = nowOrNull ?? new Date();
  const friend = friends.find((f) => f.username === username);
  const flights = useMemo(() => (friend ? friendFlights(friend, now) : []), [friend, now]);

  if (!friend) {
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
        who={{ name: friend.name, username: friend.username, home: friend.home, bio: friend.bio, photo: null, color: friend.color, banner: { kind: "preset", id: friend.banner }, joined: friend.joined }}
        subtitle={`From ${friend.home}`}
        friendCount={friend.friendCount}
        flights={flights}
        now={now}
      />
    </>
  );
}
