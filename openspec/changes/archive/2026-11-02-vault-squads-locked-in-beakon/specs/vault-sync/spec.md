# Spec Delta

## ADDED Requirements

### Requirement: Vault-managed teams
A team SHALL be vault-managed when it owns at least one OKR created by a vault sync whose year and quarter are the immediately previous quarter, the current quarter or a later one, archived or not. The previous quarter counts so the lock holds after a quarter starts, until its commitments are synced. The set SHALL be derived from the OKRs in Beakon at the time of the check, never from a fixed list, and the app and the database SHALL apply the same rule. Sync runs SHALL NOT be restricted by it.

#### Scenario: Squads with synced commitments this quarter
- **WHEN** it is 2026-Q4 and "Finalize & Roll out" and "Assets Creation" each own synced 2026-Q4 OKRs
- **THEN** both are vault-managed, and no other team is

#### Scenario: New quarter before its commitments are synced
- **WHEN** it is 15 January 2027 (2027-Q1), the 2027-Q1 commitments have not been synced yet, and a team owns synced OKRs of 2026-Q4 only
- **THEN** that team is still vault-managed

#### Scenario: Synced OKRs two quarters back only
- **WHEN** it is 2027-Q2 and a team owns synced OKRs of 2026-Q4 only
- **THEN** that team is not vault-managed

#### Scenario: Previous quarter across the year boundary
- **WHEN** it is 2027-Q1
- **THEN** the immediately previous quarter is 2026-Q4

#### Scenario: Synced commitment for a later quarter
- **WHEN** it is 2026-Q4 and a sync creates 2027-Q1 OKRs for a team that had none before
- **THEN** that team is vault-managed from that moment

#### Scenario: New squad in the vault
- **WHEN** `okr.json` gains a third squad, its commitments are synced, and that squad's team is not in any list in Beakon's code
- **THEN** that team becomes vault-managed without a code change

#### Scenario: Sync creates on a vault-managed team
- **WHEN** a sync run creates or updates OKRs on "Finalize & Roll out" while it is vault-managed
- **THEN** the run succeeds as before
