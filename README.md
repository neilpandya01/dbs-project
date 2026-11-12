# Wingmates

Your flights, your spots, your crew. A free social app for avgeeks.

**Status:** sign-in (Clerk) and all data (Supabase) are real. Profiles, flights, friends, friend requests,
starred flights and community reports live in Supabase with row-level security. News headlines and airport
alerts have their table but stay empty until the background workers are built. No data is kept in the browser.

## Setup
1. Copy the example env file to a local one and fill in the Supabase and Clerk keys (never commit them).
2. Run each file in `supabase/migrations/` once, in order, in Supabase → SQL Editor.
3. `npm run import:airports` loads about 4,000 airports into Supabase (safe to re-run).
3b. Supabase → Authentication → Sign In / Providers: add Clerk as a third-party provider.
4. Clerk → Sessions → Customize session token: set the claims to `{ "username": "{{user.username}}" }`
   (the database takes usernames only from this claim, so nobody can claim someone else's).
5. `npm run check:supabase` checks the env and both connections without printing any secret.
6. `npm run check:security` creates two temporary users and proves one cannot read, change or impersonate
   the other, and that no secret key ships to the browser. Re-run it after every database change.

## What's in it
- **Profile** banner picture (presets or your own), stats that open detailed breakdowns, flights at a glance, route map
- **Flights** search, filter and sort every flight; add, edit and delete
- **Map** your history plus friends' live flights, airport dots
- **Friends** search, requests, and a read-only profile page for each friend
- **News** headlines, airport alerts, user reports

## Develop
```bash
npm install
npm run dev
```

## Deploy
Push to GitHub and import in Vercel (framework auto-detected, no env vars needed yet).
`postinstall` copies the MapLibre worker into `public/maplibre/` (git-ignored).

## Stack
Next.js (App Router), TypeScript, MapLibre GL + OpenFreeMap tiles, Open-Meteo city search (GeoNames data).
Plain CSS, Sky Blue palette, light and dark. Sample data lives in `lib/mock.ts`.
