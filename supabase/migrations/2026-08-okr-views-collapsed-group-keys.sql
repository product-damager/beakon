-- Sprint Vireo, Initiative 1 — saved OKR views become grouping-aware.
-- Safe to fold into schema.sql directly (additive column with a default,
-- plus a function whose parameter list changes but whose body's
-- authorization shape is otherwise unchanged) — same reasoning as
-- 2026-08-persist-okr-view-rpc.sql. This file is kept as a standalone,
-- dated migration anyway, per this project's convention, so the change
-- has its own reviewable diff; the identical statements also live in
-- supabase/schema.sql (the "okr_views" and "persist_okr_view()" sections)
-- so a from-scratch bootstrap of a new Supabase project still gets them.
--
-- Why this exists: PM decision recorded in
-- docs/plans/vireo-grouped-okr-view-and-drawer-detail-rework.md
-- ("Saved views become grouping-aware" section) — this reopens ADR 009's
-- explicit "no groupBy/collapse-state field on OkrView, filters-only"
-- stance. A short new ADR recording the reversal is tracked separately
-- (dev-lead/frontend-engineer follow-on, not part of this migration file).
--
-- Persisted shape: a DENYLIST of collapsed group keys ("bu:<id>"/
-- "team:<id>", same shape lib/okrGrouping.ts produces), not an allowlist
-- of expanded ones — a key's absence means expanded. This degrades
-- gracefully under data drift: a newly-added Team not yet in
-- `collapsed_group_keys` renders expanded (visible) by default, matching
-- the "leadership scanning coverage" persona rather than silently hiding
-- new OKR coverage the way an allowlist-of-expanded would.
--
-- Part 1 — additive column, safe to re-run, no rewrite of existing rows.
-- `okr_views` is now a POPULATED table (unlike when the original
-- persist_okr_view RPC migration landed with zero rows), so this needs to
-- run on both beakon-preview and beakon-prod, not just preview.
alter table okr_views add column if not exists collapsed_group_keys jsonb not null default '[]'::jsonb;

-- Part 2 — persist_okr_view() gains a trailing p_collapsed_group_keys
-- parameter. Because Postgres treats a changed parameter list as a
-- distinct overload rather than a true in-place replace, the old 7-arg
-- signature must be dropped explicitly first — otherwise it lingers
-- alongside the new 8-arg one and callers using named/positional args
-- against the old shape would still resolve to it.
drop function if exists persist_okr_view(text, text, text, jsonb, text, boolean, double precision);

create or replace function persist_okr_view(
  p_id text,
  p_owner_id text,
  p_name text,
  p_filters jsonb,
  p_visibility text,
  p_editable boolean,
  p_position double precision,
  p_collapsed_group_keys jsonb default '[]'::jsonb
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

    insert into okr_views (id, owner_id, name, filters, visibility, editable, position, collapsed_group_keys)
    values (p_id, p_owner_id, p_name, p_filters, p_visibility, p_editable, p_position, p_collapsed_group_keys);
    return;
  end if;

  if v_existing.owner_id = v_caller then
    update okr_views set
      owner_id             = p_owner_id,
      name                 = p_name,
      filters              = p_filters,
      visibility           = p_visibility,
      editable             = p_editable,
      position             = p_position,
      collapsed_group_keys = p_collapsed_group_keys
    where id = p_id;
    return;
  end if;

  if v_existing.visibility = 'shared' and v_existing.editable then
    -- A shared-editable visitor collapsing/expanding groups is exactly as
    -- legitimate as them changing filters, so collapsed_group_keys travels
    -- with filters/name in this filtered-write branch too. owner_id/
    -- visibility/editable/position remain pinned to their current DB
    -- values, same as before this migration.
    update okr_views set
      name                 = p_name,
      filters              = p_filters,
      collapsed_group_keys = p_collapsed_group_keys
    where id = p_id;
    return;
  end if;

  raise exception 'persist_okr_view: caller is not authorized to update OkrView %', p_id;
end;
$$;

revoke execute on function persist_okr_view(
  text, text, text, jsonb, text, boolean, double precision, jsonb
) from public;

grant execute on function persist_okr_view(
  text, text, text, jsonb, text, boolean, double precision, jsonb
) to authenticated;

-- Manual test plan (no live DB access in this session — someone with
-- beakon-preview/beakon-prod access needs to run this):
--   1. Apply this file (or re-run all of schema.sql, which now includes
--      the same statements) in the beakon-preview SQL editor first.
--   2. Confirm existing okr_views rows now show collapsed_group_keys = '[]'
--      (Table Editor), with no error on the alter table.
--   3. Create: call persist_okr_view with a fresh p_id, your own owner id,
--      and p_collapsed_group_keys = '["team:t1"]'::jsonb; confirm the row
--      lands with that value.
--   4. Owner full-write: call persist_okr_view again on that row with a
--      different p_collapsed_group_keys array; confirm it overwrites.
--   5. Shared-editable filtered-write: set visibility='shared',
--      editable=true, owned by owner A. As caller B, call
--      persist_okr_view with new filters/collapsed_group_keys AND a
--      different p_visibility/p_editable/p_position; confirm
--      filters/collapsed_group_keys updated but visibility/editable/
--      position/owner_id on the row are UNCHANGED.
--   6. Omit p_collapsed_group_keys entirely on a call (relying on the
--      default) and confirm it lands as '[]'::jsonb, not an error.
--   7. Repeat steps 1-6 in beakon-prod once this lands there. Back up prod
--      first (Dashboard → Database → Backups) per supabase/README.md's
--      workflow — this is a real migration on a populated table, not a
--      zero-row bootstrap.
