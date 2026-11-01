# Proposal

## Why

Two labels in Beakon no longer match the company's own vocabulary:

- The strategic objectives still carry their old names ("Core: Strengthening our foundations", "AI: Scaling PBX adoption"). The company OKR sheet, and the vault's quarter notes that follow it (`02 OKR/2026-Q4 OKR — Finalize & Roll out.md`, `02 OKR/2026-Q4 OKR — Assets Creation.md`), now use "A trusted platform for every team" and "AI everywhere, increasingly autonomous". Readers of the OKR page see one name in Beakon and another in the sheet.
- The project context and the specs define tier (T1/T2/T3) as "the size of the work". It is the go-to-market launch tier, the same "Tier 1/2/3" the vault OKR notes use: T1 Market-moving (high impact), T2 Capability (medium), T3 Enhancement (low). Wrong wording here will mislead whoever next designs a feature on tier (e.g. reading T1 as "biggest effort").

## What Changes

- Rename two strategic objective display names:
  - `so-core`: "Core: Strengthening our foundations" → "A trusted platform for every team"
  - `so-ai`: "AI: Scaling PBX adoption" → "AI everywhere, increasingly autonomous"
  - `so-data` ("Data: Powering trusted Insights & Outcomes") and `so-internal` ("Internal") are unchanged.
  - Ids, every OKR and initiative link to them, the vault-sync codes (`core`, `ai`) and the short list-column aliases ("Core", "AI") stay as they are.
  - Delivered as an idempotent data migration (update by id) applied to beakon-preview, then beakon-prod, and mirrored in the seed data used for preview and for seed mode.
- Redefine tier in wording only: T1/T2/T3 is the go-to-market launch tier — T1 Market-moving (high impact), T2 Capability (medium), T3 Enhancement (low) — not the size of the work. Tier values, who owns tier, where it is shown and the database checks are unchanged. Fixed in `openspec/config.yaml`, the okr-tracking and initiatives specs, and the code comments that repeat the old definition.
  - The initiatives spec is included in addition to the two specs named in the request, because it carries the same "size of the work" definition.
  - Also drops the stale "which Beakon does not have yet" note about tier in okr-tracking (OKR tier exists since vault-sync).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `okr-tracking`: new requirement pinning the 2026 strategic objective names (and that a rename keeps links); OKR class and OKR tier requirements describe tier as the go-to-market launch tier.
- `initiatives`: Tier requirement describes tier as the go-to-market launch tier.
- `vault-sync`: default strategic objectives for synced commitments are named with the new display names. (The vault-sync spec mentions tier only as a vault-owned field and never defines it as size, so it needs no tier wording change.)

## Field ownership

- Strategic objective name: a company-wide reference record, written only by seed/migration SQL (no UI edits it, no sync writes it). Still one writer. The vault does not sync objective names; vault-sync only maps codes to ids.
- Tier: unchanged — vault-owned definition, read-only in Beakon. Only its description changes.

## Anonymous access

The public /share page and anonymous reads are not changed by this change: no RLS, grant or query changes. Any place an anonymous reader already sees an objective name will show the new name.

## Out of scope

- Renaming ids (`so-core`, `so-ai`) or vault-sync codes (`core`, `ai`).
- Renaming `so-data` / `so-internal`, adding 2027 objectives, or changing objective years/descriptions/sponsors.
- Changing the short column aliases ("Core", "AI") on the OKR list.
- Any change to tier values, tier display, or a new tier-related feature (e.g. tier labels like "Market-moving" in the UI).
- Vault notes and `../bu-dashboard/data/okr.json` (they already use the new names and "Tier n").

## Impact

- Data: `strategic_objectives.name` for two rows on beakon-preview and beakon-prod (new one-off file in `supabase/migrations/`).
- Seeds: `supabase/seed.sql`, `supabase/seed_prod.sql`, `lib/seed.ts`.
- Docs/specs: `openspec/config.yaml`, `openspec/specs/{okr-tracking,initiatives,vault-sync}/spec.md` (via this change's deltas).
- Code comments only: `lib/types.ts`, `components/ui.tsx`, `components/OkrDrawer.tsx`.
- No schema, RLS, grant, function or dependency change.
