"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Banner } from "./banners";
import type { Flight } from "./core";
import { parseBanner, toFlight, type FlightRow } from "./db";
import { useSupabase } from "./supabase";
import { useMe } from "./useMe";

/** One of your friends (accepted), with the profile they share with friends. */
export type Person = {
  id: string; // their Clerk user id
  username: string;
  name: string;
  color: string;
  home: string;
  bio: string;
  banner: Banner;
  photo: string | null;
  joined: string;
  friendshipId: string;
};

/** A friend request waiting on you (incoming) or on them (outgoing). Only safe fields are visible. */
export type FriendRequest = { friendshipId: string; id: string; username: string; name: string; color: string };

/** Where you stand with someone: your own profile, nothing yet, you asked, they asked, or friends. */
export type Relation = "self" | "none" | "requested" | "incoming" | "friends";

/** What anyone signed in can see of a person before they're friends. */
export type Preview = { id: string; username: string; name: string; color: string; banner: Banner; relation: Relation; friendshipId: string | null };

type Summary = {
  friendship_id: string; status: "pending" | "accepted"; direction: "incoming" | "outgoing";
  other_user_id: string; username: string; display_name: string; avatar_color: string;
  requester_seen: boolean; created_at: string; accepted_at: string | null;
};
type ProfileRow = {
  user_id: string; username: string; display_name: string; bio: string; home_city: string;
  avatar_color: string; photo_url: string | null; banner: unknown; created_at: string;
};

