# Tasks: vault-sync-quarter-keys

## 1. Tooling

- [x] 1.1 `vault_sync.py`:
  - OKR key `<quarter>/<key>`; same-quarter bare keys adopted and re-keyed;
  - OKR archive-on-missing scoped to `okr.json`'s quarter;
  - write-back matches by quarter key.

  Tests cover legacy adoption, the next quarter neither overwriting nor archiving Q4, and write-back by quarter key (23/23).

## 2. Re-key the existing OKRs

- [x] 2.1 Dry run against prod: 16 OKR updates, all `source_key` only, 0 creates, 0 archives; initiatives unchanged.
- [x] 2.2 Apply to preview, then prod, with checks (applied as the equivalent single `update okrs set source_key = '2026-Q4/' || source_key …` statement; a later build against the new state reports 0 changes): 16 keys re-keyed, ids and live state unchanged, re-run touches 0 rows. Then a write-back check: it changes nothing in `okr.json`.

## 3. Review and release

- [x] 3.1 Run typecheck, lint, test and build. QA and dev-lead review. Deploy preview: `/share`, `/roadmap` and `/okrs` load. `openspec validate --strict`. Then the runbook note, merge and archive.
