# Spec Delta: okr-tracking

## ADDED Requirements

### Requirement: 2027 Configure & Launch organisation
The business unit "Configure & Launch" SHALL exist, with its two squads as teams: "Finalize & Roll out" and "Assets Creation". They SHALL be selectable wherever a team or business unit is picked, in every environment (seed mode, beakon-preview, beakon-prod).

#### Scenario: Pick a 2027 squad for an OKR
- **WHEN** a user opens the team-or-business-unit picker on an OKR
- **THEN** "Finalize & Roll out" and "Assets Creation" are listed under "Configure & Launch", and "Configure & Launch" can be picked as a business unit

#### Scenario: Pick a 2027 squad for an initiative
- **WHEN** a user opens the team picker on an initiative
- **THEN** "Finalize & Roll out" and "Assets Creation" are listed under "Configure & Launch"

### Requirement: Earlier org records kept alongside new ones
Business units and teams from an earlier organisation SHALL stay as records alongside newer ones, so work recorded on them keeps its history. Adding business units or teams SHALL NOT by itself reassign any existing OKR, initiative or owner; reassignment happens only through an explicit edit or sync.

#### Scenario: OKR on an earlier team after new org records are added
- **WHEN** new business units or teams are added and an OKR recorded on an earlier team (e.g. "Tech & Perso Builders") is opened
- **THEN** it still belongs to that team

#### Scenario: Team-less initiative after new org records are added
- **WHEN** new business units or teams are added and an initiative had no team before
- **THEN** it still has none until someone, or a sync, assigns one
