# Proposal: okr-order-by-key

## Why

On the OKR page, OKRs within a group are ordered by last update, newest first (`okr-tracking`, "OKR table columns and order"). Recording a check-in value moves the commitment to the top of its group, so the list reshuffles on every edit. The PM asked on 2026-10-30 for a stable order based on the id.

## What Changes

- Within each group on the OKR page, OKRs are ordered by:
  1. **vault-synced OKRs first, by commitment key in natural order:** `fr-1, fr-2 … fr-10`, never `fr-1, fr-10, fr-2`;
  2. **then Beakon-only OKRs** (no commitment key), by record id.
- Editing an OKR no longer changes its position. The "Updated" column stays as information.

## Capabilities

### Modified Capabilities
- `okr-tracking`: "OKR table columns and order" is replaced by "OKR table columns and stable order" (key/id order instead of recently edited first).

## Field ownership

No field changes.

## Out of scope

- User-chosen sorting on the OKR page.
- The archived-OKRs page, which keeps its sortable columns.
- Order of business units and teams, which stays alphabetical.

## Impact

`lib/okrGrouping.ts` (one sort function) and its tests. No schema, data or access change. No new UI surface.
