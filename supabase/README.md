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
| **Reference data** — a new real owner, starter theme, or org record (business unit / team) | `seed_prod.sql` (+ for org records: a one-off idempotent file in `migrations/`, and the same rows in `seed.sql` + `lib/seed.ts` for parity) | prod (migration: preview first, then prod) |
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

**Exception — repointing a view's column list to a renamed/new column.** `create or
replace view` can change a column's underlying expression, but not its name or position
(Postgres error 42P16 if you try). If a `schema.sql` view definition needs to select a
differently-named column than it used to (e.g. Sprint Heron Week 1's `external_roadmap`
moving from `i.team` to `i.team_id`), the *rename itself* still needs a guarded, one-time
`do $$ ... end $$` block — but unlike a column rename on a table, it's safe to put that
guard directly in `schema.sql`, immediately before the `create or replace view`, rather
than exiling it to a one-off migration file:

```sql
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = '<view_name>'
      and column_name = '<old_name>'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = '<view_name>'
      and column_name = '<new_name>'
  ) then
    alter view <view_name> rename column <old_name> to <new_name>;
  end if;
end $$;
```

This is safe to fold into `schema.sql` (unlike a bare rename) because the existence
checks make it a permanent no-op once applied: skip if the view doesn't exist yet (fresh
install), skip if the rename already happened, run once otherwise. Without it, the next
`schema.sql` run against an environment that still has the old column name fails with
42P16 — see `supabase/migrations/2026-08-heron-team-strategic-objective-backfill.sql`'s
"Part A0" for the incident this guards against.

### Grants: nothing is public by default

Since security-hardening (2026-10-30, `openspec/changes/archive/…security-hardening/`,
`supabase/migrations/2026-10-security-hardening.sql`), the anonymous role (`anon`, the
publishable key) gets **nothing** unless a statement grants it — including on tables, views,
sequences and functions you add later *as `postgres`* (the SQL editor's role; default
privileges for `postgres` no longer include `anon`). Objects created by Supabase itself
(`supabase_admin`) still get Supabase's defaults — the security advisor catches those. Signed-in users (`authenticated`) still get Supabase's defaults on new tables.

- **New table:** RLS is switched on automatically (`rls_auto_enable` / `ensure_rls`); add the
  `authenticated` policies as usual. Give `anon` nothing.
- **New view:** create it `with (security_invoker = true)` so it runs with the caller's
  rights and RLS; then `revoke all … from anon, authenticated` and grant back `select` only
  to the roles that need it. Never leave a view owned by `postgres` without
  `security_invoker` — it bypasses RLS and is auto-updatable.
- **New function:** add `set search_path = public, pg_temp`, then
  `revoke execute … from public;` and `grant execute … to authenticated;` explicitly.
  Trigger-only functions get `revoke execute … from public, anon, authenticated` (triggers
  still fire).
- **Anything for `/share`:** anonymous *grants* are listed in one place — the "Anonymous
  access" section at the **end** of `schema.sql` (the anon policy on `themes` sits with the
  other RLS policies near the top). Change it there, and update
  `openspec/specs/sharing-and-auth/spec.md` in the same change.
- **After any schema change**, run the Supabase security advisor on both projects. The only
  accepted finding is leaked-password protection (Beakon has no passwords).

### Workflow: vault-sync (definitions from the PM's vault, OKR live state back)

One writer per field (openspec `vault-sync`): the vault owns feature definitions **and
initiative status** (`04 Features` frontmatter) and commitment definitions
(`../bu-dashboard/data/okr.json`); Beakon owns OKR live state (governance, % done, health,
check-ins). Synced rows carry `source = 'vault'` and `vault_fields` (the columns the vault
owns on that row); signed-in users can't change those columns. Nothing here needs stored
credentials — the PM asks Claude, and Claude reads/writes Supabase with its own tools.

**Sync (vault → Beakon)** — "sync the vault into Beakon":
1. Claude dumps current rows from **beakon-prod** as JSON:
   `{"initiatives": [id, title, team_id, status, archived, area, tier, owner_id, target_start,
   target_end, source, source_key, vault_fields], "okrs": [id, title, team_id, year, quarter,
   deliverable_detail, strategic_objective_id, tier, archived, source, source_key,
   vault_fields], "owners": [id, name, surname]}`.
2. `python3 scripts/vault-sync/vault_sync.py build --current <dump.json>` → `out/vault-sync-<date>.md`
   (report: creates / updates with field diffs / archives / skips) and `out/vault-sync-<date>.sql`.
3. The PM reads the report. Then Claude applies the SQL to **beakon-preview**, checks counts
   against the report, then to **beakon-prod**, checks again. The SQL is idempotent and never
   deletes: a definition gone from the vault is archived.

**Write-back (Beakon → okr.json)** — "write OKR live state back":
1. Claude reads `source_key, achievement, governance_status, health` of `okrs where source = 'vault'`
   from beakon-prod into a JSON list.
2. `python3 scripts/vault-sync/vault_sync.py write-back --live <live.json> --backup` — copies
   `okr.json` to `02 OKR/backups/okr.json.<timestamp>-before-vault-sync-writeback.bak`, then
   updates only `status`, `progress`, `health`, `governance` of synced commitments (formatting
   preserved). It refuses to run without a fresh backup.

Tests: `python3 -m unittest discover -s scripts/vault-sync`.

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
| `anon` (public visitor) | Read **only** `themes`, the `external_roadmap` view, and the displayed columns (id, title, status, theme_id, target dates; plus position/visibility/archived for filtering) of external, non-archived `initiatives`. No owners, no other table, no function. |

`external_roadmap` is a `security_invoker` view of the external, non-archived
initiatives with only the columns `/share` displays — this is what powers the public
page. Since it runs with the caller's rights, anon's access is defined by the narrow
policy + column grants in the "Anonymous access" section at the end of `schema.sql`
(see "Grants: nothing is public by default" above).

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
