"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { useFriends } from "@/lib/friendsStore";
import { MAX_MENTIONS, countMentions } from "@/lib/mentions";
import { colorFor } from "@/lib/threads";

export type Suggestion = { username: string; name: string };

/**
 * A textarea where typing "@" suggests people.
 *  - `people` given: only those can be suggested (friends-only threads: just the people who can see the thread).
 *  - `people` null: anyone. Your friends come first, then a username search.
 */
export function MentionTextarea({ value, onChange, people, maxLength, rows = 3, placeholder, ariaLabel, required }: {
  value: string; onChange: (v: string) => void; people: Suggestion[] | null;
  maxLength: number; rows?: number; placeholder?: string; ariaLabel?: string; required?: boolean;
}) {
  const { friends, find } = useFriends();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null); // text after the "@" being typed, or null
  const [found, setFound] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const base: Suggestion[] = people ?? friends.map((f) => ({ username: f.username, name: f.name }));

  // open mode: also search everyone by what's been typed
  useEffect(() => {
    if (people || query === null || query.length < 2) { setFound([]); return; }
    let alive = true;
    const id = setTimeout(() => {
      find(query).then((r) => alive && setFound(r.map((x) => ({ username: x.username, name: x.name })))).catch(() => alive && setFound([]));
    }, 200);
    return () => { alive = false; clearTimeout(id); };
  }, [query, people, find]);

  const q = (query ?? "").toLowerCase();
  const list: Suggestion[] = [];
  if (query !== null) {
    for (const s of [...base.filter((s) => s.username.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)), ...found]) {
      if (!list.some((x) => x.username.toLowerCase() === s.username.toLowerCase())) list.push(s);
    }
  }
  const shown = list.slice(0, 6);
  const tooMany = countMentions(value) >= MAX_MENTIONS;

  const detect = (text: string, caret: number) => {
    const m = /(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_-]{0,64})$/.exec(text.slice(0, caret));
    setQuery(m ? m[1] : null);
    setActive(0);
  };

  const pick = (s: Suggestion) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([A-Za-z0-9_-]*)$/, `@${s.username} `);
    const next = before + value.slice(caret);
    if (next.length > maxLength) return;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (query === null || shown.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % shown.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + shown.length) % shown.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(shown[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuery(null); }
  };

  return (
    <div className="mention-box">
      <textarea
        ref={ref}
        className="input"
        rows={rows}
        value={value}
        maxLength={maxLength}
        required={required}
        aria-required={required || undefined}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart); }}
        onClick={(e) => detect(value, e.currentTarget.selectionStart)}
        onKeyUp={(e) => { if (e.key.startsWith("Arrow") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) detect(value, e.currentTarget.selectionStart); }}
        onKeyDown={onKey}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {query !== null && (
        <ul className="mention-list" role="listbox" aria-label="People to mention">
          {tooMany ? (
            <li className="mention-note">You can mention up to {MAX_MENTIONS} people per post.</li>
          ) : shown.length > 0 ? (
            shown.map((s, i) => (
              <li key={s.username} role="option" aria-selected={i === active}>
                <button type="button" className={i === active ? "on" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                  <Avatar name={s.name} color={colorFor(s.username)} size={28} />
                  <span><b>@{s.username}</b>{s.name !== s.username && <small className="muted"> {s.name}</small>}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="mention-note">
              {people ? "Only people who can see this thread can be mentioned." : query.length < 2 ? "Keep typing a username…" : "No one found."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
