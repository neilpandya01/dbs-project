# Wingmates

Your flights, your spots, your crew. A free social app for avgeeks.

**Status:** front-end only. Everything runs on sample data for a signed-in `USER, TEST`, and edits
are saved in the browser (localStorage). Sign-in, Supabase, and the live-data workers come next.

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
Next.js (App Router), TypeScript, MapLibre GL + OpenFreeMap tiles, Photon city search (OpenStreetMap data).
Plain CSS, Sky Blue palette, light and dark. Sample data lives in `lib/mock.ts`.
