# Spec Delta: vault-sync

## MODIFIED Requirements

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
