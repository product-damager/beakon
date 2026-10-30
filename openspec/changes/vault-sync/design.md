# Design: vault-sync

See proposal.md for the motivation and for the PM's decisions D1–D7 (2026-10-30).

## Context

- **Vault sources:**
  - `04 Features/*.md` frontmatter: `type: feature`, `squad`, `area`, `status` (idea, discovery, spec, prototype, in-dev, shipped, parked), `interest`, `quarter`, `okr`, `owner`, `repo`.
    - `owner` is empty in 25 of 27 notes.
    - `quarter` is filled in 13.
    - No note has `tier` yet.
  - `../bu-dashboard/data/okr.json`: `squads[].commitments[]` with `key`, `text`, `governance`, `status`, `progress` and `deliverables`. There is no tier and no strategic objective yet.
- **Beakon, as of 2026-10-30:**
  - 18 production initiatives (5 on "Tech & Perso Builders", 13 with no team);
  - 8 Q3 2026 OKRs;
  - squads `team-finalize-rollout` and `team-assets-creation`.
- **Precedent:** bu-dashboard's refresh is run by the PM through Claude, with no server, scheduler or stored credentials.

## Field ownership

| Record | Field | Writer | Vault source |
|---|---|---|---|
| Initiative (synced) | title | vault | note file name |
| | team | vault | `squad` → `team-finalize-rollout` / `team-assets-creation` |
| | **status** | **vault** (D1) | `status`, mapped: idea → planned; discovery → opportunity_framing; spec, prototype → solution_framing; in-dev → in_development; shipped → released |
| | **archived** | **vault** (D1) | `parked` → archived; any other status → not archived; note removed from the vault → archived |
| | area | vault (new, read-only label) | `area` |
| | tier | vault (new) | `tier` |
| | owner | vault when `owner` is set; else Beakon | `owner` (matched by full name to an owner) |
| | target start/end | vault when `quarter` is set; else Beakon | `quarter` → first and last day of the quarter |
| | visibility | Beakon (the sync sets "internal" on create only) | — |
| | health, DIVE, links, dependencies, notes, theme, summary/problem/outcome, position | Beakon | — |
| OKR (synced commitment) | title | vault | commitment `text` |
| | team, year, quarter | vault | squad name, `okr.json` `quarter` |
| | deliverable detail | vault | `deliverables[].text`, joined with newlines |
| | strategic objective | vault | `strategic_objective` (D2): core / ai / data / internal → `so-core` / `so-ai` / `so-data` / `so-internal`; per-squad default when missing |
| | tier | vault (new) | `tier` |
| | governance, achievement, health, okrClass, notes, owners, initiative links | **Beakon** (live state, D1 + D3) | — |
| Org records | BU, team | vault (through migrations, for now) | `01 Context` |

Records without `source = 'vault'` keep today's behaviour: every field editable.

## Decisions

### Decision 1: identity by `source` + `source_key`; never delete
- **New columns on `initiatives` and `okrs`:**
  - `source` (`'vault'` or null);
  - `source_key` (the note file name without `.md`, or the commitment `key`);
  - a partial unique index on `(source, source_key)` where `source` is not null.
- **Upsert rules:**
  - the sync upserts on that key;
  - a D5 link adopts an existing row by setting `source` and `source_key` on it;
  - a key that disappears from the vault is archived and reported, never deleted.

### Decision 2: `vault_fields` lists, per row, exactly which columns the vault owns
- Some vault ownership is conditional (owner and dates only when set in the vault), so each synced row stores `vault_fields text[]`, e.g. `{title,team_id,status,archived,area,tier}` plus `owner_id` and `target_start,target_end` when the note sets them.
- **Database:** a `BEFORE UPDATE` trigger `guard_vault_definitions` on `initiatives` and `okrs` raises when `current_user = 'authenticated'` and any column named in `old.vault_fields` changes.
  - The sync runs as `postgres` through the Supabase tools, so it isn't blocked.
  - The trigger is SECURITY INVOKER with search_path pinned, and the API can't execute it.
