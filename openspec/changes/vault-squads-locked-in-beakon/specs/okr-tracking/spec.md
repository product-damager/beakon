# Spec Delta

## MODIFIED Requirements

### Requirement: Create an OKR
Users SHALL create OKRs from a "New OKR" button, which opens a draft with Create OKR. Title, strategic objective and exactly one team or business unit are required. Draft defaults: current year and quarter, the first team that is not vault-managed (see vault-sync), or no team when every team is vault-managed, the first strategic objective, governance Draft, health On track, achievement not assessed (inferred defaults). Closing a changed draft asks "Discard this OKR?".

#### Scenario: Missing objective
- **WHEN** a draft has no strategic objective
- **THEN** "Create OKR" is disabled and the drawer says "Choose a strategic objective."

#### Scenario: Created
- **WHEN** a valid draft is created
- **THEN** the toast "OKR created" appears

#### Scenario: First team is vault-managed
- **WHEN** a user clicks "New OKR" and the first team in the team order is vault-managed
- **THEN** the draft's team is the next team in that order that is not vault-managed

#### Scenario: Every team is vault-managed
- **WHEN** a user clicks "New OKR" and no team is left that is not vault-managed
- **THEN** the draft has no team, "Create OKR" stays disabled until a business unit is picked, and the hint about vault-managed teams is shown under the picker

### Requirement: 2027 Configure & Launch organisation
The business unit "Configure & Launch" SHALL exist, with its two squads as teams: "Finalize & Roll out" and "Assets Creation". They SHALL be selectable wherever a team or business unit is picked, in every environment (seed mode, beakon-preview, beakon-prod), except that a squad that is vault-managed is not offered for a new or moved Beakon-only OKR (see "Vault-managed teams are closed to Beakon-only OKRs").

#### Scenario: Pick a 2027 squad for an OKR
- **WHEN** a user opens the team-or-business-unit picker on an OKR and neither squad is vault-managed
- **THEN** "Finalize & Roll out" and "Assets Creation" are listed under "Configure & Launch", and "Configure & Launch" can be picked as a business unit

#### Scenario: Business unit stays pickable while its squads are vault-managed
- **WHEN** both squads are vault-managed and a user opens the team-or-business-unit picker on a Beakon-only OKR
- **THEN** neither squad is listed, and "Configure & Launch" can still be picked as a business unit

#### Scenario: Pick a 2027 squad for an initiative
- **WHEN** a user opens the team picker on an initiative
- **THEN** "Finalize & Roll out" and "Assets Creation" are listed under "Configure & Launch", whether or not they are vault-managed

## ADDED Requirements

### Requirement: Vault-managed teams are closed to Beakon-only OKRs
A Beakon-only OKR (one not created by a vault sync) SHALL NOT be created on, or moved to, a vault-managed team. The team-or-business-unit picker of a new or Beakon-only OKR SHALL hide vault-managed teams and show under the picker: "<teams> are managed in the vault — add the commitment to 02 OKR, then sync." naming the vault-managed teams alphabetically ("is" for one team). The database SHALL refuse such a create or move from signed-in users.

#### Scenario: New OKR picker
- **WHEN** "Finalize & Roll out" and "Assets Creation" are vault-managed and a user opens the picker on a "New OKR" draft
- **THEN** neither squad is listed, and the picker shows "Assets Creation and Finalize & Roll out are managed in the vault — add the commitment to 02 OKR, then sync."

#### Scenario: Move a Beakon-only OKR
- **WHEN** a user opens the picker on an existing Beakon-only OKR of another team while "Assets Creation" is vault-managed
- **THEN** "Assets Creation" is not listed, and the same hint is shown

#### Scenario: Create sent directly to the database
- **WHEN** a signed-in user sends a new OKR on "Finalize & Roll out" to the database while that squad is vault-managed
- **THEN** the database refuses it and no OKR is created

#### Scenario: Move sent directly to the database
- **WHEN** a signed-in user sends an update moving a Beakon-only OKR onto "Assets Creation" while that squad is vault-managed
- **THEN** the database refuses it and the OKR keeps its team

#### Scenario: Live state on a vault-managed OKR still saves
- **WHEN** a signed-in user sets achievement to 40% on a vault-synced OKR of "Finalize & Roll out"
- **THEN** it is saved

#### Scenario: Beakon-only OKR already on the team before it became vault-managed
- **WHEN** a Beakon-only OKR was on a team before that team became vault-managed and a user edits its achievement or moves it to another team
- **THEN** the change is saved; only moving an OKR onto a vault-managed team is refused

#### Scenario: Initiatives unaffected
- **WHEN** a user creates a Beakon-only initiative on "Assets Creation" while it is vault-managed
- **THEN** the initiative is created
