# Tasks

No schema, Supabase or UI work: no preview/prod order, no security advisor check and no product-designer review are needed (design.md — Schema impact). Backend tasks go to backend-engineer.

## 1. Block rendering

- [x] 1.1 Add the block renderer to `scripts/vault-sync/vault_sync.py` (design D1, D5): heading with run date, the "Generated from Beakon…" line, table rows for synced commitments in `okr.json` order with # = position in the squad's list, truncation at a word boundary within 60 characters + "…", `|` escaped, line breaks flattened, labels humanised, "—" for empty values, and the average line under the table (half-up rounding, "Average: —" when no row has a %). Verify with unit tests in `scripts/vault-sync/test_vault_sync.py` for: row content, empty progress, long text, a `|` in the text, an unsynced commitment keeping the others' #, and the average — 90/20/15/0/70/30 → "Average: 38% (6 of 6 commitments with a %)" (half rounds up, 0 counts), 40/45 plus one empty → "Average: 43% (2 of 3 commitments with a %)", no progress → "Average: —".

## 2. Splice into notes

- [x] 2.1 Add the marker splice (D3): UTF-8 read/write with `newline=""`, replace only between exactly one start and one end marker, skip and report broken markers (single, duplicated, reversed), no write when the text is unchanged. Verify with tests **refresh in place** (only the lines between markers differ) and **nothing changed outside the markers** (bytes before the start marker and after the end marker identical, on an LF note and a CRLF note with non-ASCII text, e.g. "—" and "é").
- [x] 2.2 Add marker insertion (D4) after the table under the "OKR — Kameleoon format" heading; skip and report when there is no heading or table. Verify with test **first insert** (block right after the table's last row, the following "**Quarter average:**" paragraph unchanged, report says "markers inserted") and a no-table test (note bytes unchanged, reported).

## 3. Wire into write-back

- [x] 3.1 Add `--vault` to `write-back` and pick candidate notes (D2): `02 OKR/<quarter> OKR — <squad>.md` for squads with at least one synced commitment; never create a note; report a missing one. Verify with tests: a squad with no commitments ("BU / PBX adoption") reads/writes nothing, a missing note is reported and not created, the quarter note and a past-quarter note in the same folder keep their bytes.
- [x] 3.2 Extend `--backup` and the guard to notes (D6): timestamped `.md` copy per candidate note, no overwrite, refuse the whole run (no `okr.json`, no note written) when a changing note has no backup newer than the marker; compute everything before the first write. Verify with tests: refusal leaves `okr.json` and notes untouched; a note backup equals the note before the run; two runs keep both backups; the existing `.bak`-counting tests still pass.
- [x] 3.3 Add the per-note report lines (D7) and check that a same-day re-run with the same live state prints "unchanged" and keeps the notes' mtime. Verify with a test.
- [x] 3.4 Update the write-back runbook in `supabase/README.md` (which notes are written, the markers, note backups, how to roll back) and the module docstring. Verify by following the runbook's command in a temp vault copy.
- [x] 3.5 Run `python3 -m unittest discover scripts/vault-sync` — all tests pass.

## 4. First run on the real vault

- [x] 4.1 Run write-back with `--backup` against the real vault. **STOP: show the PM the diff of both squad notes and of `okr.json`** (expected: markers inserted in "Finalize & Roll out" and "Assets Creation", nothing else changed in the notes; `git diff --no-index` of each note against its backup shows only added lines).

## 5. Review

- [x] 5.1 qa-engineer pass (try: broken markers, CRLF note, note open in Obsidian, missing note, run without `--backup`); findings become new tasks.
- [x] 5.2 Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` and `openspec validate vault-sync-live-state-in-notes --strict`; all pass. dev-lead review.

## 6. QA findings (qa-engineer, 2026-11-01)

- [x] 6.1 A note edited between planning and writing (e.g. in Obsidian) is re-read before writing and skipped with "skipped (note changed during the run)" instead of losing the edit. Verified by test `test_note_edited_during_the_run_keeps_the_edit`.
- [x] 6.2 `write-back` refuses a non-default `--okr` without `--vault`, so a dry run on a copied `okr.json` can't write the real notes. Verified by test `test_vault_is_required_with_a_copied_okr_json`.
- [x] 6.3 Inserting into a note that ends with its table and has no final newline keeps "no final newline". Verified by test `test_insert_keeps_a_missing_final_newline`.
- [x] 6.4 Markers, headings and tables inside fenced code blocks are ignored. Verified by test `test_fenced_code_is_ignored`.
- [x] 6.5 Commitment text escapes `\` before `|` and neutralises `<!--`. Verified by test `test_text_escaping`.
- [x] 6.6 Only notes whose block changes are backed up. Verified by test `test_unchanged_notes_are_not_backed_up`.
- [x] 6.7 Markers are recognised after a BOM on line 1 and with leading spaces. Verified by test `test_bom_and_indented_markers_are_recognised`.
- [x] 6.8 dev-lead nice-to-haves: `--backup-dir` defaults inside the given `--vault`; tests for duplicated and reversed markers and for a squad name that is not a file name. Verified by tests `test_backup_dir_defaults_inside_the_given_vault`, `test_broken_markers_and_no_table_are_skipped`, `test_squad_name_that_is_not_a_file_name_is_skipped`.

## Workflow follow-up

- PM: after the first run, update the hand-written text of both squad notes — the sentence "this note is not updated automatically" and whether the Kameleoon table keeps its `%` column.
- Archive after dev-lead approval and the PM's acceptance; then list vault notes to update (the quarter OKR note, `Repos/beakon hub.md` via `python3 "_scripts/build-hubs.py"`).
