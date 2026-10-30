# Spec Delta: vault-sync

## Purpose

Keep one writer per field between the PM's Obsidian vault and Beakon: definitions (features, delivery commitments, tier, squad) flow from the vault into Beakon, and live state (status, % done, health, governance) flows from Beakon back to the vault's OKR copy.

## ADDED Requirements

### Requirement: Definitions synced from the vault
A sync run SHALL create or update one initiative per feature note in `04 Features` whose squad is "Finalize & Roll out" or "Assets Creation", and one OKR per commitment of those squads in `okr.json`, setting only the vault-owned fields of the field-ownership table.

#### Scenario: New feature note
- **WHEN** a sync runs and a feature note "Rollout Preview" with squad "Finalize & Roll out" has no Beakon record
- **THEN** an initiative "Rollout Preview" is created on "Finalize & Roll out", marked as managed by the vault

#### Scenario: Note outside scope
- **WHEN** a feature note's squad is "other"
- **THEN** the run skips it and lists it in the report

### Requirement: Stable identity and no deletion
Synced records SHALL be matched on a stable vault key: the feature note's file name, or the commitment key. A run SHALL be idempotent and SHALL NOT delete records; a record whose key no longer exists in the vault SHALL be archived and reported.

#### Scenario: Re-run
- **WHEN** the same sync runs twice without vault changes
- **THEN** the second run changes nothing

#### Scenario: Feature removed from the vault
- **WHEN** a synced feature note is deleted from the vault and the sync runs
- **THEN** its initiative is archived, not deleted, and the report lists it

### Requirement: Adopting existing records
A feature note that names an existing Beakon initiative SHALL adopt that initiative instead of creating a new one; initiatives no note claims SHALL stay Beakon-only and fully editable.

#### Scenario: Claimed initiative
- **WHEN** the note "Rollout Preview" names the existing initiative "FF: Rollout Preview" and the sync runs
- **THEN** that initiative becomes vault-managed and takes the note's title and squad, keeping its history, links and live state

#### Scenario: Unclaimed initiative
- **WHEN** no note names an existing team-less initiative
- **THEN** it is left exactly as it is

### Requirement: Live state written back
After each Beakon-side change cycle, a write-back run SHALL copy the live state of synced OKRs into `okr.json` (status, progress, health, governance), and the live status of synced initiatives into their feature notes, changing nothing else in those files.

#### Scenario: Achievement recorded in Beakon
- **WHEN** a synced OKR's achievement is set to 40% in Beakon and write-back runs
- **THEN** the matching `okr.json` commitment shows progress 40 and status "in_progress", and its text and deliverables are unchanged

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
