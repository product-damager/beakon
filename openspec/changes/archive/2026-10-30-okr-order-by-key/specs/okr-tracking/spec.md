# Spec Delta: okr-tracking

## ADDED Requirements

### Requirement: OKR table columns and stable order
OKR rows SHALL show Title, Objective, Quarter, Governance, Health, Team (or business unit), Achievement and Updated. Within a group, OKRs SHALL be ordered by commitment key in natural order (fr-1, fr-2 … fr-10) for vault-synced OKRs, followed by Beakon-only OKRs in record-id order; editing an OKR SHALL NOT change its position. There is no user sorting on this page.

#### Scenario: Edit keeps the position
- **WHEN** a user changes the achievement of fr-4
- **THEN** fr-4 stays between fr-3 and fr-5 in its group

#### Scenario: Natural key order
- **WHEN** a group holds commitments ac-1, ac-2 and ac-10
- **THEN** they are listed ac-1, ac-2, ac-10

#### Scenario: Synced before Beakon-only
- **WHEN** a group holds vault-synced and Beakon-only OKRs
- **THEN** the synced ones come first, then the Beakon-only ones by record id

## REMOVED Requirements

### Requirement: OKR table columns and order
**Reason**: Ordering by last update made the list reshuffle on every check-in (PM, 2026-10-30). Replaced by "OKR table columns and stable order".
**Migration**: None; the same columns are shown, only the order within groups changes.
