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

### Requirement: 2026 organisation kept as history
The 2026 business units and teams SHALL stay as they are, and the OKRs, initiatives and owners recorded on them SHALL NOT be moved when the 2027 organisation is added. In particular, Q3 2026 work stays on "Tech & Perso Builders" (the 2026 name of the squad now called "Finalize & Roll out"), and initiatives without a team stay without one until vault-sync assigns them.

#### Scenario: Existing OKR after the 2027 org is added
- **WHEN** an OKR recorded on "Tech & Perso Builders" is opened after this change
- **THEN** it still belongs to "Tech & Perso Builders"

#### Scenario: Team-less initiative
- **WHEN** an initiative had no team before this change
- **THEN** it still has none afterwards