- **UI:** a field listed in `vaultFields` renders read-only with "Managed in the vault". For initiatives where the vault owns `status`/`archived`:
  - the status pickers (drawer, list) are disabled;
  - Board cards can be reordered within their column but not dragged to another column;
  - Archive/Restore are hidden;
  - the timeline drag is blocked only when the vault owns the dates.

  The product-designer reviews the read-only states.
- **Why a per-row list, not a fixed column set:** one source of truth for both enforcement layers, and conditional ownership without special cases.

### Decision 3: the run is a script plus SQL applied through Claude, with no credentials
- **`scripts/vault-sync/vault_sync.py`**, Python standard library only:
  - **`build`** reads `04 Features` and `okr.json` plus a JSON dump of current rows, which Claude reads with SQL.
    - It validates the input (known squad, the 7 statuses, tier, `YYYY-Qn` quarter, strategic_objective, `beakon:` target exists, denylist).
    - It writes `out/vault-sync-<date>.sql`: idempotent upserts plus archive-on-missing, in one transaction.
    - It also writes `out/vault-sync-<date>.md`: creates, updates with field diffs, archives, skips and warnings.
  - **`write-back`** merges OKR live state into `okr.json` (D3), touching only `status`, `progress`, `health` and `governance` on synced commitments.
    - It refuses to run unless a backup in `02 OKR/backups/` is newer than the last write-back marker. `--backup` creates `okr.json.<timestamp>-before-vault-sync-writeback.bak`, following the folder's existing naming.
- **Why Python, not Node** (changed during apply): `okr.json` is written by Python's `json` module (indent 1, `ensure_ascii=False`, `75.0` kept as a float). Re-serializing it the same way is byte-exact, so a write-back diff shows only the values it owns. Node's `JSON.stringify` turns `75.0` into `75`.
- **Tests:** `python3 -m unittest discover -s scripts/vault-sync` (outside `npm run test`, which is vitest).
- **Gitignore:** generated files are gitignored (`scripts/vault-sync/out/`).

### Decision 4: additive schema
- `tier` is text, checked against (T1, T2, T3), and nullable. `area`, `source` and `source_key` are nullable text. `vault_fields` is `text[] not null default '{}'`.
- All of it is added with `add column if not exists`, and the trigger is replaced with `create or replace`. Mirrored in `schema.sql`.
- Anon gets no grant on the new columns. The "Anonymous access" section stays last, and the anon column grant on `initiatives` is unchanged.

### Decision 5: privacy
- Only frontmatter and note titles cross into Supabase; note bodies never do.
- A customer-name denylist in the script skips matching titles and reports them.

## Risks / Trade-offs

- **[Risk] A note is renamed**, so it looks like a new note plus an archived one. → The report flags likely renames (same squad, similar title) before the prod apply.
- **[Risk] Archived-by-parked hides an initiative** someone expected on the board. → That's intended (D1). It shows on the Archived page and comes back when the note leaves `parked`.
- **[Risk] Board, list or timeline paths not covered by the read-only UI.** → The database guard is the backstop; QA tries each path, plus a direct API update.
- **[Trade-off] No automatic schedule.** That matches the bu-dashboard precedent.

## Migration Plan

1. Schema migration: preview, checks, prod, checks, advisor.
2. Code (data layer, UI, scripts), then a PR, checks and review.
3. **STOP 1:** a dry-run report from the vault against production, shown to the PM.
4. After the PM's OK: apply the sync to preview, check, apply to prod, check.
5. **STOP 2:** back up `okr.json`, run the first write-back, and show the PM the diff.
6. Archive the change and merge.

**Rollback:** set `source = null` and `vault_fields = '{}'` to release records back to Beakon-only editing, and drop the trigger. The columns are nullable or defaulted.
