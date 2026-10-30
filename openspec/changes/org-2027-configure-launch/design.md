# Design: org-2027-configure-launch

## Context

See proposal.md. Org records live in `business_units` and `teams` (text primary keys).
- **Seed mode** reads them from `BUSINESS_UNITS` and `TEAMS_TABLE` in `lib/seed.ts`.
- **beakon-preview** is seeded by `supabase/seed.sql`, which truncates first.
- **beakon-prod**'s reference data is in `supabase/seed_prod.sql` (upserts).

As of 2026-10-30, both projects have the 2026 org: 4 BUs, 11 teams, ids `bu-*` and `team-*`.

## Decisions

### Decision 1: ids `bu-configure-launch`, `team-finalize-rollout`, `team-assets-creation`
- **Why:** they follow the existing `bu-` / `team-` kebab pattern and are readable in SQL.
- **Names, exactly as in the vault:** "Configure & Launch" (no "BU" prefix; the PM names BUs by name), "Finalize & Roll out", "Assets Creation".
- **Alternative rejected:** reusing `team-tech-perso-builders` renamed to "Finalize & Roll out". That would rewrite history and silently move Q3 work, which the PM excluded.

### Decision 2: an idempotent data migration, mirrored in all three seeds
- **The migration** `supabase/migrations/2026-10-org-2027-configure-launch.sql` uses `insert … on conflict (id) do update set name = …, business_unit_id = …`.
  - It inserts the BU before its teams, in one transaction.
  - It only ever touches these three ids, so re-running it is a no-op and nothing else can change.
- **Why it isn't in `schema.sql`:** this is data, not schema, and the golden rule keeps data in seed and migration files.
- **The seeds:**
  - `seed_prod.sql` gets the same upserts, so a fresh prod bootstrap has the org.
  - `seed.sql` and `lib/seed.ts` get them too, for demo/preview parity (data-platform "Feature parity across modes").

### Decision 3: no UI work
- Pickers and grouping already read `teams` and `business_units` dynamically: `TeamPicker` / `TeamOrBuPicker` group teams by BU, and `okrGrouping` sorts BUs by name.
- Empty BU and team groups stay hidden on the OKR page, so nothing changes visually until OKRs exist.
- No product-designer pass is needed: there's no new or reworked surface.

## Risks / Trade-offs

- **[Risk] Teammates pick the old "Tech & Perso Builders" for new work.** → Accepted for now. vault-sync will own team assignment for definitions. A later change could mark 2026 teams as historical in pickers.
- **[Risk] Seed drift between `lib/seed.ts` and `seed.sql`.** → Mitigation: a QA check that both list the same 5 BUs and 13 teams.

## Migration Plan

1. Apply the migration to beakon-preview. Check:
   - counts: 5 BUs, 13 teams;
   - the 3 new rows, with the right parent;
   - existing rows and OKR/initiative counts per team are unchanged;
   - the anonymous role still can't read teams.
2. Apply to beakon-prod with the same checks. Per-team OKR and initiative counts must match the 2026-10-30 snapshot: Tech & Perso Builders has 8 OKRs and 5 initiatives; 13 initiatives have no team.
3. **Rollback:** delete the three ids. That's safe only while nothing references them, and the migration file documents it.
