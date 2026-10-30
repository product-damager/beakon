-- Hotfix: remove write access to the two public views (2026-10-30).
--
-- Why: `external_roadmap` and `initiative_scores` are owned by postgres and
-- run with its rights (bypassing RLS on `initiatives`), are automatically
-- updatable by Postgres (single-table views), and had Supabase's default
-- grants — anon and authenticated held INSERT/UPDATE/DELETE on them. With
-- only the publishable key, anyone could write through them: edit or delete
-- external initiatives via `external_roadmap`, and delete *any* initiative
-- via `initiative_scores` (no row filter). See
-- openspec/specs/sharing-and-auth/spec.md (anonymous-access baseline).
--
-- What: revoke everything from anon/authenticated on both views, then grant
-- SELECT back, so read access is exactly what it was (anon reads
-- external_roadmap for /share; authenticated may too). Nothing else changes —
-- security_invoker, the anon read of `owners`, the score view's anon read,
-- functions and search_path are the security-hardening change's scope.
--
-- Idempotent: REVOKE/GRANT are no-ops when already in the target state.
-- Mirrored in supabase/schema.sql right after the external_roadmap view.

revoke all on external_roadmap  from anon, authenticated;
revoke all on initiative_scores from anon, authenticated;

grant select on external_roadmap  to anon, authenticated;
grant select on initiative_scores to anon, authenticated;
