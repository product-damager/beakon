# Spec Delta

## MODIFIED Requirements

### Requirement: OKR live state written back
A write-back run SHALL copy the live state of vault-managed OKRs into `okr.json` (progress = achievement %, status derived as done at 100%, dropped when governance is Rejected, in_progress above 0, otherwise not_started; health; governance), changing nothing else in the file, and SHALL then refresh the live state block of each squad's vault OKR note. Before the first write-back, the current `okr.json` SHALL be copied to the vault's `02 OKR/backups/`.

#### Scenario: Achievement recorded in Beakon
- **WHEN** a synced OKR's achievement is set to 40% in Beakon and write-back runs
- **THEN** the matching `okr.json` commitment shows progress 40 and status "in_progress", and its text and deliverables are unchanged

#### Scenario: First write-back
- **WHEN** write-back runs for the first time
- **THEN** a timestamped copy of `okr.json` exists in `02 OKR/backups/` before any change is made

#### Scenario: Squad note follows okr.json
- **WHEN** write-back sets "Finalize & Roll out" fr-1 to progress 40 in `okr.json`
- **THEN** the live state block of `02 OKR/2026-Q4 OKR — Finalize & Roll out.md` shows 40% for that commitment in the same run

## ADDED Requirements

### Requirement: Live state block in squad OKR notes
Write-back SHALL write, in the note `02 OKR/<quarter> OKR — <squad>.md` of each squad of `okr.json`'s quarter, a block between `<!-- beakon:live:start -->` and `<!-- beakon:live:end -->`: the heading "Live state from Beakon — synced <run date>", the line "Generated from Beakon. Edit progress in Beakon, not here.", and a table with one row per synced commitment in `okr.json` order: # · commitment · governance · achievement % · status · health.

#### Scenario: Row content
- **WHEN** fr-1 is the 6th commitment of "Finalize & Roll out" in `okr.json`, with governance "to_validate", progress 30, status "in_progress", health "on_track", and write-back runs on 2026-11-02
- **THEN** the block's heading reads "Live state from Beakon — synced 2026-11-02" and fr-1's row shows # 6, the first ~60 characters of its text, "To validate", "30%", "In progress", "On track"

#### Scenario: Commitment without achievement
- **WHEN** an "Assets Creation" commitment has no progress recorded
- **THEN** its row shows "—" as achievement %, and "—" for any other empty value

#### Scenario: Long commitment text
- **WHEN** a commitment's text is longer than 60 characters
- **THEN** the row shows it cut at a word boundary within the first 60 characters followed by "…", with line breaks and table separators neutralised so the table stays one row per commitment

#### Scenario: Commitment not synced
- **WHEN** a commitment of `okr.json` has no matching OKR in Beakon
- **THEN** it has no row in the block, and the other rows keep their # from their position in `okr.json`

### Requirement: Average line under the live state table
The live state block SHALL end, under its table, with the line "Average: <n>% (<k> of <m> commitments with a %)", where m is the number of rows (synced commitments), k the number of those with a progress value, and n the plain mean of those k progress values rounded to the nearest integer, halves rounded up. When k is 0 the line SHALL read "Average: —".

#### Scenario: Every commitment has a %
- **WHEN** the 6 synced "Finalize & Roll out" commitments have progress 90, 20, 15, 0, 70 and 30
- **THEN** the line reads "Average: 38% (6 of 6 commitments with a %)" (37.5 rounded up; 0 counts as a value)

#### Scenario: Some commitments without a %
- **WHEN** 3 commitments are synced and only two have progress, 40 and 45
- **THEN** the line reads "Average: 43% (2 of 3 commitments with a %)"

#### Scenario: No commitment has a %
- **WHEN** none of the synced "Assets Creation" commitments has progress
- **THEN** the line reads "Average: —"

### Requirement: Squad notes unchanged outside the live state block
Write-back SHALL replace only the content between the two markers. Notes SHALL be read as UTF-8 and every byte outside the markers, including line endings, frontmatter, hand-written tables and the final newline, SHALL stay identical. A note whose block content would not change SHALL not be rewritten. Note bodies are read only to place the block; nothing from them goes to Beakon.

#### Scenario: Refresh in place
- **WHEN** a note already has a block and write-back runs with new live state
- **THEN** only the lines between the markers differ from the note before the run

#### Scenario: Nothing new to write
- **WHEN** write-back runs twice on the same day with the same live state
- **THEN** the second run leaves the note's bytes and modification time unchanged

#### Scenario: Hand edits inside the block
- **WHEN** someone edited a value between the markers by hand and write-back runs
- **THEN** the hand edit is replaced by the live state from `okr.json`

### Requirement: Block inserted when markers are missing
When a squad note has neither marker, write-back SHALL insert the markers and the block right after the table that follows the note's "OKR — Kameleoon format" heading, and SHALL report the insertion. When the note has no such table, has only one marker, a duplicated marker, or the end marker before the start marker, write-back SHALL leave the note unchanged and report it.

#### Scenario: First insert
- **WHEN** write-back runs and `02 OKR/2026-Q4 OKR — Assets Creation.md` has no markers
- **THEN** the block appears after the last row of its "OKR — Kameleoon format" table, the text that followed the table is unchanged after the block, and the report says the markers were inserted

#### Scenario: Broken markers
- **WHEN** a note contains `<!-- beakon:live:start -->` but no end marker
- **THEN** write-back leaves the note unchanged, reports it, and still writes `okr.json` and the other notes

#### Scenario: No Kameleoon format table
- **WHEN** a note has no markers and no "OKR — Kameleoon format" table
- **THEN** write-back leaves the note unchanged and reports it

### Requirement: Only notes of squads in okr.json are written
Write-back SHALL touch only the note named after a squad of `okr.json` with at least one synced commitment, in `okr.json`'s quarter. It SHALL never create a note, never write another file in `02 OKR/` apart from backups, and SHALL report a squad whose note is missing.

#### Scenario: Squad without commitments
- **WHEN** `okr.json` has the squad "BU / PBX adoption" with no commitments
- **THEN** no note is read, created or written for it

#### Scenario: Missing note
- **WHEN** "Assets Creation" has synced commitments but `02 OKR/2026-Q4 OKR — Assets Creation.md` does not exist
- **THEN** no file is created and the report names the missing note

#### Scenario: Other notes in 02 OKR
- **WHEN** write-back runs
- **THEN** the quarter note `2026-Q4 OKR.md`, notes of past quarters and any other file in `02 OKR/` keep their bytes

### Requirement: Squad notes backed up before writing
Before a squad note is first written by a write-back run, a timestamped copy of it SHALL exist in `02 OKR/backups/`. Write-back SHALL refuse to write anything, `okr.json` included, when a note it would change has no backup newer than the last write-back; earlier backups SHALL never be overwritten.

#### Scenario: Backup taken
- **WHEN** write-back runs with backups requested and a note's block changes
- **THEN** a timestamped copy of the note as it was before the run exists in `02 OKR/backups/`

#### Scenario: No fresh backup
- **WHEN** write-back would change a note and no backup of that note is newer than the last write-back
- **THEN** the run refuses, and neither `okr.json` nor any note is changed
