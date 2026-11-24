# Wingmates

Your flights, your spots, your crew. Wingmates is a free social app for aviation fans ("avgeeks"). You log the
flights you take, see your stats and a map of where you've flown, add friends, watch their planes in the air, and
swap airport news and tips with the community.

**Version 2 works on phones and computers, and can be installed like a normal app.**

> **Live app:** https://dbs-project-nine.vercel.app/

## Contents
1. [Try it in five minutes](#try-it-in-five-minutes)
2. [How to install it](#how-to-install-it)
3. [What's new in v2 compared to v1](#whats-new-in-v2-compared-to-v1)
4. [How it's built: a holistic journey](#how-its-built-a-holistic-journey)
5. [v2 plan: what got done and what didn't](#v2-plan-what-got-done-and-what-didnt)
6. [Limitations](#limitations)

---

## Try it in five minutes

Open the link above in any browser. No install needed.

1. **Sign up** with an email address and choose a username (usernames are permanent).
2. **Set up your profile** with a display name and home city. Adding a first flight is optional.
3. **Explore the five tabs** in the navigation bar:
   - **Profile:** your banner (a preset or your own photo), bio, home city, and stat cards you can tap for a full
     breakdown (flights, miles, time in the air, airports, countries, airlines, aircraft, routes). Below are your
     recent and upcoming flights and a map of everywhere you've flown. **Edit profile** changes your photo, banner
     or bio.
   - **Flights:** every flight you've logged. Add one by flight number and date, or by hand. Search, filter and sort,
     tap a flight to edit or delete it, and mark it delayed or cancelled with a note.
   - **Map:** your routes on a world map. Tap an airport or route for a stats card. Friends' planes appear when
     they're in the air. On a phone, drag the bottom menu up and down to browse your flights.
   - **Friends:** find people by username, answer requests, and browse your friends. Open a friend's profile for
     their stats, then **Explore more** for their flights on their own map.
   - **News:** the community board. Post a thread about an airport (with photos if you like), comment, mark posts
     helpful, sort by Hot, New or Top, and filter by airport. Choose **Friends only** to keep a thread within your
     circle, and type `@` to tag someone. A red dot on the tab and a **You were tagged** list show where you've been
     mentioned.
4. **The social features are best with friends on the app.** You can add friends if you'd like; friends-only
   threads, tagging and live plane tracking all come to life from there.

---

## How to install it

Wingmates is a *web app*: nothing to download from an app store. Open it in a browser and "install" it to put an icon
on your home screen. It then opens full-screen, without the address bar.

- **iPhone or iPad (Safari only):** open the link in Safari, tap **Share** (the square with an up arrow), then
  **Add to Home Screen**, then **Add**. Other iPhone browsers can't install it.
- **Android (Chrome):** open the link and sign in, then tap **Install** in the banner at the bottom, or the **⋮** menu →
  **Install app**.
- **Computer (Chrome or Edge):** click the install icon at the right end of the address bar (or the "Install
  Wingmates" banner), then **Install**.

Installing is optional: everything also works in a normal browser tab. To remove it, delete the icon like any app.
After an update, close and reopen the app (or pull down to refresh).

---

## What's new in v2 compared to v1

| Area | v1 | v2 |
|---|---|---|
| **Phones** | Laptop-only layout. | Built for thumbs: bottom tab bar, pop-up sheets from the bottom, big tap targets, nothing wider than the screen. Still full-featured on a laptop. |
| **Installing** | Basic web manifest only. | A real installable app on Android, iPhone and desktop: icons, full-screen mode, install prompt, offline screen. |
| **Live friend tracking** | Simulated from scheduled times. | **Real positions.** A friend's picture appears on the map at the gate, in the air, or at arrival, with altitude and speed. |
| **The map** | Your routes and dots. | Shared routes in purple, stats cards for airports and flights, a "show all" button, a draggable list on phones, readable dark mode. |
| **Friends' maps** | Not possible. | "Explore more" on a friend's profile opens *their* flights on *their* own map, separate from yours. |
| **News** | A page and empty tables. | A working **community board** with photos, comments, helpful votes, Hot/New/Top, airport tags and filters, edit/delete, and flagging. |
| **Friends-only threads** | Not available. | Only you and your friends can see the thread. The database enforces it. |
| **Tagging and notifications** | Not available. | `@` tags link to profiles. A red dot and a "You were tagged" list jump straight to the exact comment, which flashes blue. In friends-only threads, only people who can see the thread can be tagged. |
| **Delays and cancellations** *(v1 feedback)* | Not handled. | Mark a flight delayed or cancelled. Delayed flights still count; cancelled ones are kept as a record, outside stats and the map. |
| **Profiles** | Banner, name, stats. | Bio and home city under the banner, a friend count (shown to friends), a tidy banner on small screens. |
| **Privacy and safety** | Row-level security on every table. | Private photos (expiring links), account deletion that removes your threads, comments, photos and notifications, auto-hiding of threads flagged by three people, and an automated security test covering all of it. |

---

## How it's built: a holistic journey

Wingmates is a **holistic journey**: one person's path from start to finish, with every step working on the live
site. It touches most of the course's topics without going extremely deep in any one, and deliberately doesn't use AI.
The weight sits on three areas:

- **Users:** real sign-up and sign-in, friend requests, who can see what (strangers, friends, you), and a community
  with flagging, friends-only threads, and tagging.
- **Design:** a Sky Blue look with light and dark modes, a layout rebuilt for phones, and an installable app.
- **Systems:** a hosted database with its own security rules, outside data services, a background worker, and live
  updates pushed to your screen.

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

- **The website** is built with Next.js on Vercel, and looks the same on phone and laptop. A small service worker makes
  it installable.
- **Accounts:** Clerk handles sign-up and sign-in and gives your browser a signed token saying who you are. Supabase
  trusts it, so the database always knows who is asking.
- **The database (Supabase):** most things (flights, profile, friends, threads, tags) are read and written straight from
  your browser. What keeps that safe is that the *database itself* checks every request with row-level security. Rules
  like "friends-only threads" and "only people who can see a thread can be tagged" live there, so tampering with the app
  can't skip them. Photos sit in private storage behind expiring links.
- **The three server routes:** jobs that need secrets or outside services run on our server, and each checks you're
  signed in first. *Flight lookup* asks AeroDataBox for airline, aircraft and times, caches the answer, and enforces a
  per-person daily limit and a cap that stops before the free monthly allowance runs out. *Live check* asks adsb.fi
  whether your friends' planes are in the air when you open the Map. *Account deletion* is triggered by Clerk and erases
  that person's data and photos.
- **Live tracking:** the scheduled worker polls adsb.fi for friends' flights while anyone has the Map open, saves each
  position, and Supabase pushes it to open maps. (Timing rules are under Limitations.)
- **Maps and search:** MapLibre with free OpenFreeMap tiles; Open-Meteo for city search; about 4,000 airports in our own
  table.
- **Keys and safety:** secret keys stay on the server and out of the code repository. An automated security test
  creates temporary users and tries to read, change and impersonate each other's data, then cleans up after itself.


**Security review.** I ran a full security review of the project myself: the API routes, sign-in handling, every database
table's access rules, the background worker, secrets, and dependencies. I confirmed that no secrets were ever committed,
that my dependencies have no known vulnerabilities, and that no one's data is exposed to people who shouldn't see it. The
review turned up three weaknesses, and I fixed all three. Post authors could be spoofed by renaming yourself in the
sign-in service, so I changed it to take names from the locked profile. The live-position refresh had no per-user limit,
so I capped it at one call per 15 seconds. The daily flight-lookup limit could be bypassed with many simultaneous
requests, so I made the allowance get claimed atomically. I extended my automated security test to cover the new limits.
Still open, and lower priority, are a Content-Security-Policy, validating profile photo URLs, limiting username search,
and turning off username changes in the sign-in service's settings.

---

## v2 plan: what got done and what didn't

| Planned in v2 | Status |
|---|---|
| Real live positions for friends' flights (adsb.fi), matched to aircraft by registration or callsign | **Done.** Typed-in flights use a built-in list of airline codes to work out the callsign. |
| Live map that updates without reloading | **Done** |
| Track delayed and cancelled flights (v1 feedback) | **Done** (marked by the user) |
| Installable app: icons, iPhone home-screen support, offline screen | **Done** |
| Be more mobile-friendly | **Done** |
| News tab | **Changed.** Built as a community board (threads, comments, photos, tagging) instead of a feed of outside headlines. *Why: scope changed. A community board gave the tab real content right away and fit the app's social focus, without depending on outside news sources.* |
| News feeds, FAA delay and ground-stop alerts, aviation weather | **Not done.** *Why: scope changed. Time went into the community board and into making the app work well on phones, which mattered more to how it's used. Outside feeds would also have meant several more services to connect, read and tag by airport.* |
| A backup live-data source (OpenSky) | **Not done.** *Why: scope changed. One source was enough for the live map, and a second would have added complexity. Instead the map hides planes it can't hear from, so it never shows a guess.* |

---

## Limitations

**Live tracking**
- It only follows **friends'** flights, and **only while someone has the Map open**. Nothing is tracked in the
  background. This keeps it inside the free data limits.
- A flight is followed from **30 minutes before departure until 2 hours after its scheduled arrival**. A flight
  delayed beyond that is no longer followed.
- Data comes from a free volunteer network of plane receivers (adsb.fi), so coverage isn't perfect, especially at the
  gate or in remote areas. A plane not heard from for 2 minutes disappears from the map instead of showing a guess.
- A flight can only be found with a **registration (tail number)** or a **recognised airline and flight number**.
- With many flights tracked at once, each plane updates a little less often.
- "Estimated flight time" on flight cards is calculated from distance, not the real time in the air.

**Flights and data**
- **Delays and cancellations are marked by you.** *Why: scope changed. Detecting them automatically would need another
  outside data source, so v2 keeps it simple and puts you in control.*
- Flight lookup uses a free service with a daily allowance. When it's used up, you can still add flights by hand;
  typed-in flights have approximate times.
- The airport list has about 4,000 airports, so very small airfields may be missing.
- Usernames can't be changed after sign-up.

**News and community**
- News shows **posts from Wingmates users only**, with no automatic headlines or alerts (see the plan table).
- Photos: up to 4 per thread and 2 per comment. At most 5 people can be tagged per post.
- **No push notifications.** The red dot and "You were tagged" list update while the app is open (within about 30
  seconds, or when you return to it), with no lock-screen alerts. *Why: not part of the v2 scope. The dot and list
  cover the need while you're using the app, and phone push alerts need extra setup for each kind of phone.*

**Phones and installing**
- It isn't in the App Store or Google Play. *Why: the plan was an installable web app, which works on Android and
  iPhone without store approval.*
- It needs an internet connection; offline you only get a "You're offline" screen.
- It runs on free tiers of its services, so heavy use by many people at once isn't what it was built or tested for.
