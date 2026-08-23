-- One-off, reviewed data migration — NOT part of schema.sql.
--
-- Why this isn't in schema.sql: schema.sql's `view_mode` column default
-- change (this same batch — see `alter table roadmaps alter column
-- view_mode set default 'board'` there) only affects rows inserted *after*
-- it runs. It does not, and per the Golden rule in supabase/README.md must
-- not, retroactively touch any row's already-*stored* `view_mode` value —
-- that would be a silent overwrite of data, which is exactly what a
-- schema-default change is supposed to avoid. This migration is the
-- deliberate, narrowly-scoped exception: it updates exactly one existing
-- row's stored value, on purpose, per an explicit PM decision.
--
-- What's changing and why only this one row:
-- docs/plans/roadmap-dialog-viewmode-and-archive-reversal.md (item 3) moves
-- `viewMode` from a definitional/explicit-save Roadmap field to a personal-
-- rendering-preference/autosave field (like zoom/zoomScale/density). Once
-- that's true, every *other* existing Roadmap's stored `view_mode` is
-- someone's own already-saved preference under the new model — silently
-- overwriting it would undercut the very premise of this change. The
-- System/General Roadmap row (`is_system = true`, id `roadmap-general`) is
-- different: it isn't "personally saved" by anyone, it's the shared default
-- landing view every user sees, which is what the PM is actually asking to
-- change (System row currently stored as 'list', from before Board/
-- Timeline/List was reordered to lead with Board). PM's decision, verbatim:
-- "system row only" (plan's "Decisions" §1).
--
-- Scope — READ BEFORE RUNNING:
--   - beakon-preview ONLY, this pass. PM's decision (plan's "Decisions" §2):
--     "preview for now, we will make prod later." Do NOT run this against
--     beakon-prod as part of this batch — that is a separate, later,
--     explicitly-requested action, not implied by this file's existence.
--   - System row only (`is_system = true`), not every Roadmap.
--
-- Idempotent: the `where ... and view_mode = 'list'` guard means re-running
-- this is a no-op once the row has already been updated (or if it's
-- already 'board'/'timeline' for some other reason) — safe to run more
-- than once, same convention as this folder's other migrations.
--
-- Verification (not performed live in this session — no live Supabase
-- access from this environment): after applying to beakon-preview via the
-- SQL Editor, confirm with
--   select id, is_system, view_mode from roadmaps where is_system = true;
-- and reload the app to confirm the System Roadmap now lands on Board.

update roadmaps
set view_mode = 'board'
where is_system = true
  and view_mode = 'list';