type Ctx = {
  friends: Person[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  /** usernames of people who accepted your request since you last opened Friends */
  fresh: string[];
  /** number on the red dot in the nav: requests to answer + new acceptances */
  badge: number;
  loading: boolean;
  error: string | null;
  /** A friend's visible flights (the ones they haven't hidden). */
  flightsOf: (userId: string) => Flight[];
  /** Each returns an error message, or null when it worked. */
  /** The five closest username matches for what's typed (at least 2 characters). */
  find: (query: string) => Promise<{ username: string; name: string; relation: Relation }[]>;
  /** The limited public view of one exact username, or null if there's no such person. */
  preview: (username: string) => Promise<Preview | null>;
  send: (username: string) => Promise<string | null>;
  accept: (friendshipId: string) => Promise<string | null>;
  decline: (friendshipId: string) => Promise<string | null>;
  remove: (friendshipId: string) => Promise<string | null>;
  markSeen: () => Promise<void>;
  refresh: () => Promise<void>;
};

const FriendsContext = createContext<Ctx | null>(null);
const POLL_MS = 30_000;

/**
 * Your friends, requests and their flights, from Supabase. Friends see each other only after a request is
 * accepted (enforced in the database). There is no push yet, so this refreshes every 30 seconds and when you
 * come back to the tab.
 */
export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const supabase = useSupabase();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [flights, setFlights] = useState<Record<string, Flight[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!me.id) return;
    const { data: sums, error: e } = await supabase.rpc("friend_summaries");
    if (!alive.current) return;
    if (e) { setError(e.message); setLoading(false); return; }
    const rows = (sums ?? []) as Summary[];
    const ids = rows.filter((s) => s.status === "accepted").map((s) => s.other_user_id);
    let profs: ProfileRow[] = [];
    const byFriend: Record<string, Flight[]> = {};
    if (ids.length) {
      const [p, f] = await Promise.all([
        supabase.from("profiles").select("user_id,username,display_name,bio,home_city,avatar_color,photo_url,banner,created_at").in("user_id", ids),
        supabase.from("flights").select("*").in("user_id", ids), // row-level security returns only what they haven't hidden
      ]);
      if (!alive.current) return;
      profs = (p.data ?? []) as ProfileRow[];
      for (const r of (f.data ?? []) as FlightRow[]) (byFriend[r.user_id] ??= []).push(toFlight(r));
    }
    setSummaries(rows);
    setProfiles(Object.fromEntries(profs.map((p) => [p.user_id, p])));
    setFlights(byFriend);
    setError(null);
    setLoading(false);
  }, [me.id, supabase]);

  useEffect(() => {
    if (!me.id) return;
    setLoading(true);
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [me.id, refresh]);

  const friends = useMemo<Person[]>(
    () =>
      summaries
        .filter((s) => s.status === "accepted")
        .map((s) => {
          const p = profiles[s.other_user_id];
          return {
            id: s.other_user_id,
            username: p?.username ?? s.username,
            name: p?.display_name || s.display_name || s.username,
            color: p?.avatar_color ?? s.avatar_color,
            home: p?.home_city ?? "",
            bio: p?.bio ?? "",
            banner: parseBanner(p?.banner),
            photo: p?.photo_url ?? null,
            joined: p ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "",
            friendshipId: s.friendship_id,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [summaries, profiles]
  );

  const asRequest = (s: Summary): FriendRequest => ({ friendshipId: s.friendship_id, id: s.other_user_id, username: s.username, name: s.display_name || s.username, color: s.avatar_color });
  const incoming = useMemo(() => summaries.filter((s) => s.status === "pending" && s.direction === "incoming").map(asRequest), [summaries]);
  const outgoing = useMemo(() => summaries.filter((s) => s.status === "pending" && s.direction === "outgoing").map(asRequest), [summaries]);
  const fresh = useMemo(() => summaries.filter((s) => s.status === "accepted" && s.direction === "outgoing" && !s.requester_seen).map((s) => s.username), [summaries]);

  const run = useCallback(
    async (call: PromiseLike<{ error: { message: string } | null }>) => {
      const { error: e } = await call;
      if (e) return e.message;
      await refresh();
      return null;
    },
    [refresh]
  );
  const send = useCallback((username: string) => run(supabase.rpc("send_friend_request", { p_username: username })), [run, supabase]);
  const find = useCallback(
    async (query: string) => {
      const { data, error: e } = await supabase.rpc("find_profiles", { p_query: query });
      if (e) throw new Error(e.message);
      return ((data ?? []) as { username: string; display_name: string; relation: Relation }[]).map((r) => ({ username: r.username, name: r.display_name || r.username, relation: r.relation }));
    },
    [supabase]
  );
  const preview = useCallback(
    async (username: string): Promise<Preview | null> => {
      const { data, error: e } = await supabase.rpc("profile_preview", { p_username: username });
      const r = (data as { user_id: string; username: string; display_name: string; avatar_color: string; banner: unknown; relation: Relation; friendship_id: string | null }[] | null)?.[0];
      if (e || !r) return null;
      return { id: r.user_id, username: r.username, name: r.display_name || r.username, color: r.avatar_color, banner: parseBanner(r.banner), relation: r.relation, friendshipId: r.friendship_id };
    },
    [supabase]
  );
  const accept = useCallback((id: string) => run(supabase.rpc("respond_friend_request", { p_id: id, p_accept: true })), [run, supabase]);
  const decline = useCallback((id: string) => run(supabase.rpc("respond_friend_request", { p_id: id, p_accept: false })), [run, supabase]);
  const remove = useCallback((id: string) => run(supabase.rpc("remove_friendship", { p_id: id })), [run, supabase]);
  const markSeen = useCallback(async () => {
    await supabase.rpc("mark_friend_accepts_seen");
    await refresh();
  }, [refresh, supabase]);
  const flightsOf = useCallback((userId: string) => flights[userId] ?? [], [flights]);

  const value = useMemo(
    () => ({ friends, incoming, outgoing, fresh, badge: incoming.length + fresh.length, loading, error, flightsOf, find, preview, send, accept, decline, remove, markSeen, refresh }),
    [friends, incoming, outgoing, fresh, loading, error, flightsOf, find, preview, send, accept, decline, remove, markSeen, refresh]
  );
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const c = useContext(FriendsContext);
  if (!c) throw new Error("useFriends must be used inside <FriendsProvider>");
  return c;
}
