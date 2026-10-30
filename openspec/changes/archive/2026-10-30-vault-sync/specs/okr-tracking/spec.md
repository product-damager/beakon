# Spec Delta: okr-tracking

## ADDED Requirements

### Requirement: OKR tier
An OKR SHALL have an optional tier, T1, T2 or T3 (size of the work), shown next to and independent of its OKR class (commitment level). For a vault-managed OKR, tier comes from the vault.

#### Scenario: Tier and class together
- **WHEN** an OKR has tier T1 and class Committed
- **THEN** the drawer shows both, as separate fields

### Requirement: Vault-managed OKR definitions are read-only
For an OKR created from an `okr.json` commitment, the definition fields (title, squad, year, quarter, deliverable detail, strategic objective, tier) SHALL be read-only in Beakon, marked "Managed in the vault", and the database SHALL reject changes to them from signed-in users; governance, achievement, health, class, notes, owners and initiative links SHALL stay editable.

#### Scenario: Record achievement on a synced commitment
- **WHEN** a signed-in user sets achievement to 40% on a vault-managed OKR
- **THEN** it is saved

#### Scenario: Edit a synced commitment's text
- **WHEN** a signed-in user tries to change the title of a vault-managed OKR
- **THEN** the field is not editable, and an update sent directly to the database is refused
