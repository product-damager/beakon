# Beakon × Supabase

How Beakon stores data, authenticates people, and stays split between a
seeded **preview** playground and a clean **production** database.

---

## What's in this folder

| File | Purpose |
|------|---------|
| `schema.sql` | The full database: tables, enums, RLS policies, views, triggers. Idempotent — safe to run in any project. |
| `seed.sql` | The 13 demo initiatives (mirrors `lib/seed.ts`). **Preview only** — never run in prod. Truncates the app tables first, so re-running is safe. |
| `README.md` | This file. |

---

## The two-project model

Beakon keeps **two separate free Supabase projects** in **two separate nests** so demo data never mixes with real data:

| Project | Contains | Fed by |
|---------|----------|--------|
| `beakon-preview` | Seed data (13 sample initiatives) | **Preview**/branch deployments + local dev |
| `beakon-prod` | Real initiatives only | **Production** deployment |

Both run the **same** `schema.sql`. Only preview gets `seed.sql`.

---

## First-time setup (per project)

1. Create the project in the [Supabase dashboard](https://supabase.com/dashboard).
2. **Project settings → API → Security:** keep _Enable Data API_, _Automatically expose new tables_, and _Enable automatic RLS_ all **on**. (RLS is defined explicitly in `schema.sql`, so exposure is safe.)
3. **SQL Editor:** paste all of `schema.sql` → **Run**.
4. **Preview only** — paste all of `seed.sql` → **Run**.
5. **Authentication → Providers → Email:** enable it, with _Confirm email_ (magic link) on.
6. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000` (local) / your deployed URL (prod).
   - **Redirect URLs:** add `http://localhost:3000/**` and every deployed URL, e.g. `https://<your-deployed-domain>/**`.
7. **Project settings → API → Project API keys:** copy the **Project URL** and the **Publishable key** (`sb_publishable_…`).

### Environment variables

Create `.env.local` (git-ignored) for local dev, pointing at **preview**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<preview-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

On your hosting service, set the same two vars per environment: Preview → preview keys, Production → prod keys.

> **Keys:** use the new **publishable** key (`sb_publishable_…`), which replaces the
> deprecated `anon` key (legacy keys stop working end of 2026). **Never** put a
> **secret** key (`sb_secret_…`) in a `NEXT_PUBLIC_` var — it bypasses RLS.

---

## Auth model

- **Magic link (passwordless).** People enter their email and click a one-time link.
- **Domain-locked.** The `enforce_company_domain` trigger keeps stray birds out —
  it rejects any signup whose address isn't on your company's domain or in its
  allow-list array. Set your domain and add personal emails to that array in `schema.sql`.
- Sessions live in the browser (publishable key); the workspace is gated by
  `components/AuthGate.tsx`. The public `/share` page needs no login.

## Security (Row Level Security)

RLS is on for every table:

| Role | Can do |
|------|--------|
| `authenticated` (signed-in teammate) | Full read/write on all tables |
| `anon` (public visitor) | Read **only** the `external_roadmap` view + `themes`/`owners` labels — never `initiatives` directly |

`external_roadmap` is a view exposing only `visibility = 'external'`, non-archived
rows with internal fields (notes, DIVE inputs, health, owner) stripped — this is
what powers the public `/share` page.

---

## Data model notes

- **Prioritization is DIVE, not RICE.** Columns are `demand`, `impact`,
  `viability`, `effort` with check constraints matching `lib/types.ts`
  (`demand ∈ {3,15,50,250,1000}`, `impact ∈ {0.25,0.5,1,3,10}`,
  `viability ∈ {0.5,0.8,1}`). The `initiative_scores` view exposes the derived
  `dive_score`.
- `initiatives.position` (double precision) persists board drag order via
  fractional midpoints — no full re-sort on each move.
- `delivery_links` is a child table (one initiative → many links), cascade-deleted.
- `updated_at` is maintained automatically by the `initiatives_touch_updated_at` trigger.

---

## Resetting preview

Preview holds only disposable seed data, so when the schema changes (new columns,
new constraints), just build the nest fresh. In the **preview** SQL Editor:

```sql
drop table if exists delivery_links, initiatives, themes, owners cascade;
drop type if exists initiative_status, initiative_visibility, initiative_health, delivery_link_type cascade;
```

Then re-run `schema.sql`, then `seed.sql`. (Never do this in prod.)

---

## App wiring (for reference)

- `lib/supabase.ts` — creates the browser client from the env vars.
- `lib/auth.tsx` — session + magic-link sign-in/out (local-mode bypass when env is absent).
- `lib/data.ts` — all reads/writes, mapping DB rows ↔ app types.
- `lib/store.tsx` — loads on sign-in, persists mutations, falls back to in-memory seed with no env.
