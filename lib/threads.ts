import type { SupabaseClient } from "@supabase/supabase-js";

/** A community thread (a row of Supabase `reports`). */
export type Thread = {
  id: string;
  user_id: string;
  author_username: string;
  author_name: string;
  airports: string[];
  title: string;
  body: string;
  helpful: number;
  comment_count: number;
  flags: number;
  created_at: string;
  last_activity_at: string;
};

/** A reply on a thread (a row of Supabase `report_comments`). */
export type Comment = {
  id: string;
  report_id: string;
  user_id: string;
  author_username: string;
  author_name: string;
  body: string;
  created_at: string;
};

export const THREAD_COLUMNS = "id,user_id,author_username,author_name,airports,title,body,helpful,comment_count,flags,created_at,last_activity_at";
export const COMMENT_COLUMNS = "id,report_id,user_id,author_username,author_name,body,created_at";

export const MAX_TAGS = 5;
export const TITLE_MAX = 120;
export const BODY_MAX = 2000;
export const COMMENT_MAX = 1000;

export function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

/** A steady colour for a username, so the same person always gets the same avatar. */
export function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

const HOUR = 3_600_000;

/** How much going on a thread has: helpful votes and especially replies. */
export const activity = (t: Pick<Thread, "helpful" | "comment_count">) => t.helpful + t.comment_count * 2;

/** "Hot": activity, fading with age, so new busy threads outrank old busy ones. */
export function hotScore(t: Thread, now: number) {
  const ageH = Math.max(0, (now - Date.parse(t.created_at)) / HOUR);
  return (t.helpful * 2 + t.comment_count * 3 + 1) / Math.pow(ageH + 2, 1.4);
}

export type Hotspot = { code: string; threads: Thread[]; comments: number; helpful: number; top: Thread; score: number };

/**
 * Airports with a burst of reports lately: tagged by at least 2 threads in the last 24 hours, or by one thread
 * people are actively talking about. Ranked by volume. This is the "what's going on right now" summary.
 */
export function hotspots(threads: Thread[], now: number, windowHours = 24): Hotspot[] {
  const since = now - windowHours * HOUR;
  const by = new Map<string, Thread[]>();
  for (const t of threads) {
    if (Date.parse(t.created_at) < since) continue;
    for (const code of t.airports) by.set(code, [...(by.get(code) ?? []), t]);
  }
  const out: Hotspot[] = [];
  for (const [code, list] of by) {
    const comments = list.reduce((s, t) => s + t.comment_count, 0);
    const helpful = list.reduce((s, t) => s + t.helpful, 0);
    if (list.length < 2 && comments + helpful < 3) continue;
    const top = [...list].sort((a, b) => hotScore(b, now) - hotScore(a, now))[0];
    out.push({ code, threads: list, comments, helpful, top, score: list.length * 3 + comments * 2 + helpful });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

/** The threads people are reacting to most in the last 2 days (needs at least some reaction). */
export function trending(threads: Thread[], now: number, n = 3): Thread[] {
  const since = now - 48 * HOUR;
  return threads
    .filter((t) => Date.parse(t.created_at) >= since && activity(t) >= 1)
    .sort((a, b) => hotScore(b, now) - hotScore(a, now))
    .slice(0, n);
}

// ---- actions shared by the list and the thread page -------------------------------------------------
export async function voteThread(db: SupabaseClient, id: string, on: boolean) {
  const { error } = on ? await db.from("report_votes").delete().eq("report_id", id) : await db.from("report_votes").insert({ report_id: id });
  return error?.message ?? null;
}
export async function flagThread(db: SupabaseClient, id: string) {
  const { error } = await db.rpc("flag_report", { p_id: id });
  return error?.message ?? null;
}
export async function deleteThread(db: SupabaseClient, id: string) {
  const { error } = await db.from("reports").delete().eq("id", id);
  return error?.message ?? null;
}
