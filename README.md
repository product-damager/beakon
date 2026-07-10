# Beakon

A calm roadmap workspace where birds are watching YOU 🫵. One canonical
place for initiatives, with audience-ready views — and a controlled path to a curated external
roadmap later.

Built with Next.js (App Router) + TypeScript + Tailwind, styled with the Kameleoon Product
design system. Runs on in-memory seed data out of the box; swaps to Supabase (Postgres + auth)
when you're ready.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it lands on the **Timeline**. No accounts or environment
variables are needed for the demo; it ships with a realistic seeded roadmap.

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

## What's in v1

- **Timeline** (default screen) — status-colored bars on a hybrid date/quarter axis. Group by
  theme, team, or owner; zoom month / quarter / half-year; filter by status, owner, team, theme,
  visibility; search; **presentation mode** that drops all chrome. Click any bar to open details.
  Selecting an initiative highlights its prerequisites on the timeline.
- **Board** — columns by status with drag-and-drop to change status; cards show theme, quarter,
  priority score, and a quick owner switch.
- **List** — sortable, searchable table across every field.
- **Initiative detail drawer** — full metadata, prioritization (impact + fit + urgency − effort),
  delivery links, dependencies (depends-on / blocks), internal notes, and an activity placeholder.
- **Create / edit** — a single drawer form; entering an initiative takes under two minutes.
- **External share** (`/share`) — a read-only, branded, timeline-first page showing **only**
  externally-visible initiatives, with internal notes, scores, and owners stripped out.

## Timeline model

Hybrid: every initiative has real `targetStart` / `targetEnd` dates, and the axis labels and
grouping snap to quarters. This keeps precise planning while staying leadership-readable, and
lets the zoom control move between month, quarter, and half-year without changing the data.

## Project structure

```
app/
  layout.tsx              root layout, fonts, RoadmapProvider
  page.tsx                redirects / → /timeline
  globals.css             Kameleoon token overrides
  (workspace)/            app shell (sidebar + top bar)
    timeline|board|list/  the three internal views
  share/                  external read-only roadmap
components/                Timeline, Board, List, drawers, FilterBar, UI primitives
lib/
  types.ts                domain model, status/theme/confidence metadata
  seed.ts                 demo initiatives, themes, owners
  store.tsx               React context: data + filters + editor state (swap point for Supabase)
  filters.ts, dates.ts    filtering/grouping + timeline date math
  supabase.ts             Supabase client (activates when env vars are set)
supabase/
  schema.sql              Postgres schema + external_roadmap view + RLS notes
  seed.sql                sample seed data
```

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

## Design system

Kameleoon **Product** pillar: ShadCN/Tailwind numeric defaults, brand colors and fonts only
(green-90 sidebar, beige surfaces, lime accents; Plus Jakarta Sans titles, Inter body, Noto Sans
Mono for labels/tags). Status is the meaning-bearing color on the timeline; lime is reserved for
UI accents.

## Deployment

Optimized for Vercel — push to a Git repo and import. The build is fully static/SSR and needs no
special configuration; add the Supabase env vars in the Vercel project when you connect a backend.

## Not yet built (later milestones)

Role-based access (editor vs viewer), a fully Web-styled public roadmap with saved audience views,
dependency arrows on the timeline, and change history / comments in the activity area.
