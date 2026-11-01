# vault-sync Specification

## Purpose
Keep one writer per field between the PM's Obsidian vault and Beakon: definitions (features with their status, delivery commitments, tier, squad) flow from the vault into Beakon, and the live state of OKRs (status, % done, health, governance) flows from Beakon back to the vault's OKR copy.

## Requirements

### Requirement: Definitions synced from the vault
A sync run SHALL create or update one initiative per feature note in `04 Features` whose squad is "Finalize & Roll out" or "Assets Creation", and one OKR per commitment of those squads in `okr.json`, setting only the vault-owned fields of the field-ownership table.

#### Scenario: New feature note
- **WHEN** a sync runs and a feature note "Rollout Preview" with squad "Finalize & Roll out" has no Beakon record
- **THEN** an initiative "Rollout Preview" is created on "Finalize & Roll out", marked as managed by the vault

#### Scenario: Note outside scope
- **WHEN** a feature note's squad is "other"
- **THEN** the run skips it and lists it in the report

### Requirement: Stable identity and no deletion
Synced records SHALL be matched on a stable vault key: the feature note's file name, or the commitment's quarter plus key (e.g. "2026-Q4/fr-1"), because commitment keys restart every quarter. A run SHALL be idempotent and SHALL NOT delete records; a record whose key no longer exists in the vault SHALL be archived and reported, except that OKRs of quarters other than the one in `okr.json` are history and SHALL never be archived or changed by a sync.

#### Scenario: Re-run
- **WHEN** the same sync runs twice without vault changes
- **THEN** the second run changes nothing

#### Scenario: Feature removed from the vault
- **WHEN** a synced feature note is deleted from the vault and the sync runs
- **THEN** its initiative is archived, not deleted, and the report lists it

#### Scenario: Next quarter reuses commitment keys
- **WHEN** `okr.json` moves to 2027-Q1 with commitments fr-1 … and the sync runs
- **THEN** new OKRs are created for 2027-Q1, and the 2026-Q4 OKRs fr-1 … keep their text, values and archive state

### Requirement: Adopting existing records
A feature note that names an existing Beakon initiative SHALL adopt that initiative instead of creating a new one; initiatives no note claims SHALL stay Beakon-only and fully editable.

#### Scenario: Claimed initiative
- **WHEN** the note "Rollout Preview" names the existing initiative "FF: Rollout Preview" and the sync runs
- **THEN** that initiative becomes vault-managed and takes the note's title and squad, keeping its history, links and live state

#### Scenario: Unclaimed initiative
- **WHEN** no note names an existing team-less initiative
- **THEN** it is left exactly as it is

### Requirement: Initiative status follows the vault
For a vault-managed initiative, status and archiving SHALL come from the feature note's `status`: idea → Backlog, discovery → Opportunity Framing, spec and prototype → Solution Framing, in-dev → In Development, shipped → Released, parked → archived (keeping the last mapped status). Leaving `parked` SHALL restore the initiative. Nothing SHALL be written back from Beakon to feature notes.

#### Scenario: Parked feature
- **WHEN** a feature note's status changes to `parked` and the sync runs
- **THEN** its initiative is archived and appears on the Archived page

#### Scenario: Un-parked feature
- **WHEN** that note's status changes from `parked` to `spec` and the sync runs
- **THEN** the initiative is restored with status Solution Framing

### Requirement: New synced initiatives are internal
An initiative created by a sync SHALL start with visibility "internal"; visibility stays Beakon-owned afterwards.

#### Scenario: Created by the sync
- **WHEN** a sync creates an initiative from a feature note
- **THEN** it does not appear on /share until someone in Beakon makes it external

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

### Requirement: Strategic objective for synced commitments
A synced OKR's strategic objective SHALL come from the commitment's `strategic_objective` (core, ai, data, internal); when it is missing, it SHALL default to "A trusted platform for every team" (core) for "Finalize & Roll out" and "AI everywhere, increasingly autonomous" (ai) for "Assets Creation".

#### Scenario: Commitment without strategic objective
- **WHEN** an "Assets Creation" commitment has no `strategic_objective` and the sync runs
- **THEN** its OKR is linked to "AI everywhere, increasingly autonomous"

#### Scenario: Codes unchanged by the rename
- **WHEN** a "Finalize & Roll out" commitment has `strategic_objective: core` and the sync runs after the rename
- **THEN** its OKR is linked to "A trusted platform for every team", the same objective it was linked to before, and the sync reports no change for that field

### Requirement: Runs triggered by the PM without stored credentials
Sync and write-back SHALL be runnable by the PM in a Claude session, with no server, scheduler or stored database credentials; database changes SHALL be applied to beakon-preview and checked before beakon-prod.

#### Scenario: PM runs a sync
- **WHEN** the PM asks Claude to sync the vault
- **THEN** Claude produces a report of creates, updates, archives and skips, applies it to preview, checks it, then applies it to prod

### Requirement: Only titles and frontmatter cross over
A sync SHALL read only note titles and frontmatter, never note bodies, and SHALL skip and report any title matching the customer-name denylist.

#### Scenario: Customer name in a title
- **WHEN** a feature note's title contains a denylisted customer name
- **THEN** the note is not synced and the report asks for a rename

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

### Requirement: Vault-managed teams
A team SHALL be vault-managed when it owns at least one OKR created by a vault sync whose year and quarter are the immediately previous quarter, the current quarter or a later one, archived or not. The previous quarter counts so the lock holds after a quarter starts, until its commitments are synced. The set SHALL be derived from the OKRs in Beakon at the time of the check, never from a fixed list, and the app and the database SHALL apply the same rule. Sync runs SHALL NOT be restricted by it.

#### Scenario: Squads with synced commitments this quarter
- **WHEN** it is 2026-Q4 and "Finalize & Roll out" and "Assets Creation" each own synced 2026-Q4 OKRs
- **THEN** both are vault-managed, and no other team is

#### Scenario: New quarter before its commitments are synced
- **WHEN** it is 15 January 2027 (2027-Q1), the 2027-Q1 commitments have not been synced yet, and a team owns synced OKRs of 2026-Q4 only
- **THEN** that team is still vault-managed

#### Scenario: Synced OKRs two quarters back only
- **WHEN** it is 2027-Q2 and a team owns synced OKRs of 2026-Q4 only
- **THEN** that team is not vault-managed

#### Scenario: Previous quarter across the year boundary
- **WHEN** it is 2027-Q1
- **THEN** the immediately previous quarter is 2026-Q4

#### Scenario: Synced commitment for a later quarter
- **WHEN** it is 2026-Q4 and a sync creates 2027-Q1 OKRs for a team that had none before
- **THEN** that team is vault-managed from that moment

#### Scenario: New squad in the vault
- **WHEN** `okr.json` gains a third squad, its commitments are synced, and that squad's team is not in any list in Beakon's code
- **THEN** that team becomes vault-managed without a code change

#### Scenario: Sync creates on a vault-managed team
- **WHEN** a sync run creates or updates OKRs on "Finalize & Roll out" while it is vault-managed
- **THEN** the run succeeds as before
