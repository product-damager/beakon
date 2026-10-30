# Proposal: org-2027-configure-launch

## Why

The 2027 org (vault `01 Context/Org — BUs and squads.md`, `01 Context/BU Configure & Launch.md`) puts Ivan's work in the business unit "Configure & Launch", with two squads: "Finalize & Roll out" and "Assets Creation". Beakon only has the 2026 org (4 BUs, 11 teams). Q4 2026 OKRs (`bu-dashboard/data/okr.json`) and the coming vault-sync need these squads to exist before anything can be assigned to them.

## What Changes

- **Add three org records, in all environments:**
  - business unit "Configure & Launch";
  - teams "Finalize & Roll out" and "Assets Creation" under it.
- **Data only:** no schema, no UI and no access change.
- **Existing data is not moved (PM decision, 2026-10-30):**
  - Q3 OKRs and initiatives stay on "Tech & Perso Builders", the squad's 2026 name, kept as history.
  - The 13 production initiatives without a team stay without one. vault-sync will assign squads from vault `04 Features` where a feature matches.
- **The rest of the 2026 org is untouched:** no rename, no deletion, no re-parenting.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `okr-tracking`: adds a requirement that the "Configure & Launch" BU and its two squads exist. It also states that the 2026 org stays alongside it as history.

## Field ownership

- Org records are definitions, owned by the vault (`01 Context`). Under the field-ownership rule they will be synced by vault-sync.
- Until then this change seeds them directly, as reference data. That is one writer (this migration), and Beakon's UI has no screen that edits teams or BUs.

## Out of scope

- The other 2027 BUs and squads (Admin, Build, Analyze, Lab…): leave the rest of the org data untouched.
- Moving or reassigning any existing OKR, initiative or owner.
- 2027 strategic objectives.
- Tier, KRs and the vault sync itself: vault-sync and measurable-krs.

## Impact

- `supabase/migrations/2026-10-org-2027-configure-launch.sql` (new, idempotent), `supabase/seed_prod.sql`, `supabase/seed.sql`, `lib/seed.ts`.
- Applied to beakon-preview, checked, then beakon-prod.
- In the UI, team pickers list the two new squads under "Configure & Launch". The OKR page shows the new BU group only once it has OKRs, because empty groups stay hidden.
- No anonymous-access change: anon has no access to teams or business units.
