# Beakon × Supabase

How Beakon stores data, authenticates people, and stays split between a
seeded **demo/preview** playground and a clean **production** database — plus how
to **apply updates** to each safely.

---

## What's in this folder

| File | Purpose |
|------|---------|
| `schema.sql` | The full database: tables, enums, RLS policies, views, triggers. Idempotent — safe to run in any project. |
| `seed.sql` | The demo dataset (mirrors `lib/seed.ts`). **Preview only** — never run in prod. Truncates the app tables first, so re-running is safe. |
| `seed_prod.sql` | One-time prod bootstrap for reference tables (real owners + starter themes, **no initiatives**). Upsert-only, safe to re-run. |
| `README.md` | This file. |

---

## The two-project model

Beakon keeps **two separate free Supabase projects** in **two separate nests** so demo data never mixes with real data:

| Environment | Project | Contains | Fed by | Update style |
|-------------|---------|----------|--------|--------------|
| **Demo / preview** | `beakon-preview` | Seed data (sample initiatives) | Preview/branch deploys + local dev | **Rebuild freely** — drop & reseed anytime |
| **Production** | `beakon-prod` | Real initiatives only | Production deployment | **Never destroy** — idempotent, additive changes only |

Both run the **same** `schema.sql`. Only preview gets `seed.sql`; only prod gets `seed_prod.sql`.

The one rule everything below follows from: **preview can be nuked and reseeded; prod can
only be migrated forward without data loss.**

---

## First-time setup (per project)

1. Create the project in the [Supabase dashboard](https://supabase.com/dashboard).
2. **Project settings → API → Security:** keep _Enable Data API_, _Automatically expose new tables_, and _Enable automatic RLS_ all **on**. (RLS is defined explicitly in `schema.sql`, so exposure is safe.)
3. **SQL Editor:** paste all of `schema.sql` → **Run**.
4. Seed the reference/demo data:
   - **Preview** — paste all of `seed.sql` → **Run**.
   - **Prod** — paste all of `seed_prod.sql` → **Run** (real owners + starter themes; no initiatives).
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

## Updating the database

After the initial setup, changes fall into three kinds — each edits a different file:

| Kind of change | Edit | Applies to |
|----------------|------|------------|
| **Schema** — new column, table, constraint, enum value, view, trigger, policy | `schema.sql` | both projects |
| **Reference data** — a new real owner or starter theme | `seed_prod.sql` | prod |
| **Demo data** — different sample initiatives/owners for the playground | `seed.sql` (+ `lib/seed.ts`) | preview |

### Golden rule for editing `schema.sql`

`schema.sql` is run against **prod**, which has live data — so every statement must be
**safe to re-run on a populated database**. Follow the patterns already in the file:

- **New column:** `alter table X add column if not exists <col> <type> ...;`
  Give it a `default` or make it nullable so existing rows stay valid.
- **New enum value:** `alter type <enum> add value if not exists '<value>';`
- **New table:** `create table if not exists ...`
- **View / function / trigger:** `create or replace ...` (drop the trigger first, as the
  file already does for `initiatives_touch_updated_at` and `enforce_company_domain`).
- **New policy:** wrap in the `do $$ begin ... exception when duplicate_object then null; end $$;`
  guard used throughout.

**Never** in `schema.sql`: bare `create type` / `create table` without a guard,
`drop table`, `drop column`, `truncate`, or a `not null` column with no default (it fails
if the table already has rows).

> Renaming or dropping a column, or tightening a constraint against existing data, is a
> **breaking migration**. Don't fold it into `schema.sql` — write it as a separate,
> reviewed one-off statement, test it on preview first, and back up prod before running it there.

### Workflow: apply a schema change

**1. Test on preview (rebuild from scratch).** Preview holds only disposable data, so the
safest test is a clean rebuild. In the **`beakon-preview`** SQL Editor:

```sql
-- Full reset (only ever in preview)
drop table if exists delivery_links, initiatives, themes, owners cascade;
drop type if exists initiative_status, initiative_visibility, initiative_health, delivery_link_type cascade;
```

Then run, in order: all of `schema.sql`, then all of `seed.sql`. Load the app against
preview and confirm the change works.

**2. Apply to production (forward-only, no data loss).** Once preview looks right, in the
**`beakon-prod`** SQL Editor:

1. **Back up first.** Dashboard → **Database → Backups** (or a manual export). Free-tier
   projects have limited automatic backups, so snapshot before any schema change.
2. Run **only `schema.sql`** (all of it — it's idempotent, so re-running the unchanged parts
   is a no-op and only your new statements take effect).
3. **Do NOT run `seed.sql`** — it would `truncate` and wipe real data.
4. If your change also adds a new starter owner/theme, run the updated `seed_prod.sql`
   (upserts only — safe).

**3. Verify.** Prod: check the changed tables/columns exist (Table Editor) and the app loads
+ persists. Confirm RLS still holds: the public `/share` page reads only `external_roadmap`,
never `initiatives` directly.

### Workflow: change reference data (owners / themes) in prod

Edit `seed_prod.sql`, then run it in the **`beakon-prod`** SQL Editor. Every row upserts
`on conflict (id)`, so:

- **Add** a person/theme → add a new row (new `id`).
- **Edit** a name/email/role/color → change the value on the existing row and re-run.
- `team` is intentionally **not** seeded — each person sets it in-app; re-running won't clobber it.
- To **remove** someone, delete the row by `id` manually (removing it from the file alone
  won't delete it, since the file only inserts/updates).

### Workflow: change demo data

Edit `seed.sql` **and** mirror the change in `lib/seed.ts` (they must stay in sync — the
in-memory seed is the no-Supabase fallback). Then re-run `seed.sql` in **preview only**.
It `truncate`s and reloads, so it's always safe to re-run there.

### Quick reference

```
                    ┌───────────────────────────┐
   schema.sql  ───▶ │  beakon-preview (demo)     │ ◀── seed.sql   (truncate + reseed)
   (idempotent)     │  disposable · rebuild free │
        │           └───────────────────────────┘
        │
        └────────▶  ┌───────────────────────────┐
                    │  beakon-prod (production)  │ ◀── seed_prod.sql (upsert only)
                    │  real data · never destroy │
                    └───────────────────────────┘
```

- **Preview:** drop → `schema.sql` → `seed.sql`. Nuke anytime.
- **Prod:** back up → `schema.sql` only → (optional) `seed_prod.sql`. Never `seed.sql`, never `drop`.

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

## Common mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Ran `seed.sql` in prod | Wiped all real initiatives | Restore from backup; only ever run `seed.sql` in preview |
| Added a `not null` column with no default | `schema.sql` fails on populated prod | Add a `default`, or backfill then set `not null` in a separate step |
| Bare `create type`/`create table` | Errors on second run | Use the `if not exists` / `duplicate_object` guards |
| Changed env vars but app still shows old schema | `NEXT_PUBLIC_` vars are build-time | Rebuild/redeploy after changing keys |
| Forgot to update `lib/seed.ts` | Demo mode diverges from `seed.sql` | Keep the two in sync on every demo-data change |

---

## App wiring (for reference)

- `lib/supabase.ts` — creates the browser client from the env vars.
- `lib/auth.tsx` — session + magic-link sign-in/out (local-mode bypass when env is absent).
- `lib/data.ts` — all reads/writes, mapping DB rows ↔ app types.
- `lib/store.tsx` — loads on sign-in, persists mutations, falls back to in-memory seed with no env.
