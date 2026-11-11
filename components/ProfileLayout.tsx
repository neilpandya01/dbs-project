"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { BannerBackground } from "./BannerBackground";
import { FlightMap } from "./FlightMapLazy";
import { FlyingSoon } from "./FlyingSoon";
import { ProfileStats } from "./ProfileStats";
import { Sheet } from "./Sheet";
import { TripList } from "./TripList";
import { UpcomingList } from "./UpcomingList";
import type { Banner } from "@/lib/banners";
import { dayCountdown, depOf, fmtDate, splitFlights } from "@/lib/itinerary";
import { AIRPORTS, type Flight } from "@/lib/core";

export type Identity = {
  name: string;
  username: string;
  /** Home city, shown as a label. */
  home: string;
  bio: string;
  photo: string | null;
  color: string;
  banner: Banner;
  joined: string;
};

type Props = {
  who: Identity;
  /** Small line above the username: a greeting for you, the home city for a friend. */
  subtitle: string;
  /** Shown for your own profile only (a friend's own friend list is private). */
  friendCount?: number;
  /** Your own profile only: avatars shown on the friends pill, which links to your friends list. */
  friendAvatars?: { username: string; name: string; color: string }[];
  flights: Flight[];
  now: Date;
  /** Present only on your own profile: adding flights, editing, resetting. Friends' pages are read-only. */
  own?: { onAddFlight: () => void; onEditProfile: () => void; onManageAccount: () => void; onSignOut: () => void };
};

/**
 * The profile page, shared by your own profile and your friends' profiles.
 * Everything is the same; only the edit controls (the `own` prop) are yours alone.
 */
