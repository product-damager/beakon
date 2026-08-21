-- One-off, reviewed data-backfill — NOT part of schema.sql.
--
-- Why this isn't in schema.sql: it's a one-time data operation (populate
-- newly-added FK columns from existing legacy text values), not a repeatable
-- schema statement. Run manually per supabase/README.md's "apply a schema
-- change" workflow, after the additive columns from schema.sql's Sprint
-- Heron Week 1 section (`initiatives.team_id`, `initiatives.strategic_
-- objective_id`, `owners.team_id`) already exist in the target project.
--
-- See docs/decisions/006-unify-initiative-team-defer-strategic-goal.md and
-- docs/decisions/007-heron-week-1-data-model-and-drawer-conventions.md for
-- the full reasoning behind every mapping below.
--
-- ══════════════════════════════════════════════════════════════════════
-- Part A0 — external_roadmap view column rename, BOTH environments,
-- REQUIRED before schema.sql's `create or replace view external_roadmap`
-- statement will succeed against a database that already has the view.
-- ══════════════════════════════════════════════════════════════════════
-- `create or replace view` can only change a column's underlying
-- expression if the column NAME and POSITION stay the same — it cannot
-- rename or reorder an existing output column (Postgres error 42P16).
-- The live view's 6th column is named `team`; schema.sql's Heron Week 1
-- definition wants that same slot named `team_id`. Discovered when this
-- was first run against `beakon-preview` — a fresh from-scratch install
-- never hits this (the view doesn't exist yet, so there's nothing to
-- rename), which is why `supabase/README.md`'s documented preview
-- workflow — drop-and-rebuild from schema.sql — never surfaced it. Prod
-- is always applied incrementally (never dropped), so this step is
-- mandatory there regardless of how preview was tested.
--
-- ── Incident history (3 failed rollout attempts against beakon-preview) ──
-- 1. Ran all 4 additive `alter table` statements + the unguarded
--    `create or replace view` (selecting `i.team_id`) + `grant`, pasted as
--    one script → 42P16 (`cannot change name of view column "team" to
--    "team_id"`), because `create or replace view` cannot rename an
--    existing output column.
-- 2. Ran a 3-statement fix (`alter view ... rename column`, then the same
--    `create or replace view`, then `grant`) WITHOUT re-running the table
--    alters, assuming attempt 1 had partially committed → failed with
--    `column i.team_id does not exist`, proving attempt 1's `alter table`
--    statements had NOT persisted (`initiatives.team_id` didn't exist yet).
-- 3. Re-ran the FULL combined script from scratch (on the theory that
--    attempt 1 rolled back atomically, so a clean full re-run would work)
--    → failed with `column "team" does not exist` on the rename statement
--    itself, which only happens if the view's column was ALREADY named
--    `team_id` — i.e. attempt 2's `alter view ... rename column` HAD
--    persisted, despite the very next statement in that same paste
--    (`create or replace view`) failing.
--
-- Root cause: attempts 1 and 2 are only mutually consistent if the
-- statements within a single pasted script are NOT always executed (or
-- rolled back) as one all-or-nothing unit — e.g. because the SQL editor
-- was used to run a subset/selection of the pasted lines rather than the
-- entire block in one motion (both the Supabase dashboard editor and
-- `psql` support running a highlighted selection or splitting a paste into
-- separate round trips), so a `rename column` that "looked done" from one
-- execution was already committed by the time a later, separately-run
-- statement referencing it failed. We cannot verify this against the live
-- database in this session (no credentials) — the diagnostic query below
-- exists precisely so nobody has to trust this inference (or any other)
-- again. Whatever the exact mechanism, the fix below is safe from ANY of
-- the three partial states above, or a from-scratch state, without
-- needing to know which one you're in.
--
-- ⚠ Multi-statement pastes into the dashboard SQL editor are NOT
-- guaranteed atomic across every statement, contrary to what you'd expect
-- from Postgres's simple-query-protocol semantics (which do wrap a single
-- un-split multi-statement string in one implicit transaction). Don't rely
-- on that guarantee. The fix script below wraps everything in its own
-- explicit `begin; ... commit;`, and rely on running it as ONE single
-- paste/execution (not line-by-line, not "run selection") so the explicit
-- transaction boundary is what determines atomicity, not editor behavior.
--
-- ── Step 1: run this diagnostic query FIRST, before touching anything ──
-- Reports the actual state directly (no inference from error messages):
--
--   select
--     exists (
--       select 1 from information_schema.columns
--       where table_schema = 'public' and table_name = 'initiatives'
--         and column_name = 'team_id'
--     ) as initiatives_team_id_exists,
--     exists (
--       select 1 from information_schema.columns
--       where table_schema = 'public' and table_name = 'initiatives'
--         and column_name = 'strategic_objective_id'
--     ) as initiatives_strategic_objective_id_exists,
--     exists (
--       select 1 from information_schema.columns
--       where table_schema = 'public' and table_name = 'owners'
--         and column_name = 'team_id'
--     ) as owners_team_id_exists,
--     (
--       select is_nullable from information_schema.columns
--       where table_schema = 'public' and table_name = 'initiatives'
--         and column_name = 'team'
--     ) as initiatives_team_is_nullable,
--     (
--       select string_agg(column_name, ', ' order by ordinal_position)
--       from information_schema.columns
--       where table_schema = 'public' and table_name = 'external_roadmap'
--     ) as external_roadmap_columns_in_order,
--     (
--       select pg_get_viewdef('public.external_roadmap'::regclass, true)
--       where exists (
--         select 1 from information_schema.views
--         where table_schema = 'public' and table_name = 'external_roadmap'
--       )
--     ) as external_roadmap_definition;
--
-- The last column (`pg_get_viewdef`) is the definitive check: it shows the
-- view's actual underlying query text, settling — without any inference —
-- whether the view already selects `i.team_id` (fully done) or still
-- selects `i.team` (not done), regardless of what its column is *labeled*.
--
-- ── Step 2: the fix, safe to paste and run in ONE execution from ANY of
-- the states above (fresh install, or any of the 3 partial-failure states) ──
--
--   begin;
--
--   -- Additive columns: already idempotent (`add column if not exists`,
--   -- and loosening `not null` never fails), safe to re-run unconditionally.
--   alter table initiatives add column if not exists team_id text references teams (id);
--   alter table initiatives alter column team drop not null;
--   alter table initiatives add column if not exists strategic_objective_id text
--     references strategic_objectives (id);
--   alter table owners add column if not exists team_id text references teams (id);
--
--   -- Conditionally rename the view's column — only if the view exists,
--   -- still has a column named `team`, AND doesn't already have one named
--   -- `team_id`. Covers "never renamed" (renames it), "already renamed"
--   -- (skips — the exists/not-exists pair is what makes this safe to
--   -- re-run, unlike a bare rename which errors the 2nd time), and "view
--   -- doesn't exist yet" (skips; `information_schema.columns` simply has
--   -- no matching rows, so both `exists` checks are false and nothing
--   -- runs). information_schema.columns is the right catalog here — it
--   -- lists view columns exactly like table columns; no need for
--   -- pg_attribute.
--   do $$
--   begin
--     if exists (
--       select 1 from information_schema.columns
--       where table_schema = 'public' and table_name = 'external_roadmap'
--         and column_name = 'team'
--     ) and not exists (
--       select 1 from information_schema.columns
--       where table_schema = 'public' and table_name = 'external_roadmap'
--         and column_name = 'team_id'
--     ) then
--       alter view external_roadmap rename column team to team_id;
--     end if;
--   end $$;
--
--   -- Redefine the view. Safe to re-run unconditionally now: the column
--   -- slot is guaranteed to already be named `team_id` (or the view is
--   -- being created fresh), so `create or replace view` never hits 42P16
--   -- here regardless of which prior state we started from.
--   create or replace view external_roadmap as
--   select
--     i.id, i.title, i.summary, i.expected_outcome, i.status,
--     i.team_id, i.theme_id, i.target_start, i.target_end, i.position
--   from initiatives i
--   where i.visibility = 'external' and i.archived = false
--   order by i.position;
--
--   -- Idempotent: granting an already-held privilege is a no-op, not an error.
--   grant select on external_roadmap to anon, authenticated;
--
--   commit;
--
-- (No data changes anywhere in this step — only column labels/definitions
-- and additive nullable columns. `initiatives.team`/`owners.team` are
-- untouched and still populated; Part A below is what backfills the new
-- `team_id` columns from them.)
--
-- ── Known gap, flagged for dev-lead — RESOLVED (2026-08-21, dev-lead review) ──
-- `schema.sql`'s own Sprint Heron Week 1 section had the bare, unguarded
-- `create or replace view external_roadmap` statement with no conditional
-- rename in front of it, which would have hit this same 42P16 the next time
-- schema.sql was applied wholesale to beakon-prod (still on the pre-Heron
-- view). Fixed: the identical guarded `do $$ ... end $$` rename block above
-- now lives directly in schema.sql, immediately before its
-- `create or replace view external_roadmap` statement, so schema.sql is
-- self-contained and doesn't depend on a human running this file's
-- instructions in the right order first. See supabase/README.md's golden
-- rule section for why a guarded, existence-checked rename is the one case
-- where a column rename is safe to fold directly into schema.sql.
--
-- This does NOT change the instructions below for beakon-preview's current
-- broken state: the immediate recovery still needs Part A0's small,
-- explicit-`begin`/`commit`-wrapped fix script, not a full re-paste of
-- schema.sql (a much larger multi-statement paste, with no transaction
-- wrapper of its own, is more exposed to the same "run selection" risk this
-- incident was caused by — not less). The schema.sql fix matters for the
-- *next* environment this is applied to fresh or incrementally (chiefly
-- beakon-prod), not as a substitute for the targeted fix here.

