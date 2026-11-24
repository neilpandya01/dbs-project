# Wingmates

Your flights, your spots, your crew. Wingmates is a free social app for aviation fans ("avgeeks"). You log the
flights you take, see your stats and a map of where you've flown, add friends, watch their planes in the air, and
swap airport news and tips with the community.

**Version 2 (this version) works on phones and computers, and can be installed like a normal app.**

> **Live app:** https://dbs-project-nine.vercel.app/

---

## Contents
1. [Try it in five minutes](#try-it-in-five-minutes)
2. [How to install it on your phone or computer](#how-to-install-it)
3. [What's new in v2 compared to v1](#whats-new-in-v2-compared-to-v1)
4. [How it's built: a holistic journey](#how-its-built-a-holistic-journey)
5. [v2 plan: what got done and what didn't](#v2-plan-what-got-done-and-what-didnt)
6. [Limitations](#limitations)
7. [What's in the app](#whats-in-the-app)

---

## Try it in five minutes

Open the link above in any browser. No install needed.

1. **Sign up** with an email address and choose a username. Usernames are permanent.
2. **Set up your profile** with a display name and home city. You can add your first flight right away, or skip it.
3. **Explore the five tabs** in the navigation bar:
   - **Profile:** your home base. A banner (pick a preset or use your own photo), your bio and home city, and stat
     cards you can tap for a full breakdown (flights, miles, time in the air, airports, countries, airlines,
     aircraft, routes). Below them are your recent and upcoming flights and a map of everywhere you've flown. Use
     **Edit profile** to change your photo, banner or bio.
   - **Flights:** every flight you've logged. Add one by looking it up with a flight number and date, or type it in by
     hand. Search, filter and sort the list, tap a flight to edit or delete it, and mark a flight as delayed or
     cancelled with a note about what happened.
   - **Map:** your routes on a world map. Tap an airport or a route for a stats card. Friends' planes appear here
     when they're in the air. On a phone, drag the bottom menu up and down to browse your flights, and use the
     button under the zoom controls to zoom back out to everything.
   - **Friends:** find people by username, answer requests, and browse your friends. Open a friend's profile to see
     their stats and flights, and tap **Explore more** to go through their flights on their own map.
   - **News:** the community board. Post a thread about what's happening at an airport (with photos if you like),
     comment, mark posts helpful, sort by Hot, New or Top, and filter by airport. Choose **Friends only** to keep a
     thread within your circle, and type `@` to tag someone. A red dot on the tab and a **You were tagged** list at the
     top show where people have mentioned you.
4. **The social features are best with friends on the app.** You can add friends if you'd like, and the Friends tab,
   friends-only threads, tagging and live plane tracking all come to life from there.
5. **Install it** on your phone or computer if you want it to feel like a regular app (see below).

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
| **Privacy and safety** | Row-level security on every table. | Photos on threads are private (shown through expiring links). Deleting your account also removes your comments, threads, photos and notifications. Threads flagged by three people are hidden automatically. Confirmation before deleting. An automated security test now covers all of this, including tagging, and passes. |

### Highlights for a quick read
- **Works anywhere:** laptop, Android, iPhone, installable.
- **Real live tracking** instead of a simulation.
- **A real community feature** (News) instead of an empty page, with privacy controls.
- **Social touches:** tagging and notifications, friend counts, friends' own maps.

---

## How it's built: a holistic journey

Wingmates is a **holistic journey**: one person's path from start to finish, with every step working on the live
site. It touches most of the course's topics without going extremely deep in any one, and it deliberately doesn't use
AI. In terms of the course's four areas, the weight sits on three of them:

- **Users:** real sign-up and sign-in, permanent usernames, friend requests, who can see what (strangers, friends,
  you), a community with flagging and friends-only threads, and tagging with notifications.
- **Design:** a Sky Blue look with light and dark modes, a layout rebuilt for phones, and an installable app that
  feels native.
- **Systems:** a hosted database with its own security rules, outside data services, a background worker, and live
  updates pushed to your screen.
- **AI:** not used, by design.

### How the pieces fit together

```
  You (phone or laptop browser, or the installed app)
     │
     ├─ sign up / sign in ─────────────▶  Clerk  (accounts, sign-in tokens)
     │
     ├─ reads and writes ──────────────▶  Supabase  (database, private photo storage, live updates)
     │        the database's own rules decide who can see or change what
     │
     ├─ 3 server routes on Vercel
     │     • flight lookup ───────────────▶  AeroDataBox  (airline, aircraft, times)
     │     • "where are my friends' planes?" ─▶  adsb.fi  (live aircraft positions)
     │     • account deletion  ◀──────────  Clerk tells us; we erase that person's data
     │
     └─ every minute, a scheduled worker in Supabase
           asks adsb.fi about friends' flights ─▶ saves positions ─▶ pushed to your map
```

**The website** is built with Next.js and hosted on Vercel. It looks the same on phone and laptop, and a small
service worker makes it installable.

**Accounts.** Clerk handles sign-up and sign-in. When you sign in, it gives your browser a signed token that says who
you are. Supabase trusts that token, so the database always knows who is asking without us storing passwords.

**The database (Supabase).** Almost everything (your flights, profile, friends, threads, comments, tags) is read and
written straight from your browser to the database. What keeps this safe is that the *database itself* checks every
request: each table has row-level security, so you can only see your own flights, your friends' visible flights, and
threads you're allowed to see. Rules like "friends-only threads", "at most 5 tags per post", and "only people who can
see a thread can be tagged" live in the database, so they can't be skipped by tampering with the app. Photos live in
private storage and are shown through links that expire.

**The three server routes (API calls).** A few jobs need secrets or outside services, so they run on our server instead
of in the browser, and each one checks you're signed in first:
1. **Flight lookup:** you type a flight number and date; the server asks AeroDataBox for the airline, aircraft and
   times, remembers the answer so repeat lookups are free, and enforces a daily limit per person plus a cap that stops
   it before the free monthly allowance runs out.
2. **Live check:** when you open the Map, the server asks adsb.fi whether your friends' planes are in the air right now.
3. **Account deletion:** when someone deletes their account in Clerk, Clerk sends a signed message to the server, which
   then erases that person's data and photos.

**Live tracking.** A scheduled worker runs every minute in Supabase. If anyone has the Map open, it asks adsb.fi about
their friends' flights, one request every couple of seconds, from 30 minutes before departure to 2 hours after arrival.
Positions are saved to a table, and Supabase pushes each new one to open maps, so planes move without refreshing. If a
plane isn't heard from for two minutes it simply disappears, rather than being guessed.

**Maps and search.** MapLibre draws the maps (with free OpenFreeMap tiles), and Open-Meteo powers the city search.
There are about 4,000 airports in our own table.

**Keys and safety.** Secret keys stay on the server and are never in the code repository. Every server route checks
who's signed in. An automated security test creates temporary users and tries to read, change and impersonate each
other's data; it checks each rule above (including tagging and notifications) and cleans up after itself.

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
| News tab | **Changed.** Built as a community board (threads, comments, photos, tagging) rather than a feed of outside headlines. *Why: scope changed. A community board gave the tab real content right away and fit the app's social focus, without depending on outside news sources.* |
| Aviation news feeds, FAA delay and ground-stop alerts, aviation weather | **Not done.** *Why: scope changed. Time went into the community board and into making the app work well on phones, which mattered more to how the app is actually used. Outside feeds would also have meant several more outside services to connect, read and tag by airport.* |
| A backup live-data source (OpenSky) | **Not done.** *Why: scope changed. One source was enough for the live map, and a second one would have added complexity. Instead the map hides planes it can't hear from, so it never shows a guess.* |

---

## Limitations

Being upfront about what v2 does **not** do, or does only partly:

**Live tracking**
- It only follows **friends'** flights (not your own), and **only while someone has the Map open**. Nothing is
  tracked in the background when nobody is looking. This keeps it inside the free data limits.
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
- **Delays and cancellations are marked by you.** The app doesn't detect them automatically. *Why: scope changed.
  Detecting them automatically would need another outside data source, so v2 keeps it simple and puts you in control.*
- Flight lookup uses a free service with a daily allowance. When it's used up (or switched off), you can still add
  flights by hand. Typed-in flights have approximate departure and arrival times.
- The airport list has about 4,000 airports. Very small airfields may be missing.
- Usernames can't be changed after sign-up.

**News and community**
- The News tab shows **posts from Wingmates users only**. There are **no automatic headlines, FAA alerts or
  weather**. *Why: scope changed, see the plan table above.*
- Photos: up to 4 per thread and 2 per comment. You can tag at most 5 people per post.
- **No push notifications.** The red dot and the "You were tagged" list update while the app is open (within about
  30 seconds, or when you come back to it). There are no lock-screen alerts. *Why: not part of the v2 scope. The red
  dot and tag list cover the need while you're using the app, and phone push alerts would need extra setup for each
  kind of phone.*

**Phones and installing**
- It isn't in the App Store or Google Play. *Why: the plan was an installable web app, which works on both Android and
  iPhone without store approval.* It installs from the browser (see above). On iPhone, installing only works from
  Safari.
- It needs an internet connection; offline you only get a "You're offline" screen.

**General**
- It runs on free tiers of its services, so heavy use by many people at once isn't what it was built or tested for.

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
