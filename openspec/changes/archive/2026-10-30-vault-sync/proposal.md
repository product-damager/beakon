# Proposal: vault-sync

> **Status: decisions taken by the PM on 2026-10-30, in progress.** Stop points: the first dry-run report, and the first `okr.json` diff.

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
   - Initiative status comes from the note's `status` (D1 mapping), and `parked` archives the initiative (reversibly).
   - Initiatives the sync creates start with visibility "internal".
   - Upserts are idempotent. A run never deletes; a definition removed from the vault is archived in Beakon.
2. **Live state of OKRs only, Supabase → `okr.json`**, at each bu-dashboard refresh. Each commitment gets Beakon's current status, % done, health and governance (D3).
   - Initiatives get no write-back: the vault owns their status (D1).
   - Before the first write-back, `okr.json` is backed up to the vault's `02 OKR/backups/`.
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

## Decisions (PM, 2026-10-30)

- **D1. The vault owns initiative status.** It is one-way and read-only in Beakon.
  - Ivan updates status in Obsidian. The vault has 7 values and Beakon 5, so a write-back would lose information.
  - Mapping: `idea` → Backlog; `discovery` → Opportunity Framing; `spec`, `prototype` → Solution Framing; `in-dev` → In Development; `shipped` → Released; `parked` → archived (reversible: leaving `parked` restores the initiative).
  - "Beakon owns live state" applies to OKRs only: status, %, health, governance, check-ins.
- **D2. A per-commitment `strategic_objective: core | ai | data | internal`** in `okr.json`, named so it doesn't clash with `objectives[]`, which is the measurable layer.
  - Defaults until it's filled: "Core: Strengthening our foundations" for Finalize & Roll out; "AI: Scaling PBX adoption" for Assets Creation.
- **D3. OKR live state written back as recommended:**
  - `progress` = achievement %;
  - `status` derived: `done` at 100%, `dropped` if Rejected, `in_progress` above 0, otherwise `not_started`;
  - a new `health` field;
  - `governance` from Beakon.
- **D4.** `area` becomes a read-only label on synced initiatives. Theme stays Beakon's.
- **D5.** Claude adds a `beakon:` link to "Rollout Preview" (→ "FF: Rollout Preview").
  - The "Experiment Rules for Personalization" → "Perso Experimentation Rule" link was dropped after the first dry run, so the released Q3 initiative stays as history.
  - Other notes create new initiatives, and unclaimed initiatives stay untouched.
  - "Autopromo" is a product term (personalization type 100) and is allowlisted in the privacy check.
- **D6.** Done by the PM: no production initiative title names a customer (checked 2026-10-30).
- **D7.** Notes with squad "other" are skipped.
- **Also:** initiatives created by the sync are internal, and `okr.json` is backed up before the first write-back.

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
- **Vault:** one-time `beakon:` lines in 2 notes (D5); `okr.json` gets live-state fields only, after a backup. Feature notes are never written by a sync run.
- **Anonymous access:** no change. New columns get no anon grant, and `/share`'s projection is unchanged.
