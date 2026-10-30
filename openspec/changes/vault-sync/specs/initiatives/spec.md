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
For an initiative managed by the vault, the definition fields (title, squad, owner when set in the vault, area, tier, target quarter when set in the vault) SHALL be read-only in Beakon, marked "Managed in the vault", and the database SHALL reject changes to them from signed-in users; its live-state fields SHALL stay editable.

#### Scenario: Edit a vault-owned field
- **WHEN** a signed-in user tries to rename a vault-managed initiative
- **THEN** the title field is not editable, and an update sent directly to the database is refused

#### Scenario: Edit live state
- **WHEN** a signed-in user changes the status or health of a vault-managed initiative
- **THEN** the change is saved

#### Scenario: Beakon-only initiative
- **WHEN** an initiative is not managed by the vault
- **THEN** every field stays editable as before
