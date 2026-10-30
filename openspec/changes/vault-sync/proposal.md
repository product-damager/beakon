# Proposal: vault-sync

> **Status: proposed. Waiting for PM review before apply** (PM rule, 2026-10-30). The decisions in "Decisions for the PM" below need an answer first.

## Why

`openspec/config.yaml` sets one writer per field:
- **The vault** owns definitions:
  - feature notes in `04 Features` (27 notes: 14 "Finalize & Roll out", 12 "Assets Creation", 1 "other");
  - Q4 commitments in `../bu-dashboard/data/okr.json` (7 for "Finalize & Roll out" and 9 for "Assets Creation", mirrored from `02 OKR`).
- **Beakon** owns live state: status, % done, health and check-ins.

Today nothing connects the two:
- Beakon has no Q4 commitments at all; it only has the 8 Q3 2026 OKRs on "Tech & Perso Builders".
- Its 18 production initiatives were typed by hand. 13 of them have no squad, and only a few of them match a feature note.
- `okr.json`'s commitment status is still maintained by hand.

vault-sync makes the vault the single source for definitions. Beakon then holds the live state, and `okr.json` stays a full copy of both.

Links: vault `01 Context/BU Configure & Launch.md`, `02 OKR/2026-Q4 OKR.md`, `04 Features/`, `../bu-dashboard/openspec/specs/dashboard/data-refresh` ("OKR live values synced at refresh").

## What Changes

1. **Definitions, vault → Supabase** (a run, triggered by the PM through Claude):
   - every feature note with a known squad becomes an initiative;
   - every `okr.json` commitment becomes an OKR (Beakon's "OKR" = a delivery commitment).
   - Records are matched on a stable key: the feature note's file name, and the commitment's `key` (e.g. `fr-1`).
   - Upserts are idempotent. A run never deletes; a definition removed from the vault is archived in Beakon.
2. **Live state, Supabase → `okr.json`**, at each bu-dashboard refresh. Each commitment gets Beakon's current status, % done, health and governance (see D3).
3. **Read-only in the UI:** on a vault-managed record, the definition fields can't be edited in Beakon.
   - The drawer shows them as read-only, marked "Managed in the vault".
   - The database rejects edits to them by signed-in users.
   - Live-state fields stay editable.
4. **New `tier` field (T1 / T2 / T3, the size of the work)** on initiatives and OKRs.
   - It is a vault-owned definition: `tier:` in feature frontmatter, and `tier` on `okr.json` commitments.
   - It is shown in the drawer and the list.
   - `okrClass` (commitment level) stays as it is, next to tier.
5. **Linking existing initiatives:**
   - A feature note can name the existing Beakon initiative it describes (`beakon: <id>` in its frontmatter). The sync then adopts that record instead of creating a duplicate.
   - Initiatives no feature note claims stay Beakon-only and fully editable. That includes the 13 team-less ones, unless a note claims them.

## Capabilities

### New Capabilities
- `vault-sync`: how definitions flow from the vault into Supabase and how live state flows back to `okr.json`. It covers keys, idempotency, no-delete, privacy and how a run is triggered.

### Modified Capabilities
- `initiatives`: adds tier; vault-managed initiatives get read-only definition fields.
- `okr-tracking`: adds tier and the commitment key; vault-managed OKRs get read-only definition fields.

## Decisions for the PM

Each has a recommendation, marked ★.

- **D1. Field ownership table** (design.md, "Field ownership"). Approve it or edit it.
  - The main open point is **initiative status**. config.yaml says Beakon owns status, but feature notes also carry `status` (idea → shipped), which your Bases views use.
  - ★ Beakon owns status, and the sync writes it back to the note's frontmatter as `status`, so Bases keeps working with one writer.
  - Alternative: feature status stays vault-owned and Beakon status becomes read-only for synced initiatives.
- **D2. Strategic objective for Q4 commitments.** Beakon requires one per OKR; `okr.json` has none.
  - ★ Add `objective: core | ai | data | internal` per commitment in `okr.json`.
  - Until it's filled, default to "AI: Scaling PBX adoption" for Assets Creation and "Core: Strengthening our foundations" for Finalize & Roll out.
- **D3. Live state written back to `okr.json`.**
  - ★ `progress` = achievement %.
  - ★ `status` = `done` at 100%; `dropped` if governance is Rejected; `in_progress` if achievement is above 0; otherwise `not_started`.
  - ★ New `health` field; `governance` comes from Beakon.
  - This makes governance Beakon-owned live state: validation happens in the OKR meetings and is recorded in Beakon.
- **D4. Feature `area` versus Beakon `theme`.**
  - ★ Don't map them. Theme stays Beakon-owned, for presentation grouping and the /share labels.
  - `area` is stored as a read-only label on synced initiatives.
- **D5. Links to existing initiatives.**
  - ★ I add `beakon:` lines to the matching feature notes, and you confirm the list:
    - "Rollout Preview" ↔ "FF: Rollout Preview";
    - "Experiment Rules for Personalization" ↔ "Perso Experimentation Rule";
    - the rest create new initiatives.
  - Alternative: you add the lines yourself.
- **D6. A production initiative title names a customer** ("BPCE Legacy read-only"). That breaks the privacy rule.
  - ★ Rename it to "Legacy read-only migration (bank customer)", or a title you choose.
  - Out of scope for the sync, but this changes real data, so it needs your OK.
- **D7. Feature notes with squad "other"** (1 note). ★ Skip them; the scope is "Configure & Launch" only.

## Out of scope

- The KR / objective layer of `okr.json` (metrics, baselines, targets): that's measurable-krs.
- Syncing anything outside "Configure & Launch", and syncing note bodies. Only frontmatter and the note's title are read.
- Automatic or scheduled runs. A run is always triggered by the PM through Claude, with no server and no stored credentials.

## Impact

- **Schema:**
  - `initiatives` and `okrs` gain `tier`, `source`, `source_key` and `area` (initiatives only);
  - a trigger guards the definition columns;
  - an idempotent migration, preview then prod.
- **App:**
  - read-only definition fields and a "Managed in the vault" hint in both drawers;
  - tier in the drawers and lists.
  - This is a UI surface change, so it needs a product-designer pass.
- **Tooling:** `scripts/vault-sync/`, run through Claude:
  - one step reads the vault and `okr.json` and produces SQL, applied with the Supabase tools;
  - one step reads live state and writes `okr.json`.
- **Vault:** frontmatter writes, limited to `status` (D1) and `beakon:` (D5); `okr.json` writes live-state fields only.
- **Anonymous access:** no change. New columns get no anon grant, and `/share`'s projection is unchanged.
