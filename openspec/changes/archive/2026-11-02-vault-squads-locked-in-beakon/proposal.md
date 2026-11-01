# Proposal

## Why

OKR definitions for "Finalize & Roll out" and "Assets Creation" come only from the vault ([2026-Q4 OKR](<../../../../../02 OKR/2026-Q4 OKR.md>), the squad notes [Finalize & Roll out](<../../../../../02 OKR/2026-Q4 OKR — Finalize & Roll out.md>) and [Assets Creation](<../../../../../02 OKR/2026-Q4 OKR — Assets Creation.md>), and `../bu-dashboard/data/okr.json`) through vault-sync. Beakon still lets anyone create a new OKR on those squads, or move a Beakon-only OKR onto them. Such an OKR has no vault key, so write-back and the BU dashboard never see it: it looks official in Beakon but sits outside the source of truth. Today there are none in preview or prod; this closes the gap before one appears.

## What Changes

- A team is **vault-managed** when it owns at least one vault-synced OKR (source = vault) in the immediately previous quarter, the current one or a later one, so the lock holds while next-quarter commitments are still pending after the OKR meetings. The rule is derived from data, never a hard-coded list of teams, and is documented in the specs.
- "New OKR": the team-or-business-unit picker hides vault-managed teams and shows a hint under the picker: "Assets Creation and Finalize & Roll out are managed in the vault — add the commitment to 02 OKR, then sync." (the hint names the teams that are currently vault-managed). The draft's default team is the first team that is not vault-managed.
- Existing Beakon-only OKRs: the team cannot be changed to a vault-managed team, with the same hint.
- Database: a signed-in user cannot create a Beakon-only OKR on a vault-managed team, or move one onto it. The vault sync (which runs with elevated rights, not as a signed-in user) is unaffected.
- **Out of scope**: initiatives. Beakon-only initiatives stay allowed on any team, including "Finalize & Roll out" and "Assets Creation". Business-unit OKRs (for example directly on "Configure & Launch") are also unaffected: only teams are locked. Editing a vault-managed OKR stays as it is (definitions read-only, live state editable).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `okr-tracking`: "Create an OKR" (default team skips vault-managed teams), "2027 Configure & Launch organisation" (the 2027 squads are no longer offered for new or moved OKRs while vault-managed), plus a new requirement for vault-managed teams in the picker and in the database.
- `vault-sync`: a new requirement defining which teams are vault-managed, derived from the synced OKRs, and stating that sync runs are not restricted by it.

## Field ownership

No new field. The team (squad) of an OKR on a vault-managed team is vault-owned: it is written only by the vault sync. Team stays Beakon-owned for Beakon-only OKRs on any other team and for initiatives. One writer per field holds.

## Anonymous access

Unchanged. Anonymous visitors and the public /share page cannot create or edit OKRs today, and this change adds nothing they can read.

## Impact

- Supabase: the existing vault guard on OKRs gains the vault-managed team check (`supabase/schema.sql`), applied to beakon-preview first, then beakon-prod after the PM's go. No new table, column, grant or RLS policy.
- UI: OKR drawer team-or-business-unit picker, "New OKR" draft defaults; works in seed mode and with Supabase.
- No new dependency.