-- ══════════════════════════════════════════════════════════════════════
-- Part A — team_id backfill (initiatives + owners), BOTH environments
-- ══════════════════════════════════════════════════════════════════════
-- Exact name match against the guaranteed 3-value legacy `team`/`TEAMS` set
-- — the picker has always been closed to exactly these 3 strings (ADR 006),
-- so this is a lossless rename, not a guess. Safe to re-run: only touches
-- rows where team_id is currently null and the legacy text matches.

update initiatives set team_id = 'team-app-system'
  where team_id is null and team = 'App System';
update initiatives set team_id = 'team-visual-builders'
  where team_id is null and team = 'Visual Builders';
update initiatives set team_id = 'team-tech-perso-builders'
  where team_id is null and team = 'Tech & Perso Builders';

update owners set team_id = 'team-app-system'
  where team_id is null and team = 'App System';
update owners set team_id = 'team-visual-builders'
  where team_id is null and team = 'Visual Builders';
update owners set team_id = 'team-tech-perso-builders'
  where team_id is null and team = 'Tech & Perso Builders';

-- Sanity check after running Part A on either environment — should return
-- zero rows (every non-null legacy `team` value is one of the 3 known
-- strings, per ADR 006's verified audit). If this returns rows, STOP and
-- investigate before proceeding to Part B — it means a `team` value exists
-- that isn't one of the 3 mapped strings above, and team_id would be wrong
-- or incomplete for those rows.
--   select id, team from initiatives where team is not null and team_id is null;
--   select id, team from owners where team is not null and team_id is null;

-- ══════════════════════════════════════════════════════════════════════
-- Part B — strategic_objective_id backfill, PREVIEW/DEMO ONLY.
-- Do NOT run this block against beakon-prod — real initiatives' free-text
-- strategic_goal is explicitly left unmapped (null) there, per the PM's
-- instruction recorded in ADR 007 decision 1. beakon-prod has zero
-- initiatives seeded by seed_prod.sql anyway (real ones are entered by real
-- users), so this block would be a no-op there even if run by mistake — but
-- don't run it there regardless, to keep this script's intent explicit.
-- ══════════════════════════════════════════════════════════════════════
-- Content-based mapping of the 10 distinct recurring `strategic_goal`
-- phrases in lib/seed.ts / supabase/seed.sql to one of the 4 real
-- strategic_objectives rows (ADR 007's table):

update initiatives set strategic_objective_id = 'so-ai'
  where strategic_objective_id is null
    and strategic_goal = 'Lead the market on AI-driven experimentation';

update initiatives set strategic_objective_id = 'so-core'
  where strategic_objective_id is null
    and strategic_goal = 'Best-in-class web testing experience';

update initiatives set strategic_objective_id = 'so-core'
  where strategic_objective_id is null
    and strategic_goal = 'Enterprise-grade feature control';

update initiatives set strategic_objective_id = 'so-data'
  where strategic_objective_id is null
    and strategic_goal = 'Results people can trust';

update initiatives set strategic_objective_id = 'so-internal'
  where strategic_objective_id is null
    and strategic_goal = 'Meet developers where they build';

update initiatives set strategic_objective_id = 'so-data'
  where strategic_objective_id is null
    and strategic_goal = 'Privacy-first by design';

update initiatives set strategic_objective_id = 'so-core'
  where strategic_objective_id is null
    and strategic_goal = 'One platform across surfaces';

update initiatives set strategic_objective_id = 'so-data'
  where strategic_objective_id is null
    and strategic_goal = 'Open, composable data';

update initiatives set strategic_objective_id = 'so-core'
  where strategic_objective_id is null
    and strategic_goal = 'Enterprise readiness';

update initiatives set strategic_objective_id = 'so-core'
  where strategic_objective_id is null
    and strategic_goal = 'Open, composable platform';

-- Sanity check after running Part B on beakon-preview only — should return
-- zero rows if the 19-row seed dataset is unchanged from lib/seed.ts's
-- current content. A non-zero result means either a new initiative was
-- added with a `strategic_goal` phrase not in ADR 007's table (expected —
-- extend the mapping above, or leave it unmapped if it's a one-off), or the
-- backfill was run before the seed rows existed.
--   select id, strategic_goal from initiatives
--   where strategic_goal is not null and strategic_goal <> ''
--     and strategic_objective_id is null;

-- ══════════════════════════════════════════════════════════════════════
-- Manual two-step rollout (do NOT run this via an automated/idempotent
-- pipeline):
--   1. beakon-preview (dashboard SQL editor): run Part A0's diagnostic
--      query first, then its `begin; ... commit;` fix script (as ONE
--      paste/execution — see the atomicity warning above), which covers
--      schema.sql's additive columns AND the view rename/redefine/grant in
--      one safe-from-any-state step. Then run Part A, then Part B. Verify
--      both sanity-check queries return zero rows, and the app shows real
--      team/strategic-objective names instead of blanks.
--   2. beakon-prod (dashboard SQL editor): back up first (Dashboard →
--      Database → Backups, or a manual export). Run Part A0's diagnostic
--      query, then its fix script (same as above — safe to run even
--      though prod is in a different, presumably fresh-relative-to-Heron,
--      state), then Part A ONLY (team_id). Do NOT run Part B — beakon-
--      prod's strategic_objective_id stays null for every existing
--      initiative, by design.
-- ══════════════════════════════════════════════════════════════════════
