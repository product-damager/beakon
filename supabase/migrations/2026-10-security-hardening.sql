-- security-hardening (2026-10-30) — see openspec/changes/security-hardening/
-- (proposal.md for why, design.md for the decisions, tasks.md for the order).
--
-- Narrows anonymous access to exactly what /share needs, makes the two
-- public views run with the caller's rights, closes API access to
-- trigger-only functions and pins every function's search_path. Builds on
-- 2026-10-revoke-view-writes.sql (already applied). Each section is
-- idempotent and was applied preview first, then prod, one section at a
-- time. Every section is mirrored in supabase/schema.sql.

-- ── 1. Owners: no anonymous access ──
-- Nothing signed-out reads owners (/share uses external_roadmap + themes),
-- yet the "anon read owners" policy exposed every name and email.
drop policy if exists "anon read owners" on owners;
revoke all on owners from anon;

-- ── 2. Views with the caller's rights; anon narrowed to what /share needs ──
-- One transaction: the anon row policy and column grants exist before the
-- view switches to security_invoker, so /share never sees a gap.
-- Order matters: REVOKE ALL on a table also revokes its column grants, so
-- the blanket anon revoke runs first and the narrow grants after it.
begin;

-- 2a. Anon: nothing on any table, view or sequence, then only what /share needs.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on themes to anon;
grant select (id, title, status, theme_id, target_start, target_end, position, visibility, archived)
  on initiatives to anon;   -- WHERE/ORDER BY columns of the view need a grant too
do $$ begin
  create policy "anon read external initiatives" on initiatives
    for select to anon using (visibility = 'external' and archived = false);
exception when duplicate_object then null; end $$;

-- 2b. external_roadmap: only the displayed columns, caller's rights.
-- Dropping columns needs drop + create (create or replace can't remove
-- them); guarded so a re-run on the new shape is a no-op.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'external_roadmap'
               and column_name = 'summary') then
    drop view external_roadmap;
  end if;
end $$;
create or replace view external_roadmap with (security_invoker = true) as
select i.id, i.title, i.status, i.theme_id, i.target_start, i.target_end
from initiatives i
where i.visibility = 'external' and i.archived = false
order by i.position;
revoke all on external_roadmap from anon, authenticated;
grant select on external_roadmap to anon, authenticated;

-- 2c. initiative_scores: caller's rights (signed-in users see what RLS allows: all).
alter view initiative_scores set (security_invoker = true);

-- 2d. Future objects created by postgres: anon gets nothing by default.
-- (supabase_admin's defaults can't be changed from this role — the advisor
-- run after each release is the backstop.)
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon, public;

commit;

-- ── 3. Trigger-only functions not callable through the API ──
-- Both are SECURITY DEFINER and only meant to fire as triggers; trigger
-- functions aren't privilege-checked when they fire, so revoking EXECUTE
-- keeps the signup check and auto-RLS working. rls_auto_enable() (Supabase's
-- auto-RLS event trigger) already exists in both projects; its definition is
-- now also in schema.sql. Anon additionally loses EXECUTE on every existing
-- function: nothing signed-out calls an RPC (persist_* stay granted to
-- authenticated), matching group 2's "anon gets nothing" for new functions.
begin;
revoke execute on function enforce_company_domain() from public, anon, authenticated;
revoke execute on function rls_auto_enable()        from public, anon, authenticated;
revoke execute on function touch_updated_at()       from public, anon, authenticated;  -- trigger-only too (via PUBLIC)
revoke execute on all functions in schema public    from anon;
commit;

-- ── 4. Pin search_path on every app function ──
-- Same value as the definitions in schema.sql (create or replace resets
-- function settings, so the definitions carry it too). Looping over pg_proc
-- covers every overload and skips a function a project doesn't have.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('touch_updated_at', 'enforce_company_domain', 'persist_okr',
                        'current_owner_id', 'persist_owner_profile', 'persist_roadmap',
                        'persist_okr_view')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;
