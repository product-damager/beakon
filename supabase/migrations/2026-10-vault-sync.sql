-- vault-sync (2026-10-30) — see openspec/changes/vault-sync/ (design.md: field
-- ownership, decisions 1–4). Mirrored in supabase/schema.sql.
--
-- One writer per field: on a row synced from the vault (`source = 'vault'`),
-- `vault_fields` lists the columns the vault owns for that row. Signed-in users
-- (`authenticated`) can't change those columns, nor the vault metadata; the
-- sync itself runs as `postgres` through the Supabase tools and isn't blocked.
-- Additive and idempotent. Applied to beakon-preview first, then beakon-prod.
--
-- Rollback: update initiatives/okrs set source = null, source_key = null,
-- vault_fields = '{}'; drop the two triggers; the columns are nullable/defaulted.

begin;

-- ── Columns ──
alter table initiatives add column if not exists tier         text;
alter table initiatives add column if not exists area         text;
alter table initiatives add column if not exists source       text;
alter table initiatives add column if not exists source_key   text;
alter table initiatives add column if not exists vault_fields text[] not null default '{}';
alter table okrs        add column if not exists tier         text;
alter table okrs        add column if not exists source       text;
alter table okrs        add column if not exists source_key   text;
alter table okrs        add column if not exists vault_fields text[] not null default '{}';

do $$ begin
  alter table initiatives add constraint initiatives_tier_check check (tier in ('T1', 'T2', 'T3'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table okrs add constraint okrs_tier_check check (tier in ('T1', 'T2', 'T3'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table initiatives add constraint initiatives_source_check check (source in ('vault'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table okrs add constraint okrs_source_check check (source in ('vault'));
exception when duplicate_object then null; end $$;

create unique index if not exists initiatives_source_key_idx
  on initiatives (source, source_key) where source is not null;
create unique index if not exists okrs_source_key_idx
  on okrs (source, source_key) where source is not null;

-- ── Guard: vault-owned columns are read-only for signed-in users ──
create or replace function guard_vault_definitions() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  f text;
  o jsonb;
  n jsonb;
begin
  -- Only signed-in API callers are restricted; the sync runs as postgres.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Rows created from the app are never vault rows.
    new.source := null;
    new.source_key := null;
    new.vault_fields := '{}';
    return new;
  end if;

  if old.source is null then
    if new.source is not null or new.source_key is not null or new.vault_fields <> '{}' then
      raise exception 'Only a vault sync can mark a record as managed in the vault'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.source is distinct from old.source
     or new.source_key is distinct from old.source_key
     or new.vault_fields is distinct from old.vault_fields then
    raise exception 'Vault metadata can only be changed by a vault sync'
      using errcode = '42501';
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);
  foreach f in array old.vault_fields loop
    if (o -> f) is distinct from (n -> f) then
      raise exception 'Managed in the vault: "%" can only be changed in the vault', f
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function guard_vault_definitions() from public, anon, authenticated;

drop trigger if exists initiatives_guard_vault_definitions on initiatives;
create trigger initiatives_guard_vault_definitions
  before insert or update on initiatives
  for each row execute function guard_vault_definitions();

drop trigger if exists okrs_guard_vault_definitions on okrs;
create trigger okrs_guard_vault_definitions
  before insert or update on okrs
  for each row execute function guard_vault_definitions();

-- ── persist_okr: keep stored values for vault-owned columns ──
-- Same signature as before; only the ON CONFLICT branch changes, so a client
-- holding a stale title/team/etc. for a vault OKR can still save live state.
create or replace function persist_okr(
  p_id text,
  p_title text,
  p_strategic_objective_id text,
  p_team_id text,
  p_business_unit_id text,
  p_year smallint,
  p_quarter smallint,
  p_deliverable_detail text,
  p_governance_status okr_governance_status,
  p_okr_class okr_class,
  p_target_date date,
  p_achievement numeric,
  p_health initiative_health,
  p_notes text,
  p_carried_from_id text,
  p_archived boolean,
  p_position double precision,
  p_owners jsonb,
  p_initiative_ids text[]
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into okrs (
    id, title, strategic_objective_id, team_id, business_unit_id, year, quarter,
    deliverable_detail, governance_status, okr_class, target_date, achievement,
    health, notes, carried_from_id, archived, position
  )
  values (
    p_id, p_title, p_strategic_objective_id, p_team_id, p_business_unit_id, p_year, p_quarter,
    p_deliverable_detail, p_governance_status, p_okr_class, p_target_date, p_achievement,
    p_health, p_notes, p_carried_from_id, p_archived, p_position
  )
  on conflict (id) do update set
    title                  = case when 'title' = any(okrs.vault_fields) then okrs.title else excluded.title end,
    strategic_objective_id = case when 'strategic_objective_id' = any(okrs.vault_fields) then okrs.strategic_objective_id else excluded.strategic_objective_id end,
    team_id                = case when 'team_id' = any(okrs.vault_fields) then okrs.team_id else excluded.team_id end,
    business_unit_id       = case when 'business_unit_id' = any(okrs.vault_fields) then okrs.business_unit_id else excluded.business_unit_id end,
    year                   = case when 'year' = any(okrs.vault_fields) then okrs.year else excluded.year end,
    quarter                = case when 'quarter' = any(okrs.vault_fields) then okrs.quarter else excluded.quarter end,
    deliverable_detail     = case when 'deliverable_detail' = any(okrs.vault_fields) then okrs.deliverable_detail else excluded.deliverable_detail end,
    governance_status      = excluded.governance_status,
    okr_class              = excluded.okr_class,
    target_date            = excluded.target_date,
    achievement            = excluded.achievement,
    health                 = excluded.health,
    notes                  = excluded.notes,
    carried_from_id        = excluded.carried_from_id,
    archived               = case when 'archived' = any(okrs.vault_fields) then okrs.archived else excluded.archived end,
    position               = excluded.position;

  delete from okr_owners where okr_id = p_id;
  if p_owners is not null and jsonb_array_length(p_owners) > 0 then
    begin
      insert into okr_owners (okr_id, owner_id, role)
      select p_id, elem->>'owner_id', coalesce(elem->>'role', 'contributor')
      from jsonb_array_elements(p_owners) as elem;
    exception when unique_violation then
      raise exception 'persist_okr: duplicate owner in OKR % — each owner can only be listed once', p_id
        using errcode = 'unique_violation';
    end;
  end if;

  delete from okr_initiatives where okr_id = p_id;
  if p_initiative_ids is not null and array_length(p_initiative_ids, 1) > 0 then
    begin
      insert into okr_initiatives (okr_id, initiative_id)
      select p_id, initiative_id from unnest(p_initiative_ids) as initiative_id;
    exception when unique_violation then
      raise exception 'persist_okr: duplicate initiative link in OKR % — each initiative can only be linked once', p_id
        using errcode = 'unique_violation';
    end;
  end if;
end;
$$;

commit;
