import Link from "next/link";
import { Fragment } from "react";

export const MAX_MENTIONS = 5;
const MENTION = /(?<![A-Za-z0-9_])@([A-Za-z0-9_-]{1,64})/g;

/** Plain text with each "@username" turned into a link to that person's profile. */
export function MentionText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={`t${at}`}>{text.slice(last, at)}</Fragment>);
    out.push(<Link key={`m${at}`} href={`/friends/${encodeURIComponent(m[1])}`} className="mention">@{m[1]}</Link>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{out}</>;
}

/** How many distinct people are @mentioned in this text. */
export const countMentions = (text: string) => new Set([...text.matchAll(MENTION)].map((m) => m[1].toLowerCase())).size;
