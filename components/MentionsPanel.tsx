"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { useMentions } from "@/lib/mentionsStore";
import { ago, colorFor } from "@/lib/threads";

const SHOWN = 3;

/**
 * "You were tagged": every thread or comment that @mentioned you, newest first, each linking straight to it.
 * It's a lasting list: opening News clears the red dot, but the entries stay (until the post is deleted).
 * Ones that were new when you opened News are marked "New" for this visit.
 */
export function MentionsPanel({ now }: { now: number }) {
  const { items, unseen, markSeen } = useMentions();
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false); // collapsed unless something new came in; tap the header to reopen

  // remember which were new, then mark them seen so the red dot clears
  useEffect(() => {
    if (unseen === 0) return;
    setFresh((f) => new Set([...f, ...items.filter((i) => !i.seen).map((i) => i.id)]));
    markSeen();
  }, [unseen, items, markSeen]);

  // new mentions open the list on their own; with nothing new it stays folded up
  useEffect(() => { if (fresh.size > 0) setOpen(true); }, [fresh.size]);

  if (items.length === 0) return null;
  const list = all ? items : items.slice(0, SHOWN);

  return (
    <section className="mentions-panel card" aria-label="Where you were tagged">
      <button className="mentions-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <h2>{fresh.size > 0 && <span className="mentions-bell" aria-hidden="true">🔔</span>}You were tagged</h2>
        {fresh.size > 0 && <span className="badge accent">{fresh.size} new</span>}
        <span className="muted mentions-count">{items.length === 1 ? "1 mention" : `${items.length} mentions`}</span>
        <span className={`mentions-chev${open ? " open" : ""}`} aria-hidden="true">›</span>
      </button>
      {open && (
      <>
      <ul className="mentions-list">
        {list.map((m) => (
          <li key={m.id}>
            <Link href={`/news/${m.threadId}${m.commentId ? `#c-${m.commentId}` : ""}`} className={`mention-item${fresh.has(m.id) ? " new" : ""}`}>
              <Avatar name={m.by} color={colorFor(m.by)} size={34} />
              <span className="mention-item-main">
                <span className="mention-item-line">
                  <b>@{m.by}</b> tagged you {m.commentId ? "in a comment on" : "in"} <b>{m.threadTitle}</b>
                </span>
                {m.excerpt && <span className="mention-item-excerpt muted">{m.excerpt}</span>}
                <span className="mention-item-time muted">{ago(m.createdAt, now)}{fresh.has(m.id) && <span className="badge accent">New</span>}</span>
              </span>
              <span className="row-chev" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > SHOWN && (
        <button className="linkish mentions-more" onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${items.length}`}</button>
      )}
      </>
      )}
    </section>
  );
}
