# Wingmates

Your flights, your spots, your crew. Wingmates is a free, all-in-one social app for avgeeks. Track your own 
flights, see your stats and historical flights, see your expected flights, keep tabs on friends' travels, and 
keep up-to-date with the latest aviation news in one centralized area, both official and user-reported. 

## Where v1 stands

v1 is a wide build: a thin but real slice of every part of the proposal's journey (sign up,
set up a profile, log a flight, add a friend, see their profile) rather than one feature built deep.
Sign-in is real (Clerk) and so is all the data (Supabase, with row-level security on every table; nothing
is kept in the browser). New users go through a required profile setup (display name and home city) and
an optional "Add your first flight" step. Usernames are permanent: the database ignores later renames in
Clerk. Flights can be logged by hand or looked up by flight number and date through AeroDataBox, which
fills in airline, aircraft, registration and scheduled times (each shown as the local clock at that
airport). The lookup runs on the server, caches results, stops at 95% of the free allowance and gives
each person a daily limit, so when it's switched off the manual form still works. People are found by a
partial username search (five closest matches). Anyone can be opened as a limited profile (banner, name and
username behind a lock) with the right button for where the request stands: add, requested or cancel,
accept or decline, or friends, who see each other's full profile, flights and stats.

Not built yet: live tracking of friends in the air is only simulated from scheduled times, and the news tab
has its tables and community reports but no headline or alert ingestion, so it stays empty until some
background worker feeds it.

I asked 3 friends what they thought of my app. They mostly caught bugs and inconveniences that I was able to 
quickly fix using multiple perspectives, less so constructive feedback. For example, they mentioned having 
a "remove user" button more easily accessible. 

## v2 plan

- First, address any feedback provided. 

Then, incorporate the following to address gaps in v1:

**APIs and data sources**
- **adsb.fi** (open data, about 1 request per second): live aircraft positions for friends' flights. OpenSky as a backup.
- **AeroDataBox** (already in v1): besides the lookup, it returns each flight's registration and callsign, which the live
  tracker uses to find the aircraft.
- **OpenFlights airline codes**: for flights typed in by hand, turns an airline and flight number (`UA 2679`) into the
  callsign adsb.fi expects (airline ICAO code plus number, like `UAL2679`).
- **News RSS feeds** from aviation news sites: headline, source and link only.
- **FAA NAS Status** (ground stops and delays) and **aviationweather.gov**: live airport alerts.

**Basic architecture**
- **Scheduled workers** (Supabase scheduled functions, using the service key, free tier): one polls adsb.fi every minute
  for flights that should be in the air; one pulls the news feeds and FAA alerts every 15 minutes.
- **Matching a flight to an aircraft:** adsb.fi finds a plane by registration or callsign. Looked-up flights save both (the
  callsign is a new column; the registration is saved today). Flights typed in by hand get a callsign built from the
  OpenFlights airline code, and are skipped if neither can be worked out.
- **Which flights get polled:** a flight is tracked from shortly before its scheduled departure until it lands or has
  gone quiet for a while. Looked-up flights use their exact departure and arrival times; typed-in ones use estimates.
  Hidden flights are never polled. If both adsb.fi and OpenSky fail or find nothing, the map falls back to the
  scheduled-time estimate, and a landed flight's position is deleted.
- **Tables the workers write to:** `live_positions` (latest position per flight) and the existing `news_items`.
  Row-level security lets only the flight's owner and their accepted friends read a position, and only while the flight
  is in the air; hidden flights are never tracked.
- **Live map:** the browser subscribes to `live_positions` with Supabase Realtime, so planes move without reloading.
  This replaces the scheduled-time simulation.
- **News tab:** headlines and alerts next to user and friend reports, filterable by your home airports and airlines.
- **Tagging news so the filters work:** FAA alerts already name an airport, so they are tagged directly. For RSS
  headlines the worker matches airport codes and city names and airline names from our own airports and airlines lists;
  anything it can't match is shown untagged and appears only under "All". User and friend reports are tagged by the
  airport the author picks. Each item has an expiry, so old news drops off.
- **Keys and limits:** every provider key stays server side. Calls are cached or throttled to stay inside each free tier.

**Installable app (Android and iPhone)**
- The proposal promised an installable web app, and v1 only has the basics (a web manifest with `display: standalone`
  and theme colors). To finish it:
- **PNG icons** (192, 512 and a maskable version) in the manifest, since Android install prompts and iOS ignore the SVG.
- **iOS home-screen support:** an `apple-touch-icon` (180x180) and `appleWebApp` metadata (title, status bar style).
- **A minimal service worker** so the app opens offline with a friendly screen and installs on every browser.
- **Signed-out start:** make sure the installed app opens on sign-in, not an error page, when there is no session.
- Have the application be more mobile-friendly

## Setup
1. Copy `.env.example` to `.env.local` and fill in the Supabase, Clerk and RapidAPI keys (never commit them).
2. Run each file in `supabase/migrations/` once, in filename order, in Supabase → SQL Editor.
3. `npm run import:airports` loads about 4,000 airports into Supabase (safe to re-run).
4. Supabase → Authentication → Sign In / Providers: add Clerk as a third-party provider.
5. Clerk → Sessions → Customize session token: set the claims to `{ "username": "{{user.username}}" }`
   (the database takes a username only from this claim, and only once, when the profile is created).
6. `npm run check:supabase` checks the env and both connections without printing any secret.
7. `npm run check:security` creates temporary users to check one can't read or change another's data.
   It is out of date after the latest changes and needs updating before it is useful again.

## What's in it
- **Profile**: banner (presets or your own photo), stats with detailed breakdowns, flights at a glance, route map
- **Flights**: look up by flight number and date or add by hand; search, filter, sort, edit and delete
- **Map**: your flown routes and friends' flights in the air
- **Friends**: find people, request states, limited profiles, full friend profiles, remove a friend
- **News**: community reports and the table for headlines and alerts (headlines not ingested yet)
- **Server**: `app/api/flights/lookup` (flight lookup with cache, quota tracking and per-person limit)
- **Database**: `supabase/migrations/` (profiles, flights, friendships, reports, news, lookup cache and quota)

## Develop
```bash
npm install
npm run dev
```

## Deploy
Push to GitHub and import in Vercel. Add the same variables as `.env.local` in Vercel's settings; the
service-role key and `RAPIDAPI_KEY` are server only. `postinstall` copies the MapLibre worker into
`public/maplibre/` (git-ignored).

## Stack
Next.js (App Router), TypeScript, Clerk, Supabase, MapLibre GL + OpenFreeMap tiles, AeroDataBox (flight
lookup), Open-Meteo (city search, GeoNames data). Plain CSS, Sky Blue palette, light and dark.
