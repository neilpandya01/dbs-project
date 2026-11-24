# Wingmates

Your flights, your spots, your crew. Wingmates is a free social app for aviation fans ("avgeeks"). You log the
flights you take, see your stats and a map of where you've flown, add friends, watch their planes in the air, and
swap airport news and tips with the community.

**Version 2 (this version) works on phones and computers, and can be installed like a normal app.**

> **Live app:** _add the Vercel link here_

---

## Contents
1. [Try it in five minutes](#try-it-in-five-minutes)
2. [How to install it on your phone or computer](#how-to-install-it)
3. [What's new in v2 compared to v1](#whats-new-in-v2-compared-to-v1)
4. [v2 plan: what got done and what didn't](#v2-plan-what-got-done-and-what-didnt)
5. [Limitations](#limitations)
6. [What's in the app](#whats-in-the-app)
7. [Technical notes (setup, deploy, live tracking)](#technical-notes)

---

## Try it in five minutes

You don't need to install anything to look around. Open the link above in any browser.

1. **Sign up** with an email address, and choose a username. Usernames are permanent.
2. **Set up your profile** (display name and home city), then add a flight. You can type one in, or look it up by
   flight number and date (for example `UA 2679` and a recent date).
3. Open **Profile** for your stats, **Flights** for your list, and **Map** for your routes.
4. **To see the social features, you need a second person.** The easiest way: open a private/incognito window and
   sign up a second account. Then:
   - In **Friends**, search the second username and send a request. Accept it in the other window.
   - In **News**, post a thread from one account (try the "Friends only" option) and reply from the other. Type `@`
     and a username in a post or comment to tag them. Watch for the **red dot** on the News tab in the other window.
   - Open the other person's profile to see their stats, friend count and their own flight map ("Explore more").
5. **Live tracking** of a friend's plane only shows up if that friend has a real flight scheduled around now (see
   [Limitations](#limitations)). If you want to see it work, add a flight that is actually in the air today, from the
   second account, and open the Map in the first one.

---

## How to install it

Wingmates is a *web app*: nothing to download from an app store. You open it in a browser and "install" it, which
puts an icon on your home screen. It then opens full-screen, without the browser's address bar.

### iPhone or iPad (must use Safari)
1. Open the Wingmates link in **Safari**. (Chrome and other browsers on iPhone can't install it.)
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll and tap **Add to Home Screen**, then **Add**.
4. Open Wingmates from the new icon on your home screen.

### Android (Chrome)
1. Open the Wingmates link in **Chrome** and sign in.
2. Tap the **Install** button in the banner at the bottom of the screen, **or** tap the **⋮** menu, then **Install app**.
3. Open Wingmates from your app drawer or home screen.

### Computer (Chrome or Edge)
Click the small **install icon** at the right end of the address bar (or the "Install Wingmates" banner), then
**Install**. The app gets its own window.

### Good to know
- To **remove** it, delete the icon like any other app (on a computer, use the app window's menu → Uninstall).
- After an update, **close and reopen** the app (or pull down to refresh) to load the newest version.
- Installing is optional. Everything also works in a normal browser tab.
- The app needs an internet connection. Offline, it shows a friendly "You're offline" screen.

---

## What's new in v2 compared to v1

| Area | v1 | v2 |
|---|---|---|
| **Phones** | Designed for a laptop screen only. It loaded on a phone but wasn't tuned for it. | Built for thumbs: a tab bar along the bottom, pop-up sheets that slide up from the bottom, big tap targets, and a layout that never grows wider than the screen. Still full-featured on a laptop. |
| **Installing** | Only the basics of a web manifest. | A real installable app on Android, iPhone and desktop: proper icons, full-screen mode, an install prompt, and an offline screen. |
| **Live tracking of friends** | Only simulated from scheduled times. | **Real positions** from open aircraft data. A friend's profile picture appears on the map at the gate, in the air, or at the arrival airport, with altitude and speed. Planes that drop off radar are hidden instead of guessed. |
| **The map** | Your routes and basic dots. | Shared routes shown in purple, tap an airport or a flight for a stats card (miles, estimated time, airline, aircraft), a "show all" button, a draggable list on phones, and a readable dark mode. |
| **Friends' maps** | Not possible. | Open a friend's profile → "Explore more" to go through *their* flights on *their* own map, separate from yours. |
| **News** | A page and empty tables. | A working **community board**: post threads with photos, comment, mark helpful, sort by Hot / New / Top, tag and filter by airport, see just your friends' threads or your own, edit or delete, and flag problems. |
| **Friends-only threads** | Not available. | Choose "Friends only" when posting: only you and your friends can see the thread. The database enforces it, so it can't be bypassed. |
| **Tagging with @** | Not available. | Type `@` in a thread or comment to tag someone. Tags become links to their profile. In friends-only threads you can only tag people who can actually see the thread. |
| **Tag notifications** | Not available. | A **red dot** on the News tab and a "You were tagged" list at the top of News. Each entry jumps straight to the exact comment, which flashes blue. The list folds away once everything is read, and stays available. |
| **Delays and cancellations** *(v1 feedback)* | Not handled. | Mark a flight as delayed or cancelled and add what happened. Delayed flights still count; cancelled flights are kept as a record but left out of stats and the map. |
| **Profiles** | Banner, name and stats. | Bio and home city under the banner, friend count (shown to friends), and a tidy banner on small screens. |
| **Privacy and safety** | Row-level security on every table. | Photos on threads are private (shown through expiring links). Deleting your account also removes your comments, threads, photos and notifications. Threads flagged by three people are hidden automatically. Confirmation before deleting. |

### Highlights for a quick read
- **Works anywhere:** laptop, Android, iPhone, installable.
- **Real live tracking** instead of a simulation.
- **A real community feature** (News) instead of an empty page, with privacy controls.
- **Social touches:** tagging and notifications, friend counts, friends' own maps.

### Design approach (carried over from v1)
The interface got a lot of attention because the app only works if it feels right to an avgeek. A Sky Blue palette
with light and dark modes, flight times shown as the local clock at each airport (like a departure board), and
profiles that open on a banner with stats you can tap into. v2 repeated that process for phones: screens were
reworked after using the app on an actual phone, for example moving the zoom buttons within thumb reach, and
making the map's list draggable like the maps on your phone. Friend feedback from v1 (testers mostly found small
inconveniences, like wanting an easier "remove friend" button) shaped fixes in both versions.

---

## v2 plan: what got done and what didn't

| Planned in v2 | Status |
|---|---|
| Real live positions for friends' flights (adsb.fi) | **Done** |
| Match a flight to its aircraft by registration or callsign | **Done.** Typed-in flights use a built-in list of airline codes to work out the callsign. |
| Live map that updates without reloading | **Done** |
| Track delayed and cancelled flights (v1 feedback) | **Done** (marked by the user, see limitations) |
| Installable app: PNG icons, iPhone home-screen support, offline screen | **Done** |
| Be more mobile-friendly | **Done** |
| News tab | **Changed.** Built as a community board (threads, comments, photos, tagging) rather than a feed of outside headlines. |
| Aviation news feeds, FAA delay and ground-stop alerts, aviation weather | **Not done** |
| A backup live-data source (OpenSky) | **Not done** |

---

## Limitations

Being upfront about what v2 does **not** do, or does only partly:

**Live tracking**
- It only follows **friends'** flights (not your own), and **only while someone has the Map open**. Nothing is
  tracked in the background when nobody is looking.
- A flight is followed from **30 minutes before departure until 2 hours after its scheduled arrival**. A flight
  delayed beyond that is no longer followed.
- Data comes from a free volunteer network of plane receivers (adsb.fi). Coverage isn't perfect, especially for
  planes at the gate or in remote areas. If a plane isn't heard for 2 minutes, it disappears from the map instead of
  showing a guess.
- A flight can only be found if it has a **registration (tail number)** or a **recognised airline and flight number**.
  A typed-in flight with neither can't be tracked.
- With many flights tracked at once, each plane updates a little less often (about every 2 seconds per request,
  shared between flights).
- The "estimated flight time" on flight cards is calculated from the distance, not the real time in the air.

**Flights and data**
- **Delays and cancellations are marked by you.** The app doesn't detect them automatically.
- Flight lookup uses a free service with a daily allowance. When it's used up (or switched off), you can still add
  flights by hand. Typed-in flights have approximate departure and arrival times.
- The airport list has about 4,000 airports. Very small airfields may be missing.
- Usernames can't be changed after sign-up.

**News and community**
- The News tab shows **posts from Wingmates users only**. There are **no automatic headlines, FAA alerts or
  weather** (these were planned but not built).
- Photos: up to 4 per thread and 2 per comment. You can tag at most 5 people per post.
- **No push notifications.** The red dot and the "You were tagged" list update while the app is open (within about
  30 seconds, or when you come back to it). There are no lock-screen alerts.

**Phones and installing**
- It isn't in the App Store or Google Play. It installs from the browser (see above). On iPhone, installing only
  works from Safari.
- It needs an internet connection; offline you only get a "You're offline" screen.
- Phone layouts were checked mainly on an iPhone and a laptop browser. Android devices and tablets haven't been
  tested on real hardware.

**General**
- It runs on free tiers of its services, so heavy use by many people at once isn't what it was built or tested for.
- The automated security check (`npm run check:security`) hasn't been extended to cover tagging and tag
  notifications.

---

## What's in the app

- **Profile:** banner (presets or your own photo), bio and home city, friend count, stats you can tap for details,
  flights at a glance, and a map of where you've flown. A "Flying soon" strip shows today's and tomorrow's flights.
- **Flights:** look up by flight number and date or add by hand; search, filter, sort, edit and delete; mark a flight
  as delayed or cancelled.
- **Map:** your flown routes (blue; purple where a friend flew the same route), friends in the air, airport and flight
  cards, and a "show all" button.
- **Friends:** find people by username, send and answer requests, limited preview for non-friends, full profiles for
  friends (with their own flight map), remove a friend.
- **News:** community threads with photos, comments, helpful votes, airport tags and filters, friends-only threads,
  @tagging with a red-dot notification list, edit/delete and flagging.

---

## Technical notes

*(For anyone setting the project up. Not needed to use the app.)*

### Setup
1. Copy `.env.example` to `.env.local` and fill in the Supabase, Clerk and RapidAPI keys (never commit them).
2. Run each file in `supabase/migrations/` once, in filename order, in Supabase → SQL Editor. (v2 added migrations for
   friends-only threads, private photos, @mentions, friend counts and tag notifications. The mentions file must run
   before the tag-notification file.)
3. `npm run import:airports` loads about 4,000 airports into Supabase (safe to re-run).
4. Supabase → Authentication → Sign In / Providers: add Clerk as a third-party provider.
5. Clerk → Sessions → Customize session token: set the claims to `{ "username": "{{user.username}}" }`
   (the database takes a username only from this claim, and only once, when the profile is created).
6. `npm run check:supabase` checks the env and both connections without printing any secret.
7. `npm run check:security` creates temporary users to check one can't read or change another's data.

### Live tracking setup
Friends' flights are followed by an edge function (`supabase/functions/live-tracker`) that Supabase cron runs every
minute, and also checked on the spot whenever someone opens the Map. Only friends of people who have the Map open are
followed (the page sends a heartbeat). Each flight is followed from 30 minutes before its scheduled departure until 2
hours after its scheduled arrival, one adsb.fi request at a time, every 2 seconds in a round-robin. A friend's
profile picture appears on the Map only when there is a fresh, real position: on the ground at the departure airport,
in flight, or on the ground at the arrival airport while still reporting. A plane with no position for 2 minutes is not
shown, and nothing is estimated from the schedule. Positions are written to `live_positions` and pushed to the map
with Supabase Realtime. One-time setup:

1. Run `supabase/migrations/20261122000000_live_tracking.sql` in the SQL Editor.
2. Turn on the `pg_cron` and `pg_net` extensions (Database → Extensions).
3. `supabase functions deploy live-tracker --no-verify-jwt`, then `supabase secrets set CRON_SECRET=<long random string>`.
4. Fill in the two placeholders in `supabase/cron/live_tracker_schedule.sql` and run it in the SQL Editor.

### Develop
```bash
npm install
npm run dev
```
To regenerate the app icons: `node scripts/make-icons.mjs`.

### Deploy
Push to GitHub and import in Vercel. Add the same variables as `.env.local` in Vercel's settings; the
service-role key and `RAPIDAPI_KEY` are server only. `postinstall` copies the MapLibre worker into
`public/maplibre/` (git-ignored).

### Stack
Next.js (App Router), TypeScript, Clerk (sign-in), Supabase (database, storage, realtime, scheduled functions),
MapLibre GL + OpenFreeMap tiles, AeroDataBox (flight lookup), adsb.fi (live aircraft positions), Open-Meteo (city
search, GeoNames data). Plain CSS, Sky Blue palette, light and dark.
