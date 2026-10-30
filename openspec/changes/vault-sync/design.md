# Design: vault-sync

See proposal.md for the motivation and for decisions D1–D7, which are marked ★ where a recommendation is assumed below.

## Context

- **Vault sources:**
  - `04 Features/*.md` frontmatter: `type: feature`, `squad`, `area`, `status`, `interest`, `quarter`, `okr`, `owner`, `repo`.
    - `owner` is empty in 25 of 27 notes.
    - `quarter` is filled in 13.
    - No note has `tier` yet.
  - `../bu-dashboard/data/okr.json`: `squads[].commitments[]` with `key`, `text`, `governance`, `status`, `progress` and `deliverables`. There is no tier and no strategic objective.
- **Beakon, as of 2026-10-30:**
  - 18 production initiatives (5 on "Tech & Perso Builders", 13 with no team);
  - 8 Q3 2026 OKRs;
  - the "Configure & Launch" squads exist under ids `team-finalize-rollout` and `team-assets-creation`.
- **Precedent:** bu-dashboard's refresh is run by the PM through Claude, with no server, scheduler or stored credentials. vault-sync follows the same model.

## Field ownership (D1: the table to approve)

| Record | Field | Writer | Vault source |
|---|---|---|---|
| Initiative (synced) | title | vault | note file name |
| | team | vault | `squad` → `team-finalize-rollout` / `team-assets-creation` |
| | owner | vault, when set; else Beakon | `owner` (matched to an owner by full name) |
| | area | vault (new, read-only label) | `area` |
| | tier | vault (new) | `tier` |
| | target quarter (start/end dates) | vault when `quarter` is set; else Beakon | `quarter` → first and last day of the quarter |
| | status | **Beakon** ★, written back to the note's `status` | — |
| | health, DIVE, links, dependencies, notes, theme, visibility, summary/problem/outcome | Beakon | — |
| OKR (synced commitment) | title | vault | commitment `text` |
| | team, year, quarter | vault | squad name, `okr.json` `quarter` |
| | deliverable detail | vault | `deliverables[].text`, joined |
| | strategic objective | vault | `objective` ★ (D2 default until filled) |
| | tier | vault (new) | `tier` |
| | governance, achievement, health, okrClass, notes, owners, initiative links | **Beakon** ★ | — |
| Org records | BU, team | vault (through migrations, for now) | `01 Context` |

Any record without `source = 'vault'` (all existing ones unless claimed, D5) keeps today's behaviour: every field is editable in Beakon.

## Decisions

### Decision 1: identity by `source` + `source_key`; never delete
- **New columns:** `initiatives.source` and `okrs.source` (`'vault'` or null), plus `source_key` (the note file name without `.md`, or the commitment `key`).
- **Unique index:** `(source, source_key)`, partial on `source is not null`.
- **Upsert rules:**
  - a sync upserts on that key;
  - D5 links set `source`/`source_key` on an existing row, adopting it;
  - a key that disappears from the vault leaves its record in place, `archived = true`, with a note in the run report.
- **Why:** file names and commitment keys are already stable in the vault, and a title match proved unreliable ("FF: Rollout Preview" vs "Rollout Preview").

### Decision 2: one-writer enforcement in the database plus the UI
- **Database:** a `BEFORE UPDATE` trigger `guard_vault_definitions` on `initiatives` and `okrs`.
  - When `old.source = 'vault'` and the caller is `authenticated`, it raises if any vault-owned column changes.
  - The sync runs as `postgres` through the Supabase tools, so it isn't blocked.
  - `persist_okr` and the initiative upsert keep working for live-state fields.
- **UI:** in both drawers, vault-owned fields render read-only with a "Managed in the vault" hint and a link to the note path, and live-state fields stay editable. The product-designer reviews the read-only state.
- **Why both:** the UI alone can be bypassed with the API, and the database alone gives users a confusing error.

### Decision 3: the run is a script plus SQL applied through Claude, with no credentials
- **`scripts/vault-sync/build-sql.mjs`** (Node, no dependencies):
  - reads `04 Features` and `okr.json` through relative vault paths;
  - validates them (known squad, tier in {T1, T2, T3, empty}, quarter format);
  - writes `vault-sync-<date>.sql`: idempotent upserts plus archive statements;
  - writes a human report: created / updated / archived / skipped, with reasons.
- **Applying it:** Claude applies the SQL to beakon-preview, checks it, then applies it to beakon-prod, using the Supabase tools, so nothing is stored.
- **`scripts/vault-sync/write-back.mjs`:** takes the live-state rows Claude reads with SQL (as JSON) and merges them into `okr.json` (D3 mapping) and into feature note `status` (D1). It only touches those keys, so the format and the other fields are preserved.
- **Generated files stay out of git.** They are gitignored, the vault itself is not a git repo, and `okr.json` lives in bu-dashboard, which is local.

### Decision 4: tier, area and the guard are additive schema
- `tier` is text, checked against (T1, T2, T3), and nullable. `area` is nullable text.
- `source` and `source_key` are nullable, with a partial unique index.
- All of it is added with `add column if not exists`, the guard trigger is replaced with `create or replace`, and it's mirrored in `schema.sql`.
- Anon gets no grant on the new columns. The "Anonymous access" section stays last.

### Decision 5: privacy
- Only frontmatter and note titles cross into Supabase; note bodies never do.
- The build step refuses titles that match a small denylist of customer-name patterns kept in the script. It lists them in the report and skips them.

## Risks / Trade-offs

- **[Risk] A frontmatter edit renames a note**, so its key changes and it becomes "new plus archived". → The report flags pairs that look like a rename (same squad, similar title) for the PM before the prod apply.
- **[Risk] Writing status back to vault notes collides with the PM editing them.** → write-back touches only the `status:` line, and only when it differs. The report lists every file it changed.
- **[Risk] The guard trigger blocks a legitimate correction in the UI.** → Correct it in the vault and re-run the sync. That's the intended single-writer flow.
- **[Trade-off] No automatic schedule.** That matches the bu-dashboard precedent; the run is part of the weekly or monthly OKR routine.

## Migration Plan

1. Schema migration: preview, checks, prod, checks, advisor.
2. A first sync in dry-run mode (report only), reviewed by the PM.
3. Apply to preview, checks, prod, checks.
4. A first write-back to `okr.json`, with a diff shown to the PM.

**Rollback:** the columns are nullable. Set `source = null` to release records back to Beakon-only editing, and drop the trigger.
