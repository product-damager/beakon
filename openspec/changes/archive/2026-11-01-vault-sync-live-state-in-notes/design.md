# Design

## Context

See proposal.md for motivation. Current state:

- `write_back()` in `scripts/vault-sync/vault_sync.py` takes `--okr`, `--live` (JSON list from Beakon: `source_key`, `achievement`, `governance_status`, `health`), `--backup-dir` (default `<vault>/02 OKR/backups`) and `--backup`. It updates `status`, `progress`, `health`, `governance` of commitments whose `<quarter>/<key>` matches a live row, writes `okr.json` only if its text changed, and touches the marker `.vault-sync-writeback` in the backup dir.
- Guard: with `--backup` it copies `okr.json` to `okr.json.<stamp>-before-vault-sync-writeback.bak` (never overwriting); it refuses to write unless the newest `okr.json.*.bak` is newer than the marker.
- `okr.json` (2026-Q4) has three squads: "Finalize & Roll out" (6 commitments), "Assets Creation" (10, progress still empty) and "BU / PBX adoption" (no commitments; a "/" in its name would not even make a valid note file name).
- Both squad notes exist, are UTF-8, LF, no BOM, end with a newline, and each has a `## OKR — Kameleoon format (for the OKR sheet)` heading followed by two paragraphs and a table whose `#` column is the commitment's position in `okr.json` (fr-2 = 1 … fr-1 = 6). The Finalize & Roll out table is followed by "**Quarter average:** …", the Assets Creation table by "**Priority:** …".
- `02 OKR/backups/` already holds hand-made note backups named `<note name>.<date>-<reason>.md`.
- The spec's "Only titles and frontmatter cross over" governs what the *sync* reads into Beakon; this change reads note bodies only locally, to place the block, and sends nothing to Beakon.

## Goals / Non-Goals

**Goals:**
- One run of write-back updates `okr.json` and the squad notes from the same computed state, so they never disagree.
- Byte-identical notes outside the markers, provable by test.
- Same safety model as today: backup first, refuse otherwise, nothing half-written when the guard trips.

**Non-Goals:**
- A general Markdown parser or round-tripping of the note: the note is treated as text plus two marker lines.
- Customising columns, order or wording from the CLI.

## Decisions

### D1 — The block is rendered from `okr.json` after its update, not from the live JSON
Rows come from the in-memory `okr` object after the commitment loop, filtered to commitments that matched a live row. One source → note and `okr.json` cannot disagree, and the status derivation (`commitment_status`) is not duplicated.
*Alternative:* render from `--live` directly — would re-derive status/progress in a second place.

### D2 — Note path and scope
Note = `<vault>/02 OKR/<okr.quarter> OKR — <squad.name>.md`, with a new `--vault` option on `write-back` (default: the vault the script already derives for `build`). A squad is a candidate only if it has at least one synced commitment; squads with no commitments ("BU / PBX adoption") are skipped without reading anything. A missing note is reported, never created.
*Alternative:* glob `02 OKR/*` and match frontmatter `squad:` — more robust to renames but reads and risks touching unrelated notes; the request fixes the file name pattern.

### D3 — Text-level splice, preserving bytes
Read with `open(path, encoding="utf-8", newline="")` so `\r\n` survives; write with the same `newline=""`. The block uses the note's own line ending (`\r\n` if the note contains one, else `\n`). Marker lines are found as whole lines equal (after stripping trailing whitespace) to `<!-- beakon:live:start -->` / `<!-- beakon:live:end -->`.
- Exactly one start and one end, start before end → replace the lines strictly between them.
- Neither present → insert (D4).
- Anything else → skip and report "broken markers".
The new text is compared with the old one; the file is written only when it differs (keeps mtime on same-day no-op runs).
*Alternative:* regex substitution over the whole text — harder to reason about with duplicated markers.

### D4 — Insertion point
Find the first line starting with `## OKR — Kameleoon format`; from there, the first line starting with `|` opens the table, and the table ends at the first following line not starting with `|`. Insert after the table's last row: an empty line, then the start marker, block lines, end marker. The existing text after the table (its empty line, then "**Quarter average:**" / "**Priority:**") follows unchanged. No heading or no table → skip and report.

