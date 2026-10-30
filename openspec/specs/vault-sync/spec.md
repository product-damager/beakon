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
A write-back run SHALL copy the live state of vault-managed OKRs into `okr.json` (progress = achievement %, status derived as done at 100%, dropped when governance is Rejected, in_progress above 0, otherwise not_started; health; governance), changing nothing else in the file. Before the first write-back, the current `okr.json` SHALL be copied to the vault's `02 OKR/backups/`.

#### Scenario: Achievement recorded in Beakon
- **WHEN** a synced OKR's achievement is set to 40% in Beakon and write-back runs
- **THEN** the matching `okr.json` commitment shows progress 40 and status "in_progress", and its text and deliverables are unchanged

#### Scenario: First write-back
- **WHEN** write-back runs for the first time
- **THEN** a timestamped copy of `okr.json` exists in `02 OKR/backups/` before any change is made

### Requirement: Strategic objective for synced commitments
A synced OKR's strategic objective SHALL come from the commitment's `strategic_objective` (core, ai, data, internal); when it is missing, it SHALL default to "Core: Strengthening our foundations" for "Finalize & Roll out" and "AI: Scaling PBX adoption" for "Assets Creation".

#### Scenario: Commitment without strategic objective
- **WHEN** an "Assets Creation" commitment has no `strategic_objective` and the sync runs
- **THEN** its OKR is linked to "AI: Scaling PBX adoption"

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
