# Spec Delta

## ADDED Requirements

### Requirement: 2026 strategic objective names
The 2026 strategic objectives SHALL carry the display names of the company OKR sheet: "A trusted platform for every team", "AI everywhere, increasingly autonomous", "Data: Powering trusted Insights & Outcomes" and "Internal". Renaming an objective SHALL keep its identity, so every OKR and initiative linked to it, filters and saved views that reference it keep pointing to it.

#### Scenario: Renamed objective shown
- **WHEN** an OKR is linked to the core strategic objective
- **THEN** the drawer and the OKR filter show "A trusted platform for every team", and no screen shows "Core: Strengthening our foundations"

#### Scenario: Links survive the rename
- **WHEN** an OKR was linked to the AI strategic objective and a saved view filtered on it before the rename
- **THEN** after the rename the OKR is still linked to it, now shown as "AI everywhere, increasingly autonomous", and the saved view still matches that OKR

#### Scenario: Unchanged objectives
- **WHEN** an OKR is linked to the data or the internal strategic objective
- **THEN** it shows "Data: Powering trusted Insights & Outcomes" or "Internal" as before

### Requirement: Strategic objective order
Strategic objectives SHALL be listed in a fixed order, the same in seed mode and with Supabase and independent of how the database returns rows: "A trusted platform for every team", "AI everywhere, increasingly autonomous", "Data: Powering trusted Insights & Outcomes", "Internal", then any other objective by name. Pickers and the OKR filter use this order, and a new OKR draft defaults to the first objective.

#### Scenario: A new OKR defaults to the core objective
- **WHEN** a user clicks "New OKR"
- **THEN** the draft's strategic objective is "A trusted platform for every team"

#### Scenario: Order does not depend on the database
- **WHEN** the database returns the objectives in a different order (for example after one of them was renamed)
- **THEN** the objective picker and the OKR filter still list them as core, AI, data, internal

## MODIFIED Requirements

### Requirement: OKR class
OKR class SHALL be optional and one of Committed, Conditional, Optional; unset shows as "Not classified". OKR class expresses the level of commitment. It is distinct from tier (T1/T2/T3, the go-to-market launch tier).

#### Scenario: Unclassified
- **WHEN** an OKR has no class
- **THEN** it shows "Not classified"

### Requirement: OKR tier
An OKR SHALL have an optional tier, T1, T2 or T3: the go-to-market launch tier of what it delivers — T1 Market-moving (high impact), T2 Capability (medium impact), T3 Enhancement (low impact). Tier is not the size of the work. It is shown next to and independent of its OKR class (commitment level). For a vault-managed OKR, tier comes from the vault.

#### Scenario: Tier and class together
- **WHEN** an OKR has tier T1 and class Committed
- **THEN** the drawer shows both, as separate fields
