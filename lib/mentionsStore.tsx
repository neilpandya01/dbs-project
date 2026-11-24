"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "./supabase";
import { useMe } from "./useMe";

/** One time you were @tagged: in a thread (commentId null) or in a comment on it. Stays until the post is deleted. */
export type MentionItem = {
  id: string;
  seen: boolean;
  createdAt: string;
  threadId: string;
  threadTitle: string;
  commentId: string | null;
  /** Who tagged you. */
  by: string;
  /** What they wrote (the thread description or the comment). */
  excerpt: string;
};

type Ctx = {
  items: MentionItem[];
  /** how many you haven't looked at yet: the number behind the red dot */
  unseen: number;
  loading: boolean;
  markSeen: () => Promise<void>;
  refresh: () => Promise<void>;
};

const MentionsContext = createContext<Ctx | null>(null);
const POLL_MS = 30_000;

type Row = {
  id: string; seen: boolean; created_at: string; report_id: string; comment_id: string | null;
  reports: { title: string; body: string; author_username: string } | null;
  report_comments: { body: string; author_username: string } | null;
};

/** Where you were tagged, from Supabase. Refreshes every 30 seconds and when you come back to the tab (like Friends). */
export function MentionsProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const supabase = useSupabase();
  const [items, setItems] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!me.id) return;
    const { data, error } = await supabase
      .from("mentions")
      .select("id,seen,created_at,report_id,comment_id,reports(title,body,author_username),report_comments(body,author_username)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!alive.current) return;
    if (!error) {
      setItems(
        ((data ?? []) as unknown as Row[]).filter((r) => r.reports).map((r) => ({
          id: r.id,
          seen: r.seen,
          createdAt: r.created_at,
          threadId: r.report_id,
          threadTitle: r.reports!.title,
          commentId: r.comment_id,
          by: (r.comment_id ? r.report_comments?.author_username : r.reports!.author_username) ?? "someone",
          excerpt: (r.comment_id ? r.report_comments?.body : r.reports!.body) ?? "",
        }))
      );
    }
    setLoading(false);
  }, [me.id, supabase]);

  useEffect(() => {
    if (!me.id) return;
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [me.id, refresh]);

  const markSeen = useCallback(async () => {
    if (!me.id) return;
    await supabase.from("mentions").update({ seen: true }).eq("user_id", me.id).eq("seen", false);
    await refresh();
  }, [me.id, refresh, supabase]);

  const unseen = useMemo(() => items.filter((i) => !i.seen).length, [items]);
  const value = useMemo(() => ({ items, unseen, loading, markSeen, refresh }), [items, unseen, loading, markSeen, refresh]);
  return <MentionsContext.Provider value={value}>{children}</MentionsContext.Provider>;
}

export function useMentions() {
  const c = useContext(MentionsContext);
  if (!c) throw new Error("useMentions must be used inside <MentionsProvider>");
  return c;
}
