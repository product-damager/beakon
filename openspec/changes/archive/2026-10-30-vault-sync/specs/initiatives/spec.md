# Spec Delta: initiatives

## ADDED Requirements

### Requirement: Tier
An initiative SHALL have an optional tier, T1, T2 or T3, describing the size of the work (used by design and product marketing). For a vault-managed initiative, tier comes from the vault.

#### Scenario: Tier shown
- **WHEN** an initiative has tier T2
- **THEN** the drawer and the list show "T2"

#### Scenario: No tier
- **WHEN** an initiative has no tier
- **THEN** the tier is shown as empty, not as a default value

### Requirement: Vault-managed definition fields are read-only
For an initiative managed by the vault, the fields the vault owns for that initiative (always title, squad, status, archived, area and tier; owner and target dates when the note sets them) SHALL be read-only in Beakon and marked "Managed in the vault", and the database SHALL reject changes to them from signed-in users. Its other fields (health, DIVE, links, dependencies, notes, theme, visibility, descriptions, order) SHALL stay editable.

#### Scenario: Rename attempt
- **WHEN** a signed-in user tries to rename a vault-managed initiative
- **THEN** the title field is not editable, and an update sent directly to the database is refused

#### Scenario: Status change attempt
- **WHEN** a signed-in user tries to change a vault-managed initiative's status from the drawer, the list, or by dragging its card to another Board column
- **THEN** the change is not possible, and an update sent directly to the database is refused

#### Scenario: Archive attempt
- **WHEN** a signed-in user opens a vault-managed initiative
- **THEN** no Archive or Restore action is offered

#### Scenario: Edit live fields
- **WHEN** a signed-in user changes the health, DIVE score or notes of a vault-managed initiative, or reorders its card within its Board column
- **THEN** the change is saved

#### Scenario: Beakon-only initiative
- **WHEN** an initiative is not managed by the vault
- **THEN** every field stays editable as before
