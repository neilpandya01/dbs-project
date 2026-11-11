"use client";

import { useEffect, useState } from "react";

/** Current time, or null until mounted, so server-rendered HTML never shows stale time-based content. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
