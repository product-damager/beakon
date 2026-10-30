# Proposal: vault-sync-quarter-keys

## Why

vault-sync identified a synced OKR by its bare commitment key (`fr-1`, `ac-2` …). Those keys restart every quarter in `okr.json`. The first Q1 2027 sync would therefore have caused two failures:
- it would **overwrite** each Q4 2026 OKR with the Q1 commitment of the same key;
- its "archive what's gone from the vault" rule would **archive** every Q4 OKR whose key was missing from the new file.

Both would destroy Q4's history and live state. This was found after vault-sync merged (2026-10-30). Today only Q4 exists, so nothing is affected yet.

## What Changes

- **Quarter-scoped keys:** a synced OKR's key becomes `<quarter>/<key>`, e.g. `2026-Q4/fr-1`. New records get the id `okr-v-2026-q4-fr-1`.
- **Re-keying existing records:** the 16 existing records keep their ids, and the next sync re-keys them. A bare key from the same quarter is adopted, not duplicated. This only changes an internal column: nothing is deleted, and it can be reversed.
- **Scoped archiving:** archive-on-missing for OKRs only considers `okr.json`'s own quarter. Past quarters are history.
- **Write-back** matches commitments by quarter plus key.

## Capabilities

### Modified Capabilities
- `vault-sync`: "Stable identity and no deletion" (quarter-scoped OKR keys; past quarters never archived or changed).

## Field ownership

No change.

## Out of scope

- Initiative keys: feature note names don't restart per quarter.
- Changing the OKR page's order. Keys sort the same within a quarter, and later quarters come after earlier ones.

## Impact

- `scripts/vault-sync/vault_sync.py` and its tests.
- One sync run (preview → prod) to re-key the 16 Q4 OKRs, then a re-run that touches 0 rows.
- No schema, UI or access change.
