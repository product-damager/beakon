# Design

## Context

See proposal.md — Why. Current state relevant to the approach:

- `strategic_objectives` holds four 2026 rows (`so-core`, `so-ai`, `so-data`, `so-internal`). Names are written only by SQL: `supabase/seed.sql` (preview), `supabase/seed_prod.sql` (prod bootstrap, `on conflict (id) do update set name = …`) and `lib/seed.ts` `STRATEGIC_OBJECTIVES` (seed mode, no Supabase env vars). No UI edits objective names; vault-sync never writes them.
- Everything else refers to objectives by id: OKR and initiative foreign keys, saved-view filters (`strategicObjectiveIds`), vault-sync `OBJECTIVE_MAP` / `OBJECTIVE_DEFAULT` (codes → ids), and the OKR list's short column aliases `STRATEGIC_OBJECTIVE_ALIAS` (keyed by id, "Core"/"AI"/…).
- OKR and BU groups sort by team/BU name; no code parses the objective name string (the alias map was built by id for that reason). Two places do depend on objective order or name (found by QA, see D4): the Supabase load has no order and "New OKR" takes the first objective as its default; the archived OKRs list can sort by objective name.
- Tier (T1–T3) came in with vault-sync (archived 2026-10-30) as a vault-owned text column checked against T1/T2/T3. Its definition as "size of the work" lives only in prose: `openspec/config.yaml` context, the okr-tracking and initiatives specs, and comments in `lib/types.ts`, `components/ui.tsx`, `components/OkrDrawer.tsx`. No user-visible string defines tier (the chip tooltip is just "Tier T2").

## Goals / Non-Goals

**Goals:**
- New names visible in seed mode, on beakon-preview and on beakon-prod, with no change to any id or link.
- One accurate definition of tier everywhere it is written down.

**Non-Goals:**
- No schema, RLS, grant or function change; no UI change beyond the data it already displays.
- No tier labels ("Market-moving" …) in the UI — that would be a feature, not a wording fix.

## Decisions

### D1. Rename by id in a one-off data migration, mirrored in the seeds
`supabase/migrations/2026-11-objective-names.sql`: one transaction, `update strategic_objectives set name = '…' where id = 'so-core'` and the same for `so-ai`. Re-running sets the same values, so it is idempotent; it touches no other row or column. Same header style as `2026-10-org-2027-configure-launch.sql` (purpose, idempotency, where it is mirrored, preview-then-prod, rollback = the reverse two updates).

Seeds are edited in place (`seed.sql`, `seed_prod.sql`, `lib/seed.ts`) so a rebuilt preview, a fresh prod bootstrap and seed mode all match.

- *Alternative considered:* new ids (`so-trusted-platform`, …) with the new names. Rejected: it would require relinking every OKR/initiative, rewriting saved views and the vault-sync map, for a label change. The id is not user-visible.
- *Alternative considered:* rely on re-running `seed_prod.sql` on prod (its upsert already sets names). Rejected: that file re-asserts every reference row; a targeted two-row update is smaller and easier to review on prod.
- *Not in schema.sql:* this is data, not schema (project rule: migrations/ for data backfills).

### D2. Keep the short aliases "Core" / "AI"
The OKR list column shows id-keyed aliases with the full name in a tooltip. "Core" and "AI" still read as the common short forms of the new names, and the proposal puts alias changes out of scope. Only the alias map's comment, which quotes the old full name, is updated.

### D3. Tier wording: one definition, repeated verbatim
Use "go-to-market launch tier — T1 Market-moving (high impact), T2 Capability (medium impact), T3 Enhancement (low impact); not the size of the work" in config.yaml, the specs and the comments. `lib/types.ts`'s "T1 largest … T3 smallest" becomes "T1 highest impact … T3 lowest". Values, the T1/T2/T3 check, vault ownership and read-only behaviour are unchanged. `config.yaml` also loses the stale "not in Beakon yet" (tier shipped with vault-sync).

### D4. Fixed objective order in the data layer
QA found that the rename UPDATE on preview changed the physical row order, so the unordered `strategic_objectives` select returned Data, Internal, Core, AI and "New OKR" defaulted to Data (seed mode was unaffected: static array). The order was never guaranteed; the rename exposed it.

Decision: after loading, sort objectives by a fixed id list (so-core, so-ai, so-data, so-internal — the seed-mode order), unknown ids last by name. Pure function with a unit test; no schema change. Spec: new okr-tracking requirement "Strategic objective order".

- *Alternative considered:* `.order("name")` — one line and gives the same order today, but ties the order to the names and the database collation, so the next rename could move it again.
- *Alternative considered:* `.order("id")` — puts AI first and makes it the default.
- *Alternative considered:* a `position` column — a schema change for four reference rows.

Side effect accepted: the archived OKRs list, sorted by objective name, now lists Core ("A trusted…") before AI ("AI everywhere…"); that is the rename's expected effect.

### Decision record
- Supersedes: the "tier = size of the work" glossary entry in `openspec/config.yaml` and the tier wording of the vault-sync change (archive `2026-10-30-vault-sync`); does not change that change's D2 code→id mapping, only the names behind the ids.
- Consequences: Beakon, the vault OKR notes and the company sheet use the same objective names and the same meaning of tier; any future tier feature (labels, filters, PMM views) starts from the launch-tier meaning.

## Schema impact

None. Tables, RLS policies, grants and functions unchanged; anonymous access unchanged. Two `strategic_objectives.name` values change on preview and prod; anything that already displays those names (to signed-in or anonymous readers) shows the new ones.

## Risks / Trade-offs

- [Prod drift — the prod names differ from seed values] → the migration updates by id unconditionally; check with a select before and after on both projects.
- [Browser-cached filter labels / saved views] → saved views store ids, so they resolve to the new name on next load; nothing to migrate.
- [A test or snapshot pins the old name] → none found in `lib/__tests__` or `scripts/vault-sync/test_vault_sync.py`; the test run in tasks confirms.

## Migration Plan

1. Merge code (seeds, comments, specs, migration file).
2. Apply the migration on beakon-preview, check the four rows and the OKR page.
3. With the PM's explicit go, apply on beakon-prod, same checks.
4. Rollback: the reverse two updates (old names by id); no other state depends on the names.
