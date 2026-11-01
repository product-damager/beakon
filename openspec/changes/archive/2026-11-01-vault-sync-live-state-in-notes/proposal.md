# Proposal

## Why

Write-back copies Beakon's live OKR state into `okr.json` only, so the squad OKR notes the PM and the squads actually read in the vault ([Finalize & Roll out](<../../../../../02 OKR/2026-Q4 OKR — Finalize & Roll out.md>), [Assets Creation](<../../../../../02 OKR/2026-Q4 OKR — Assets Creation.md>)) show a hand-copied % that goes stale after every check-in. A generated, clearly bounded block in each note gives the current state without anyone retyping it, and without a second writer for the hand-written parts of the note.

## What Changes

- The write-back run also refreshes a generated block in each squad's vault OKR note `02 OKR/<quarter> OKR — <squad>.md`, between `<!-- beakon:live:start -->` and `<!-- beakon:live:end -->`:
  - a heading "Live state from Beakon — synced <date>",
  - the line "Generated from Beakon. Edit progress in Beakon, not here.",
  - a table with one row per synced commitment, in `okr.json` order: # · commitment (first ~60 characters) · governance · achievement % · status · health,
  - under the table, "Average: <n>% (<k> of <m> commitments with a %)", the plain mean of progress over synced commitments that have one; "Average: —" when none has.
- Nothing outside the markers changes: notes are read as UTF-8 and written back byte-identical outside the block.
- Missing markers: the block is inserted right after the note's "OKR — Kameleoon format" table, and the run reports the insertion. A note without that table, with broken markers, or that does not exist is skipped and reported; the run never creates a note.
- Each note is backed up to `02 OKR/backups/` before it is written, with the same "fresh backup or refuse" guard write-back already applies to `okr.json`.
- Only notes of squads in `okr.json` that have at least one synced commitment are touched. "BU / PBX adoption" has no commitments and no note, so it is skipped silently.
- The vault-sync spec now says that write-back writes vault notes, only inside the markers.
- Tests: first insert, refresh in place, nothing changed outside the markers (plus the skip and backup cases).

## Field ownership

- The block is a read-only copy of Beakon-owned live state (governance, achievement, status, health). Its only writer is the write-back run; nobody edits it by hand ("Edit progress in Beakon, not here").
- Everything outside the markers stays vault-owned and hand-written; write-back never writes there. One writer per field holds.
- Definitions (commitment text) are not written: the block shows a truncated copy of the text already in `okr.json`.

## Out of scope

- Changing the hand-written "OKR — Kameleoon format" table, including its `%` column, or the note's sentence saying the note "is not updated automatically". Those are vault text for the PM to update after the first run (listed as a follow-up in tasks).
- The quarter note `02 OKR/<quarter> OKR.md` and feature notes in `04 Features` (still never written by Beakon).
- Notes of past quarters: only the note of `okr.json`'s quarter is refreshed.
- The measurable layer (objectives and KRs) and deliverables.
- Any Supabase, UI or `/share` change. Anonymous visitors see nothing new: the block lives only in the local vault.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `vault-sync`: "OKR live state written back" now also covers the squad OKR notes; a new requirement defines the generated block, its markers, insertion, backups and the byte-identical guarantee outside the markers.

## Impact

- `scripts/vault-sync/vault_sync.py` (write-back) and `scripts/vault-sync/test_vault_sync.py`. Python standard library only, no new dependency.
- Vault files written by a run: `Repos/bu-dashboard/data/okr.json` (unchanged behaviour) and the squad notes in `02 OKR/`; new backups in `02 OKR/backups/`.
- No schema, RLS, grant or UI change; no change to what the sync reads into Beakon.
