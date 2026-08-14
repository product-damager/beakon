# Beakon

A calm roadmap workspace where the birds are watching YOU 🫵. One canonical
nest for initiatives, with audience-ready views — and a controlled flight path to a curated external
roadmap later.

Built with Next.js (App Router) + TypeScript + Tailwind, styled with a focused product design
system. Runs on in-memory seed data out of the box; migrates to Supabase (Postgres + auth)
when you're ready to leave the nest.

## Quick start

```bash
npm install
npm run dev:demo
```

Open http://localhost:3210 — it lands on the **Timeline** for a bird's-eye view. No accounts or
environment variables are needed for the demo; it ships with a realistic seeded roadmap.

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

## Connecting Supabase (persistence + auth)

The app is written against a swappable data layer so no UI changes are needed.

1. Create a Supabase project.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Replace the seed initializer in `lib/store.tsx` with a fetch via `lib/supabase.ts`, and wire
   `saveInitiative` / `archiveInitiative` to `upsert` / `update`.
5. The external page should read the `external_roadmap` view, which strips internal-only fields
   at the database layer.

## Deployment

Ready to take flight on any modern hosting/deployment service that runs Next.js — push to a Git
repo and import. The build is fully static/SSR and needs no special configuration; add the
Supabase env vars in your host's project settings when you connect a backend. See
[`DEPLOY.md`](DEPLOY.md) for a concrete step-by-step walkthrough.
