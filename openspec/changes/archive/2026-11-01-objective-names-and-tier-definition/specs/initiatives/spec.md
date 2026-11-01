# Spec Delta

## MODIFIED Requirements

### Requirement: Tier
An initiative SHALL have an optional tier, T1, T2 or T3: its go-to-market launch tier — T1 Market-moving (high impact), T2 Capability (medium impact), T3 Enhancement (low impact) — used by design and product marketing. Tier is not the size of the work. For a vault-managed initiative, tier comes from the vault.

#### Scenario: Tier shown
- **WHEN** an initiative has tier T2
- **THEN** the drawer and the list show "T2"

#### Scenario: No tier
- **WHEN** an initiative has no tier
- **THEN** the tier is shown as empty, not as a default value
