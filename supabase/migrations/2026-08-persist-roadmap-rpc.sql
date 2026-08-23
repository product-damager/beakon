-- New RPC — safe to fold into schema.sql directly (same reasoning as
-- 2026-08-persist-okr-rpc.sql: this isn't tightening a constraint against
-- existing data, it's a brand-new function with no backward-compat hazard,
-- so `create or replace function` is idempotent on its own). This file is
-- kept as a standalone migration anyway, per the plan's file-layout
-- decision, so the change has its own reviewable diff; the identical
-- definition also lives in supabase/schema.sql (see the "persist_roadmap():
-- the only path that updates an existing Roadmap's display fields" section
-- there) so a from-scratch bootstrap of a new Supabase project still gets
-- it.
--
-- Why this exists: docs/decisions/008-roadmap-entity-visibility-model-and-
-- okr-separation.md decision 1. Roadmaps are the app's first per-user-owned,
-- RLS-scoped object, with a sharing model richer than a plain owner/public
-- split — "an editor can change filters/viewMode but never reassign
-- ownership, visibility, or the editable flag itself" is real conditional
-- logic, not something a `using`/`with check` boolean can express. Plain
-- RLS on `roadmaps` still covers SELECT (owner, or visibility = 'shared', or
-- is_system = true) and DELETE (owner only, never on is_system rows) — see
-- the policies in schema.sql immediately above this function. There is
-- deliberately NO UPDATE policy at all: every write to
-- filters/groupBy/viewMode/zoom/zoomScale/density/timelineSort/name/
-- ownerId/visibility/editable routes through persist_roadmap(), which is
-- the only place the real authorization logic lives.
--
-- security invoker (not definer): matches persist_okr()'s own reasoning —
-- persist_roadmap only ever touches `roadmaps`, which the `authenticated`
-- role already has RLS-backed SELECT/DELETE/INSERT access to (see the
-- policies above). Running as invoker means the function executes with the
-- calling user's own privileges, so `current_owner_id()` (also security
-- invoker) resolves to the real caller's owner row inside it — no privilege
-- escalation, no new anon attack surface.
--
-- Authorization shape (mirrors ADR 008 decision 1 exactly):
--   1. Target row doesn't exist yet (p_id is new): treated as a create.
--      Allowed only if the caller is creating a Roadmap owned by themself
--      (p_owner_id = current_owner_id()) — nobody creates `is_system` rows
--      through this function; the one System row is seed-only.
--   2. Target row is_system: always raises. Nobody — not even an "owner,"
--      since the System row has none — updates the System row's display
--      fields through any path. Its view_mode/filters/etc. stay fixed at
--      their seeded defaults; per-user view-mode switching on it is
--      client-only state (ADR 008 decision 2).
--   3. Caller's current_owner_id() matches the row's existing owner_id:
--      full write allowed, including reassigning owner_id/visibility/
--      editable/name themselves (ownership transfer has no UI this week,
--      but the RPC doesn't structurally block it — an explicit, deliberate
--      scope note, not an oversight).
--   4. Row's existing visibility = 'shared' and editable = true: a
--      filtered write — only filters/group_by/view_mode/zoom/zoom_scale/
--      density/timeline_sort are applied. owner_id/name/visibility/
--      editable/position stay pinned to their CURRENT DB values regardless
--      of what the caller passed for them. This is a deliberate silent
--      ignore, not a bug and not an error: an editor's UI never renders a
--      sharing control (per the plan's §2b), so an editor's client sending
--      back its own last-known name/visibility unchanged is the expected,
--      common shape of this call, not a hostile one.
--   5. Anything else (caller is neither owner nor a shared+editable
--      viewer): raises an authorization exception.
--
-- Manual test plan (no live DB access in this session — someone with
-- beakon-preview access needs to run this):
--   1. Apply this file's function body in the beakon-preview SQL editor
--      (or re-run all of schema.sql, which now includes it).
--   2. Create: call persist_roadmap with a fresh p_id and p_owner_id equal
--      to your own owner row's id; confirm a new row appears in `roadmaps`
--      with is_system = false. Then call it again with a fresh p_id but a
--      DIFFERENT p_owner_id (someone else's) and confirm it raises.
--   3. Owner full-write: as the owner of an existing non-system Roadmap,
--      call persist_roadmap with new filters/view_mode AND a new name/
--      visibility/editable; confirm ALL of them land.
--   4. Shared-editable filtered-write: set a Roadmap's visibility='shared',
--      editable=true, owned by owner A. As a DIFFERENT authenticated
--      caller B, call persist_roadmap passing new filters/view_mode plus a
--      different name and visibility='private'. Confirm filters/view_mode
--      updated, but name/visibility/editable/owner_id/position on the row
--      are UNCHANGED from what they were before B's call (not erroring,
--      not applying B's requested name/visibility).
--   5. Shared-view-only refusal: same setup but editable=false. Confirm B's
--      call raises the authorization exception and nothing changes.
--   6. System-row refusal: call persist_roadmap with p_id = 'roadmap-general'
--      (any params). Confirm it raises, regardless of who calls it.
--   7. Repeat step 3's assertion pattern in beakon-prod only once this
--      lands there (prod migration for this schema area is explicitly
--      deferred until Roadmaps ship — no urgency, but the same before/
--      after check applies whenever it does roll out).

create or replace function persist_roadmap(
  p_id text,
  p_owner_id text,
  p_name text,
  p_view_mode text,
  p_filters jsonb,
  p_group_by text,
  p_zoom text,
  p_zoom_scale numeric,
  p_density text,
  p_timeline_sort jsonb,
  p_visibility text,
  p_editable boolean,
  p_position double precision
) returns void
language plpgsql
security invoker
as $$
declare
  v_existing roadmaps%rowtype;
  v_caller text := current_owner_id();
begin
  select * into v_existing from roadmaps where id = p_id;

  if not found then
    if v_caller is null or p_owner_id is distinct from v_caller then
      raise exception 'persist_roadmap: cannot create a Roadmap owned by someone other than the caller';
    end if;

    insert into roadmaps (
      id, owner_id, name, view_mode, filters, group_by, zoom, zoom_scale,
      density, timeline_sort, visibility, editable, is_system, position
    ) values (
      p_id, p_owner_id, p_name, p_view_mode, p_filters, p_group_by, p_zoom, p_zoom_scale,
      p_density, p_timeline_sort, p_visibility, p_editable, false, p_position
    );
    return;
  end if;

  if v_existing.is_system then
    raise exception 'persist_roadmap: the System Roadmap cannot be updated';
  end if;

  if v_existing.owner_id = v_caller then
    update roadmaps set
      owner_id      = p_owner_id,
      name          = p_name,
      view_mode     = p_view_mode,
      filters       = p_filters,
      group_by      = p_group_by,
      zoom          = p_zoom,
      zoom_scale    = p_zoom_scale,
      density       = p_density,
      timeline_sort = p_timeline_sort,
      visibility    = p_visibility,
      editable      = p_editable,
      position      = p_position
    where id = p_id;
    return;
  end if;

  if v_existing.visibility = 'shared' and v_existing.editable then
    update roadmaps set
      view_mode     = p_view_mode,
      filters       = p_filters,
      group_by      = p_group_by,
      zoom          = p_zoom,
      zoom_scale    = p_zoom_scale,
      density       = p_density,
      timeline_sort = p_timeline_sort
    where id = p_id;
    return;
  end if;

  raise exception 'persist_roadmap: caller is not authorized to update Roadmap %', p_id;
end;
$$;

revoke execute on function persist_roadmap(
  text, text, text, text, jsonb, text, text, numeric, text, jsonb, text, boolean, double precision
) from public;

grant execute on function persist_roadmap(
  text, text, text, text, jsonb, text, text, numeric, text, jsonb, text, boolean, double precision
) to authenticated;
