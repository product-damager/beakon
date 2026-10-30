# Tasks: vault-sync

PM decisions: 2026-10-30 (proposal.md). Stop points: 4.1 (the dry-run report) and 5.2 (the first `okr.json` diff).

## 1. Schema (backend)

- [x] 1.1 Migration `supabase/migrations/2026-10-vault-sync.sql`, mirrored in `schema.sql`. It adds:
  - `tier` (check T1/T2/T3), `area`, `source`, `source_key` and `vault_fields text[] default '{}'` on `initiatives`, and `tier`, `source`, `source_key` and `vault_fields` on `okrs`;
  - a partial unique index on `(source, source_key)`;
  - the `guard_vault_definitions` trigger: for `authenticated`, it rejects any change to a column in `old.vault_fields`, or to `source`, `source_key` or `vault_fields` on a vault row, and it forces new rows to `source = null` and `vault_fields = '{}'`. search_path is pinned and the API can't execute it;
  - `persist_okr` keeps the stored value for any column in `vault_fields`.

  Verify: it re-runs cleanly twice on preview.
- [x] 1.2 Apply to preview. Verify, inside a rolled-back block:
  - an `authenticated` rename of a vault row is refused;
  - an update of health is accepted;
  - `persist_okr` on a vault OKR keeps the stored title;
  - anon has no grant on the new columns;
  - the advisor is clean.

  Then apply to prod with the same checks.

## 2. Data layer and UI

- [x] 2.1 Types, mappers and seed:
  - `lib/types.ts`, `lib/data.ts` and `lib/seed.ts` gain `tier`, `area`, `source`, `sourceKey` and `vaultFields`;
  - `persistInitiative` and `persistMove` never send columns listed in `vaultFields`, nor the vault metadata;
  - seed mode gets one vault-managed initiative and one vault-managed OKR for the demo.

  Verify: typecheck, plus unit tests for the column stripping.
- [x] 2.2 UI (frontend-engineer). Vault-owned fields are read-only with a "Managed in the vault" hint in both drawers. For vault-managed initiatives:
  - status pickers (drawer and list) are disabled;
  - Board cards can't move to another column but can be reordered within it;
  - Archive and Restore are hidden;
  - timeline drag and resize are blocked when the vault owns the dates.

  Tier is shown in both drawers and in the initiative list and OKR table. Verify in seed mode. Product-designer pass.

## 3. Sync tooling

- [x] 3.1 `scripts/vault-sync/vault_sync.py build` (Python, see design Decision 3) plus unit tests. Covers:
  - keys, squad → team, the status mapping and parked ↔ archived;
  - the D2 strategic_objective with defaults, and visibility internal on create;
  - D5 `beakon:` adoption and archive-on-missing;
  - skips (squad "other", the denylist, validation errors);
  - the dry-run report against a JSON dump of current rows.
- [x] 3.2 `scripts/vault-sync/vault_sync.py write-back` plus unit tests. Covers the D3 mapping, that only the 4 live-state keys of synced commitments change, and that it refuses to run without a fresh backup in `02 OKR/backups/`.
- [x] 3.3 Runbook in `supabase/README.md`: how the PM asks Claude for a sync or a write-back, and which paths it uses. Gitignore the generated files.

## 4. First sync

- [x] 4.1 Add the D5 `beakon:` link and build a dry-run report against production. **STOP: show the report to the PM.** (Done 2026-10-30. After the first report the PM dropped the Experiment Rules link, keeping `i-3le9kw0` as Q3 history; only "Rollout Preview" → `i-98z7vw8` is linked.)
- [x] 4.2 After the PM's OK: apply to preview, check (counts match the report, guard works, anon surface unchanged), then apply to prod and check.

## 5. Write-back

- [x] 5.1 Back up `okr.json` to `02 OKR/backups/`.
- [x] 5.2 Run the first write-back. **STOP: show the `okr.json` diff to the PM.**

## 6. Review and release

- [ ] 6.1 Run typecheck, lint, test and build. QA, including guard-bypass attempts through the API and every UI path. dev-lead Approved. `openspec validate vault-sync --strict` passes. Then the deploy preview, merge and archive.
