"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FRIENDS, PENDING_INCOMING, type Friend } from "./mock";

export type Person = Friend;

const KEY = "wingmates.friends.v1";
/** Stand-in for a realtime "they accepted" event: requests you send are accepted after this long. */
const DEMO_ACCEPT_MS = 8000;

type State = {
  friends: Person[];
  /** requests you sent that haven't been answered */
  sent: Person[];
  /** requests waiting for you to answer */
  incoming: Person[];
  /** usernames of people who accepted since you last opened the Friends tab */
  fresh: string[];
};

const INITIAL: State = { friends: FRIENDS, sent: [], incoming: PENDING_INCOMING, fresh: [] };

type Ctx = State & {
  /** number shown on the red dot in the nav: requests to answer + new acceptances */
  badge: number;
  send: (p: Person) => void;
  accept: (p: Person) => void;
  decline: (username: string) => void;
  markSeen: () => void;
};

const FriendsContext = createContext<Ctx | null>(null);

const isState = (s: unknown): s is State =>
  !!s && typeof s === "object" && ["friends", "sent", "incoming", "fresh"].every((k) => Array.isArray((s as Record<string, unknown>)[k]));

/**
 * Front-end stand-in for the friendships table, saved to this browser's localStorage.
 * Swap the actions for Supabase calls (and the timer for a realtime subscription) later.
 */
export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(INITIAL); // same on server and first client render
  const [ready, setReady] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (isState(parsed)) setState(parsed);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, ready]);

  // demo: pretend each person you invited accepts a few seconds later
  useEffect(() => {
    if (!ready) return;
    for (const p of state.sent) {
      if (timers.current.has(p.username)) continue;
      timers.current.set(
        p.username,
        setTimeout(() => {
          timers.current.delete(p.username);
          setState((s) =>
            s.sent.some((x) => x.username === p.username)
              ? { ...s, sent: s.sent.filter((x) => x.username !== p.username), friends: [...s.friends, p], fresh: [...s.fresh, p.username] }
              : s
          );
        }, DEMO_ACCEPT_MS)
      );
    }
  }, [ready, state.sent]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = useCallback((p: Person) => setState((s) => ({ ...s, sent: [...s.sent, p] })), []);
  const accept = useCallback((p: Person) => setState((s) => ({ ...s, incoming: s.incoming.filter((x) => x.username !== p.username), friends: [...s.friends, p] })), []);
  const decline = useCallback((u: string) => setState((s) => ({ ...s, incoming: s.incoming.filter((x) => x.username !== u) })), []);
  const markSeen = useCallback(() => setState((s) => (s.fresh.length ? { ...s, fresh: [] } : s)), []);

  const value = useMemo(
    () => ({ ...state, badge: state.incoming.length + state.fresh.length, send, accept, decline, markSeen }),
    [state, send, accept, decline, markSeen]
  );
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const c = useContext(FriendsContext);
  if (!c) throw new Error("useFriends must be used inside <FriendsProvider>");
  return c;
}
