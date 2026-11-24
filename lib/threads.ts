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
  /** Paths of attached photos in the thread-images bucket. */
  images: string[];
  edited_at: string | null;
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
  images: string[];
  edited_at: string | null;
};

export const THREAD_COLUMNS = "id,user_id,author_username,author_name,airports,title,body,helpful,comment_count,flags,created_at,last_activity_at,images,edited_at";
export const COMMENT_COLUMNS = "id,report_id,user_id,author_username,author_name,body,created_at,images,edited_at";

export const MAX_TAGS = 5;
export const TITLE_MAX = 120;
export const BODY_MIN = 10; // a description is required
export const BODY_MAX = 2000;
export const COMMENT_MAX = 1000;
export const MAX_THREAD_IMAGES = 4;
export const MAX_COMMENT_IMAGES = 2;
const BUCKET = "thread-images";

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

// ---- photos ---------------------------------------------------------------------------------------------
const IMAGE_PATH = /^[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.jpg$/;

/** The public address of an uploaded photo, or null if the stored path isn't one of ours. */
export function imageSrc(path: string) {
  return IMAGE_PATH.test(path) ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : null;
}

/** Shrink a picked photo to at most 1600 px on its longest side and save it as a JPEG, so uploads stay small. */
export async function shrinkImage(file: File, maxSide = 1600): Promise<File> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Only JPEG, PNG, WebP or GIF photos can be attached.");
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("That photo couldn’t be read. Try a different one."); }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("That photo couldn’t be prepared. Try a different one.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Upload photos into your own folder. Returns their paths, or an error (and nothing is left behind). */
export async function uploadImages(db: SupabaseClient, userId: string, files: File[]): Promise<{ paths: string[]; error?: string }> {
  const paths: string[] = [];
  for (const f of files) {
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await db.storage.from(BUCKET).upload(path, f, { contentType: "image/jpeg", upsert: false });
    if (error) { await removeImages(db, paths); return { paths: [], error: `Couldn’t upload a photo: ${error.message}` }; }
    paths.push(path);
  }
  return { paths };
}

/** Delete photos from storage (best effort: a leftover file is harmless). */
export async function removeImages(db: SupabaseClient, paths: string[]) {
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
}

// ---- saving ----------------------------------------------------------------------------------------------
export type ThreadValues = { title: string; body: string; airports: string[]; kept: string[]; files: File[] };

/** Create a thread, or save edits to one of yours (existing). Uploads new photos, removes dropped ones. */
export async function saveThread(db: SupabaseClient, userId: string | null, existing: Thread | null, v: ThreadValues): Promise<{ thread?: Thread; error?: string }> {
  if (!userId) return { error: "You’re not signed in." };
  const up = await uploadImages(db, userId, v.files);
  if (up.error) return { error: up.error };
  const row = { title: v.title, body: v.body, airports: v.airports, images: [...v.kept, ...up.paths] };
  const res = existing
    ? await db.from("reports").update(row).eq("id", existing.id).select(THREAD_COLUMNS).single()
    : await db.from("reports").insert(row).select(THREAD_COLUMNS).single();
  if (res.error) { await removeImages(db, up.paths); return { error: res.error.message }; }
  if (existing) await removeImages(db, existing.images.filter((p) => !v.kept.includes(p)));
  return { thread: res.data as Thread };
}

export async function addComment(db: SupabaseClient, userId: string | null, threadId: string, body: string, files: File[]): Promise<{ comment?: Comment; error?: string }> {
  if (!userId) return { error: "You’re not signed in." };
  const up = await uploadImages(db, userId, files);
  if (up.error) return { error: up.error };
  const { data, error } = await db.from("report_comments").insert({ report_id: threadId, body, images: up.paths }).select(COMMENT_COLUMNS).single();
  if (error) { await removeImages(db, up.paths); return { error: error.message }; }
  return { comment: data as Comment };
}

/** Save an edit to one of your comments (the text, and which photos to keep). */
export async function editComment(db: SupabaseClient, c: Comment, body: string, kept: string[]): Promise<{ comment?: Comment; error?: string }> {
  const { data, error } = await db.from("report_comments").update({ body, images: kept }).eq("id", c.id).select(COMMENT_COLUMNS).single();
  if (error) return { error: error.message };
  await removeImages(db, c.images.filter((p) => !kept.includes(p)));
  return { comment: data as Comment };
}

// ---- actions shared by the list and the thread page -------------------------------------------------
export async function voteThread(db: SupabaseClient, id: string, on: boolean) {
  const { error } = on ? await db.from("report_votes").delete().eq("report_id", id) : await db.from("report_votes").insert({ report_id: id });
  return error?.message ?? null;
}
/** Flag a thread, or (on = true: it's already flagged) take your flag back. */
export async function flagThread(db: SupabaseClient, id: string, on = false) {
  const { error } = await db.rpc(on ? "unflag_report" : "flag_report", { p_id: id });
  return error?.message ?? null;
}
export async function deleteThread(db: SupabaseClient, t: Pick<Thread, "id" | "images">) {
  const { error } = await db.from("reports").delete().eq("id", t.id);
  if (!error) await removeImages(db, t.images);
  return error?.message ?? null;
}
export async function deleteComment(db: SupabaseClient, c: Pick<Comment, "id" | "images">) {
  const { error } = await db.from("report_comments").delete().eq("id", c.id);
  if (!error) await removeImages(db, c.images);
  return error?.message ?? null;
}
