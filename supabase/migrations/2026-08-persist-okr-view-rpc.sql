-- New RPC — safe to fold into schema.sql directly (same reasoning as
-- 2026-08-persist-roadmap-rpc.sql: this isn't tightening a constraint
-- against existing data, it's a brand-new function guarding a brand-new
-- table with no existing rows, so `create or replace function` is
-- idempotent on its own). This file is kept as a standalone migration
-- anyway, per the plan's file-layout decision, so the change has its own
-- reviewable diff; the identical definition also lives in
-- supabase/schema.sql (see the "persist_okr_view(): the only path that
-- updates an existing OkrView's fields" section there) so a from-scratch
-- bootstrap of a new Supabase project still gets it. The `okr_views` table
-- itself, its RLS policies, and its `updated_at` trigger are also new in
-- this sprint and live directly in schema.sql (as `create table if not
-- exists`) rather than in this file — a brand-new table with zero existing
-- rows carries none of the populated-database risk this migrations/
-- directory exists to isolate, so it doesn't need its own reviewable diff
-- the way this RPC's behavior does.
--
-- Why this exists: docs/decisions/009-okr-saved-views-reverse-adr-008-
-- deferral.md. `okr_views` is the app's third per-user-owned, RLS-scoped,
-- shareable object (after `okrs`' and `roadmaps`' own RPCs) — "an editor
-- can change filters/name but never reassign ownership or the sharing
-- flags themselves" is real conditional logic, not something a plain
-- `using`/`with check` boolean can express. Plain RLS on `okr_views` still
-- covers SELECT (owner, or visibility = 'shared') and DELETE (owner only)
-- — see the policies in schema.sql immediately above this function. There
-- is deliberately NO UPDATE policy at all: every write to
-- name/filters/visibility/editable/position routes through
-- persist_okr_view(), which is the only place the real authorization logic
-- lives.
--
-- security invoker (not definer): matches persist_roadmap()'s own
-- reasoning — persist_okr_view only ever touches `okr_views`, which the
-- `authenticated` role already has RLS-backed SELECT/DELETE/INSERT access
-- to (see the policies above). Running as invoker means the function
-- executes with the calling user's own privileges, so `current_owner_id()`
-- (also security invoker) resolves to the real caller's owner row inside
-- it — no privilege escalation, no new anon attack surface.
--
-- Authorization shape (mirrors ADR 009 exactly, and persist_roadmap()'s
-- shape minus the System-row branch — there is no System OkrView):
--   1. Target row doesn't exist yet (p_id is new): treated as a create.
--      Allowed only if the caller is creating an OkrView owned by
--      themself (p_owner_id = current_owner_id()).
--   2. Caller's current_owner_id() matches the row's existing owner_id:
--      full write allowed, including reassigning owner_id/visibility/
--      editable/name/position themselves (ownership transfer has no UI
--      this week, but the RPC doesn't structurally block it — an
--      explicit, deliberate scope note, not an oversight, same as
--      persist_roadmap()).
--   3. Row's existing visibility = 'shared' and editable = true: a
--      filtered write — only name/filters are applied. owner_id/
--      visibility/editable/position stay pinned to their CURRENT DB
--      values regardless of what the caller passed for them. This is a
--      deliberate silent ignore, not a bug and not an error: a
--      shared-editable visitor's UI never renders a sharing control, so a
--      visitor's client sending back its own last-known
--      visibility/editable/position unchanged is the expected, common
--      shape of this call, not a hostile one.
--   4. Anything else (caller is neither owner nor a shared+editable
--      visitor): raises an authorization exception.
--
-- Manual test plan (no live DB access in this session — someone with
-- beakon-preview access needs to run this):
--   1. Apply this file's function body in the beakon-preview SQL editor
--      (or re-run all of schema.sql, which now includes it, along with the
--      new `okr_views` table/RLS this RPC depends on).
--   2. Create: call persist_okr_view with a fresh p_id and p_owner_id
--      equal to your own owner row's id; confirm a new row appears in
--      `okr_views`. Then call it again with a fresh p_id but a DIFFERENT
--      p_owner_id (someone else's) and confirm it raises.
--   3. Owner full-write: as the owner of an existing OkrView, call
--      persist_okr_view with new filters AND a new name/visibility/
--      editable/position; confirm ALL of them land.
--   4. Shared-editable filtered-write: set an OkrView's visibility=
--      'shared', editable=true, owned by owner A. As a DIFFERENT
--      authenticated caller B, call persist_okr_view passing new filters
--      plus a different name and visibility='private'. Confirm
--      name/filters updated, but visibility/editable/owner_id/position on
--      the row are UNCHANGED from what they were before B's call (not
--      erroring, not applying B's requested visibility).
--   5. Shared-view-only refusal: same setup but editable=false. Confirm
--      B's call raises the authorization exception and nothing changes.
--   6. SELECT/DELETE/INSERT RLS matrix (§7.4 of the Heron Week 3 plan):
--      confirm a non-owner cannot SELECT another owner's private view but
--      can SELECT a shared one; confirm DELETE is rejected for a
--      non-owner even when the view is shared+editable; confirm INSERT
--      only succeeds when owner_id = the inserting caller.
--   7. Repeat steps 2-6 in beakon-prod only once this lands there (prod
--      migration for this schema area is explicitly deferred until OKR
--      saved views ship — no urgency, but the same before/after check
--      applies whenever it does roll out).

create or replace function persist_okr_view(
  p_id text,
  p_owner_id text,
  p_name text,
  p_filters jsonb,
  p_visibility text,
  p_editable boolean,
  p_position double precision
) returns void
language plpgsql
security invoker
as $$
declare
  v_existing okr_views%rowtype;
  v_caller text := current_owner_id();
begin
  select * into v_existing from okr_views where id = p_id;

  if not found then
    if v_caller is null or p_owner_id is distinct from v_caller then
      raise exception 'persist_okr_view: cannot create an OkrView owned by someone other than the caller';
    end if;

    insert into okr_views (id, owner_id, name, filters, visibility, editable, position)
    values (p_id, p_owner_id, p_name, p_filters, p_visibility, p_editable, p_position);
    return;
  end if;

  if v_existing.owner_id = v_caller then
    update okr_views set
      owner_id   = p_owner_id,
      name       = p_name,
      filters    = p_filters,
      visibility = p_visibility,
      editable   = p_editable,
      position   = p_position
    where id = p_id;
    return;
  end if;

  if v_existing.visibility = 'shared' and v_existing.editable then
    update okr_views set
      name    = p_name,
      filters = p_filters
    where id = p_id;
    return;
  end if;

  raise exception 'persist_okr_view: caller is not authorized to update OkrView %', p_id;
end;
$$;

revoke execute on function persist_okr_view(
  text, text, text, jsonb, text, boolean, double precision
) from public;

grant execute on function persist_okr_view(
  text, text, text, jsonb, text, boolean, double precision
) to authenticated;
