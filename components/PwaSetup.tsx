"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const DISMISS_KEY = "wm-install-dismissed";

/** Registers the service worker and offers a dismissible "Install app" banner (Android prompt, iOS instructions). */
export function PwaSetup() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setEvt(null));
    // iOS Safari never fires beforeinstallprompt; show manual steps instead
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIos) setIos(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, "1"); setEvt(null); setIos(false); };
  if (!evt && !ios) return null;

  return (
    <div className="install-banner" role="region" aria-label="Install Wingmates">
      <span aria-hidden="true">✈</span>
      <p>
        {evt ? "Install Wingmates for quick access and a full-screen app." : <>Install: tap <b>Share</b>, then <b>Add to Home Screen</b>.</>}
      </p>
      {evt && (
        <button className="install-go" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>Install</button>
      )}
      <button className="icon-btn" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
