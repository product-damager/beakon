# Design: vault-sync-quarter-keys

Extends the archived change `2026-10-30-vault-sync` (design Decision 1, "identity by `source` + `source_key`"). See proposal.md for the problem.

## Decisions

### Decision 1: the OKR key is `<quarter>/<key>` in `source_key`, not a match on year + quarter + key
- **Why:** one opaque, unique string keeps everything that already relies on `(source, source_key)` working unchanged.
  - The partial unique index;
  - the set-based SQL's staging table and its `is distinct from` checks;
  - archive-on-missing;
  - the write-back's lookup;
  - the OKR page's key sort: `2026-Q4/fr-2` < `2026-Q4/fr-10` < `2027-Q1/fr-1`.
- **Alternative rejected:** a composite match on `year`, `quarter` and `source_key`. It would need a new unique index and changes to every one of those places, for the same guarantee.

### Decision 2: existing records are adopted at sync time, not migrated with a separate file
- The build adopts a bare key belonging to the same quarter, or with no quarter. It keeps the record's id and rewrites `source_key`.
- **Why:** the sync is already the only writer of vault metadata, and the guard refuses that change from the app. A one-off migration file would be a second writer to keep in step, while adoption covers the same case on any environment that still has bare keys.
- A bare key from a **different** quarter is never adopted. That's the overwrite this change prevents.

### Decision 3: past quarters are history
- Archive-on-missing only considers OKRs of `okr.json`'s own quarter, and records the plan adopts or re-keys never count as missing.
- The write-back only matches `<okr.json quarter>/<key>`. There's no bare-key fallback, which would let a stale live list carry one quarter's state into another (dev-lead review).

### Decision 4: the re-key on preview and prod was applied as an equivalent single statement
- **What ran:** `update okrs set source_key = '2026-Q4/' || source_key where source = 'vault' and year = 2026 and quarter = 4 and position('/' in source_key) = 0`, instead of re-sending the 19 KB generated SQL.
- **Equivalence was proven three ways:**
  1. the dry run against prod showed the generated SQL's only effect was those 16 `source_key` changes (0 creates, 0 other updates, 0 archives);
  2. a build against the state after the statement reports 0 creates, 0 updates, 0 archives;
  3. the write-back with quarter keys left `okr.json` byte-identical (same md5).
- Ids, achievements, governance, health, titles and archive state were checked unchanged on both projects.

## Risks / Trade-offs

- **[Risk] Someone runs the old script version** (bare keys) after this ships. → It would treat the re-keyed rows as gone and archive the Q4 OKRs. Mitigation: the script is versioned in the repo, the runbook documents the key format, and an archive is reversible (set `archived = false`).
