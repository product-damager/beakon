# Tasks: vault-sync

> Not started: waiting for the PM's review of proposal.md (D1–D7). Tasks may change with the answers.

## 1. Schema (backend-engineer)

- [ ] 1.1 Migration `supabase/migrations/2026-11-vault-sync.sql`, mirrored in `schema.sql`. It adds:
  - `tier` (with a check), `area`, `source` and `source_key` on `initiatives`, and `tier`, `source` and `source_key` on `okrs`;
  - a partial unique index on `(source, source_key)`;
  - the `guard_vault_definitions` trigger, with search_path pinned and no API execute.

  Verify: it re-runs cleanly twice on preview, and anon still has none of the new columns.
- [ ] 1.2 Apply to preview. Verify:
  - an authenticated update of a vault-owned column on a test row with `source = 'vault'` is refused, and a live-state update succeeds (inside a transaction that is rolled back);
  - the advisor is clean.

  Then apply to prod with the same checks.

## 2. Data layer and UI (backend-engineer, frontend-engineer)

- [ ] 2.1 `lib/types.ts` / `lib/data.ts` / `lib/seed.ts`: add tier, area, source and sourceKey to the mappers, keeping seed mode in parity. Verify typecheck and the tests.
- [ ] 2.2 Drawers: vault-owned fields are read-only with "Managed in the vault", and tier appears in the drawers and lists. Verify in seed mode with a seeded vault-managed initiative and OKR. Product-designer pass.

## 3. Sync tooling

- [ ] 3.1 `scripts/vault-sync/build-sql.mjs`: reads `04 Features` and `okr.json`, validates them, and writes idempotent SQL plus a report. Unit tests cover the key, the squad mapping, the out-of-scope skip, the denylist, archive-on-missing and quarter → dates.
- [ ] 3.2 `scripts/vault-sync/write-back.mjs`: merges live-state JSON into `okr.json` and feature `status:` lines. Unit tests check that only the owned keys change and that the formatting is preserved.
- [ ] 3.3 Runbook: how the PM asks Claude for a sync or a write-back. Add it to `supabase/README.md` and a vault note.

## 4. First run (needs the D5 and D6 answers)

- [ ] 4.1 Apply the D5 `beakon:` links and the D6 rename. Do a dry-run report and show it to the PM.
- [ ] 4.2 Apply to preview, check, apply to prod, check (counts match the report; anon surface unchanged). Then run the first write-back and show the PM the diff.

## 5. Review

- [ ] 5.1 Run typecheck, lint, test and build; QA (including an attempt to bypass the guard through the API); dev-lead Approved; `openspec validate vault-sync --strict` passes.