### D5 — Block format
```
<!-- beakon:live:start -->
### Live state from Beakon — synced 2026-11-02

Generated from Beakon. Edit progress in Beakon, not here.

| # | Commitment | Governance | Achievement % | Status | Health |
| --- | --- | --- | --- | --- | --- |
| 1 | We have moved all customers to the new Personalization… | To validate | 90% | In progress | On track |

Average: 38% (6 of 6 commitments with a %)
<!-- beakon:live:end -->
```
- `###` because the block sits under the `##` Kameleoon heading.
- Date = run date, local, `YYYY-MM-DD`.
- `#` = 1-based position in the squad's `commitments` list, so it matches the hand-written table even when a commitment is not synced.
- Commitment: newlines → spaces, `|` → `\|`; if longer than 60 characters, cut at the last space within the first 60 (hard cut if none) and append `…`.
- Governance / status / health: stored value with `_` → space and first letter upper-cased (`to_validate` → "To validate"); empty → "—". No lookup table, so new Beakon values still render.
- Achievement %: `progress` + `%`; `None` → "—".
- Average line, after an empty line under the table: m = rows in the block, k = rows whose `progress` is not `None` (0 counts), n = mean of those k values, rounded half up with `math.floor(mean + 0.5)` — not Python's `round()`, which rounds halves to even (`round(36.5)` = 36). Today's Finalize & Roll out values give 37.5 → 38%, matching the "Quarter average: 38%" already in the note. k = 0 → "Average: —". Plain mean, not weighted by tier or class, so it stays comparable with the hand-written quarter average.

### D6 — Backups and guard, extended to notes
`--backup` also copies each candidate note to `02 OKR/backups/<note file stem>.<stamp>-before-vault-sync-writeback.md` (same stamp and `-n` collision rule as `okr.json`, `copyfile` + `utime`). The `.md` suffix follows the folder's existing note backups. The guard becomes: every note that would change needs a backup of that note (matched by prefix `<stem>.` and suffix `-before-vault-sync-writeback.md`) newer than the marker, in addition to the existing `okr.json` check. All rendering and guard checks run before the first write; `okr.json` is written first, then the notes, then the marker.
*Alternative:* one shared backup check for `okr.json` only — a note could then be overwritten with no copy.
Note backups do not end in `.bak`, so existing tests counting `.bak` files are unaffected.

### D7 — Report
Today's stdout list of `key.field: old → new` lines gains one line per note: `note <name>: updated | unchanged | markers inserted | skipped (<reason>)`. The run still prints "no changes" only when neither `okr.json` nor any note changed.

### D8 — QA follow-ups (2026-11-01)
- D2: `--vault` defaults to the real vault only when `--okr` is the default `okr.json`; with a copied `okr.json` it is required, so a dry run never writes the real notes.
- D3: markers are matched after stripping surrounding whitespace and a BOM on line 1; markers, the Kameleoon heading and table rows inside fenced code blocks (```` ``` ```` / `~~~`) are ignored. Right before writing, each note is read again; if it changed since it was planned, it is skipped and reported ("note changed during the run") rather than overwritten. A tiny window between that check and the write remains.
- D4: when the table ends the file without a final newline, the block is appended and the file still ends without one.
- D5: commitment text escapes `\\` before `|`, and `<!--` becomes `&lt;!--`.
- D6: only notes whose text would change are backed up. `--backup-dir` defaults to `<vault>/02 OKR/backups` of the vault in use, so a dry run on a copy leaves the real backups and marker alone (dev-lead).

### Supersedes
Supersedes nothing. Extends the archived change `2026-10-30-vault-sync` (write-back to `okr.json` only) to the squad OKR notes; its rule that nothing is written back to feature notes stays as is.

## Schema impact

None: no tables, RLS policies, grants or functions change; anonymous access is unchanged. The block lives only in the local vault.

## Risks / Trade-offs

- [Obsidian or another editor rewrites the note while write-back runs] → the run is seconds long and the PM triggers it; the backup taken just before covers a bad overlap.
- [Someone renames the Kameleoon heading or note] → skip + report, never a guess; the PM fixes the name or adds the markers by hand.
- [Hand edits inside the block are lost] → by design (the block line says so); backups keep the previous version.
- [Backups pile up in `02 OKR/backups/` and appear in Obsidian search] → same trade-off already accepted for `okr.json`; cleanup is manual.
- [The hand-written Kameleoon `%` column and the "not updated automatically" sentence now disagree with the block] → listed as a follow-up for the PM in tasks; not edited by code.

## Migration Plan

No data migration. First run after apply inserts the markers in both squad notes (reported). Rollback: restore the note backups from `02 OKR/backups/`, or delete the block by hand; reverting the code stops future refreshes.

## Open Questions

None blocking. Column labels and the governance/status/health wording can be tuned after the first run without changing the specs.