export function ProfileLayout({ who, subtitle, friendCount, friendAvatars, flights, now, own }: Props) {
  const [details, setDetails] = useState(false);
  const [allFlights, setAllFlights] = useState(false);
  const [airport, setAirport] = useState<string | null>(null);

  const { past, soon, later } = splitFlights(flights, now);
  const done = past.flat(); // stats, map and "previous" only count flights that have landed
  const recent = [...past].reverse().slice(0, 4);
  const editable = !!own;

  // details for the airport dot you tapped on the map
  const visits = airport ? done.filter((f) => f.from === airport || f.to === airport) : [];
  const lastVisit = visits.reduce((a, f) => (f.date > a ? f.date : a), "");

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <BannerBackground banner={who.banner} />
        </div>
        <div className="hero-top">
          <button className="hero-avatar" onClick={() => setDetails(true)} aria-label="View profile details">
            <Avatar name={who.name} size={60} color={who.color} src={who.photo} />
          </button>
          <div className="hero-info">
            <span className="hero-greet">{subtitle}</span>
            <button className="hero-user" onClick={() => setDetails(true)} aria-label={`View profile details for @${who.username}`}>
              @{who.username}
            </button>
          </div>
        </div>
        {own && (
          <Link href="/friends" className="friends-pill" aria-label={`${friendCount ?? 0} friends. View friends`}>
            <span className="friends-stack" aria-hidden="true">
              {(friendAvatars ?? []).slice(0, 3).map((f) => <Avatar key={f.username} name={f.name} color={f.color} size={22} />)}
            </span>
            <span className="friends-text"><b>{friendCount ?? 0}</b> friends</span>
            <span className="friends-chev" aria-hidden="true">›</span>
          </Link>
        )}
      </section>

      <FlyingSoon trips={soon} now={now} editable={editable} />

      {done.length > 0 ? (
        <ProfileStats flights={done} />
      ) : (
        <div className="card empty" style={{ marginTop: 14 }}>
          <b>No flights logged yet</b>
          <p className="muted" style={{ margin: 0 }}>{own ? <>Use <b>Add flight</b> below to log your first one.</> : "Their stats and map will show up here."}</p>
        </div>
      )}

      <div className="section-bar">
        <h2 className="sec">Flights at a glance</h2>
        <div className="section-actions">
          {own ? <Link href="/flights" className="see-all">See all</Link> : <button className="see-all" onClick={() => setAllFlights(true)}>See all</button>}
          {own && <button className="btn primary" onClick={own.onAddFlight}>＋ Add flight</button>}
        </div>
      </div>

      <div className="pair">
        <div className="card">
          <h2>Previous flights</h2>
          {recent.length === 0 && <p className="muted" style={{ margin: 0 }}>Flights taken will show up here.</p>}
          <TripList trips={recent} editable={editable} />
        </div>
        <UpcomingList trips={later} now={now} editable={editable} />
      </div>

      {done.length > 0 && (
        <>
          <div className="section-bar">
            <h2 className="sec">{own ? "Where you’ve flown" : "Where they’ve flown"}</h2>
            <Link href="/map" className="see-all">Explore more ›</Link>
          </div>
          <div className="card map-card map-wide">
            <FlightMap
              interactive={false}
              routes={done.map((f) => ({ id: f.id, from: f.from, to: f.to }))}
              airports={[...new Set(done.flatMap((f) => [f.from, f.to]))].map((code) => ({ code, kind: own ? ("me" as const) : ("friend" as const) }))}
              onSelectAirport={setAirport}
              className="map-canvas"
            />
            {airport && AIRPORTS[airport] && (
              <div className="card map-overlay" role="status">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <b className="mono">{airport} · {AIRPORTS[airport].city}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{AIRPORTS[airport].country}</div>
                  </div>
                  <button className="icon-btn" style={{ width: 30, height: 30, flex: "none" }} onClick={() => setAirport(null)} aria-label="Close airport details">✕</button>
                </div>
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  <b>{visits.length}</b> flight{visits.length === 1 ? "" : "s"} to or from here{lastVisit && <span className="muted"> · last {fmtDate(lastVisit)}</span>}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {allFlights && (
        <Sheet title={`${who.name.split(" ")[0]}’s flights`} onClose={() => setAllFlights(false)}>
          <TripList
            trips={[...soon.flat(), ...later.flat(), ...past.flat()].sort((a, b) => depOf(b).getTime() - depOf(a).getTime()).map((l) => [l])}
            badge={(l) => (l.dep && l.dep > now ? <span className="badge accent">{dayCountdown(depOf(l), now)}</span> : undefined)}
            editable={false}
          />
        </Sheet>
      )}

      {details && (
        <Sheet title={own ? "Your profile" : `${who.name.split(" ")[0]}’s profile`} onClose={() => setDetails(false)}>
          <dl className="profile-rows">
            {own && <ProfileRow label="Photo" value={<span className="row-inline"><Avatar name={who.name} size={34} color={who.color} src={who.photo} /> {who.photo ? "Custom photo" : "Initials"}</span>} />}
            {own && <ProfileRow label="Banner" value={<span className="mini-banner"><BannerBackground banner={who.banner} /></span>} />}
            <ProfileRow label="Display name" value={who.name} />
            <ProfileRow label="Username" value={<span className="mono">@{who.username}</span>} note={own ? "Can’t be changed after sign-up" : undefined} />
            <ProfileRow label="Home city" value={who.home || "Not set"} muted={!who.home} />
            <ProfileRow label="Bio" value={who.bio || (own ? "No bio yet" : "No bio")} muted={!who.bio} />
            <ProfileRow label="Joined" value={who.joined} />
            {own && <ProfileRow label="Friends" value={String(friendCount ?? 0)} />}
          </dl>
          {own && (
            <button className="btn primary" style={{ width: "100%", padding: "12px 16px", marginTop: 14 }} onClick={() => { setDetails(false); own.onEditProfile(); }}>
              Edit profile
            </button>
          )}
          {own && (
            <div className="account-actions">
              <button className="btn" onClick={() => { setDetails(false); own.onManageAccount(); }}>Account &amp; security</button>
              <button className="btn" onClick={own.onSignOut}>Sign out</button>
            </div>
          )}
        </Sheet>
      )}

    </>
  );
}

function ProfileRow({ label, value, note, muted }: { label: string; value: React.ReactNode; note?: string; muted?: boolean }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd className={muted ? "muted" : undefined}>
        {value}
        {note && <small className="muted">{note}</small>}
      </dd>
    </div>
  );
}
