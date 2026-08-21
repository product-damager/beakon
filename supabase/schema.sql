-- Beakon roadmap workspace — Postgres schema for Supabase.
-- Run this in the SQL editor of BOTH projects (beakon-preview and beakon-prod).
-- Then run seed.sql in the PREVIEW project only.
--
-- Safe to re-run: enum/policy creates are guarded and tables use "if not exists".

-- ── Enums ──
do $$ begin
  create type initiative_status as enum
    ('planned', 'opportunity_framing', 'solution_framing', 'in_development', 'released');
exception when duplicate_object then null; end $$;

do $$ begin
  create type initiative_visibility as enum ('internal', 'external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type initiative_health as enum ('on_track', 'at_risk', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_link_type as enum ('redmine', 'figma', 'spec', 'notion', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type okr_governance_status as enum
    ('draft', 'to_validate', 'being_reviewed', 'to_refine', 'validated', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type okr_class as enum ('committed', 'conditional', 'optional');
exception when duplicate_object then null; end $$;

-- ── Reference tables ──
create table if not exists themes (
  id text primary key,
  name text not null,
  description text not null default '',
  color text not null default 'green' -- green | blue | lime | pink | orange | beige
);

-- Added after initial deploy; safe to re-run.
-- Constrain color to the six palette keys the app knows (lib/types.ts
-- THEME_COLOR_META). Normalize any legacy/hand-edited value outside the set to
-- the schema default first so the constraint can be added without failing —
-- this mirrors normalizeThemeColor()'s fallback in the app.
update themes set color = 'green'
  where color not in ('green', 'blue', 'lime', 'pink', 'orange', 'beige');

do $$ begin
  alter table themes add constraint themes_color_check
    check (color in ('green', 'blue', 'lime', 'pink', 'orange', 'beige'));
exception when duplicate_object then null; end $$;

create table if not exists owners (
  id text primary key,
  name text not null default '',
  surname text not null default '',
  role text not null default '',
  email text, -- optional; matches the signed-in user's email to auto-set them as owner
  team text   -- optional; the person's team, chosen in profile settings
);

-- Added after initial deploy; safe to re-run.
alter table owners add column if not exists email text;
alter table owners add column if not exists surname text not null default '';
alter table owners add column if not exists team text;
alter table owners alter column name set default '';

-- ── Initiatives ──
-- DIVE inputs match lib/types.ts exactly (log-calibrated, not linear buckets):
--   demand:    3 | 15 | 50 | 250 | 1000  (account-band midpoints, accts/month)
--   impact:    0.25 | 0.5 | 1 | 3 | 10
--   viability: 0.5 | 0.8 | 1
--   effort:    person-months (> 0)
create table if not exists initiatives (
  id text primary key,
  title text not null,
  summary text not null default '',
  problem text not null default '',
  expected_outcome text not null default '',
  status initiative_status not null default 'planned',
  owner_id text references owners (id),
  team text not null,
  theme_id text references themes (id),
  strategic_goal text not null default '',
  demand numeric not null default 250 check (demand in (3, 15, 50, 250, 1000)),
  impact numeric not null default 1 check (impact in (0.25, 0.5, 1, 3, 10)),
  viability numeric not null default 0.8 check (viability in (0.5, 0.8, 1)),
  effort numeric not null default 1 check (effort > 0),
  health initiative_health not null default 'on_track',
  target_start date not null,
  target_end date not null,
  depends_on text[] not null default '{}',
  visibility initiative_visibility not null default 'internal',
  notes text not null default '', -- internal only; never exposed to the external share view
  archived boolean not null default false,
  position double precision not null default 0, -- global sort order (board drag, list order)
  updated_at timestamptz not null default now()
);

-- Added after initial deploy: let an initiative be saved "unscored" (DIVE not
-- yet estimated). A CHECK fails only on FALSE, and NULL IN (...) / NULL > 0 are
-- both "unknown" → they pass, so the existing constraints need no change; we
-- only drop NOT NULL. All four are NULL together (see lib/data.ts). Safe to re-run.
alter table initiatives alter column demand    drop not null;
alter table initiatives alter column impact    drop not null;
alter table initiatives alter column viability drop not null;
alter table initiatives alter column effort    drop not null;

-- ── Delivery links (one initiative → many links) ──
create table if not exists delivery_links (
  id text primary key,
  initiative_id text not null references initiatives (id) on delete cascade,
  label text not null,
  url text not null,
  type delivery_link_type not null default 'other',
  position double precision not null default 0
);

create index if not exists delivery_links_initiative_idx on delivery_links (initiative_id);

-- ── Auto-touch updated_at on any initiative write ──
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists initiatives_touch_updated_at on initiatives;
create trigger initiatives_touch_updated_at
  before update on initiatives
  for each row execute function touch_updated_at();

-- ── Derived DIVE score = (demand * impact * viability) / effort ──
create or replace view initiative_scores as
select id, round((demand * impact * viability) / effort) as dive_score
from initiatives;

-- Note: `external_roadmap`'s view definition used to live here. It's been
-- moved below (after `teams`/`strategic_objectives` exist) because Sprint
-- Heron Week 1 repoints its column list from `i.team` to `i.team_id`, which
-- requires `initiatives.team_id` (added further down) to already exist — see
-- that section for the full view definition.

-- ══════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════════════
alter table initiatives    enable row level security;
alter table themes         enable row level security;
alter table owners         enable row level security;
alter table delivery_links enable row level security;

-- Signed-in teammates get full read/write on everything.
do $$ begin
  create policy "authenticated full access" on initiatives
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on delivery_links
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on themes
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on owners
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- The anonymous public (share page) reads ONLY the external_roadmap view,
-- plus themes/owners for labels. No direct anon access to `initiatives`.
-- Signed-in users can open the share page too, so grant both roles.
-- Note: the `grant select on external_roadmap` statement itself moved further
-- down in this file, alongside the view's definition (Sprint Heron Week 1
-- moved the view below `teams`/`strategic_objectives` — see that section) —
-- a `grant` on a view that doesn't exist yet would fail on a fresh database.

do $$ begin
  create policy "anon read themes" on themes
    for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anon read owners" on owners
    for select to anon using (true);
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════════════
-- Lock signups to the company domain (+ explicit personal allowlist)
-- Only team emails — plus the individually allow-listed addresses
-- below — can ever create an account. Add more personal emails to the array.
-- ══════════════════════════════════════════════════════════════════════
create or replace function enforce_company_domain() returns trigger as $$
declare
  allowed_emails text[] := array['vanyakulagin251@gmail.com'];
begin
  if new.email is null
     or (new.email !~* '@kameleoon\.com$' and not (lower(new.email) = any (allowed_emails))) then
    raise exception 'Signups are restricted to our team email or an allow-listed address';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_company_domain on auth.users;
create trigger enforce_company_domain
  before insert on auth.users
  for each row execute function enforce_company_domain();

-- ══════════════════════════════════════════════════════════════════════
-- OKRs (Sprint Grackle — Phase 1: schema & RLS only, no read/write UI yet)
-- ══════════════════════════════════════════════════════════════════════

-- ── Business units, teams, strategic objectives ──
create table if not exists business_units (
  id text primary key,
  name text not null
);

create table if not exists teams (
  id text primary key,
  name text not null,
  business_unit_id text references business_units (id)
);

create table if not exists strategic_objectives (
  id text primary key,
  name text not null,
  description text not null default '',
  year smallint not null,
  sponsor_id text references owners (id)
);

-- ══════════════════════════════════════════════════════════════════════
-- Sprint Heron Week 1 — unify Initiative/Owner team + Initiative strategic
-- goal onto the real `teams`/`strategic_objectives` tables OKRs already use.
-- See docs/decisions/006-unify-initiative-team-defer-strategic-goal.md and
-- docs/decisions/007-heron-week-1-data-model-and-drawer-conventions.md.
--
-- Additive only — both new columns start NULL on every existing row and are
-- backfilled by a separate one-off script (NOT folded into this idempotent
-- file, per supabase/README.md's golden rule):
-- supabase/migrations/2026-08-heron-team-strategic-objective-backfill.sql.
-- The legacy `initiatives.team`/`strategic_goal` text columns and `owners.team`
-- stay in the schema, inert, until a later follow-up migration drops them
-- (006's step 3) — explicitly not this pass.
-- ══════════════════════════════════════════════════════════════════════
alter table initiatives add column if not exists team_id text references teams (id);
-- Loosening a NOT NULL is safe to re-run against existing rows (never fails,
-- unlike tightening one) — every initiative keeps its legacy `team` value
-- until the backfill script sets `team_id`, and the app switches reads over.
alter table initiatives alter column team drop not null;
alter table initiatives add column if not exists strategic_objective_id text
  references strategic_objectives (id);
-- owners.team was already nullable — no constraint change needed here.
alter table owners add column if not exists team_id text references teams (id);

-- ── Public projection for the external roadmap page ──
-- Approved (external), non-archived items only, with internal-only fields
-- (notes, DIVE inputs, health, owner) stripped out. Owned by postgres so it
-- bypasses RLS on `initiatives` — safe because it only ever selects external
-- rows. Selects `team_id` (not the legacy `team`) per Heron Week 1's
-- unification — confirmed no consumer (fetchExternalRoadmap()/
-- PublicInitiative in lib/data.ts, ExternalRoadmap.tsx) ever read `team` off
-- this view, so this is a clean column-list swap, not a breaking change.
--
-- `create or replace view` can change a column's expression but NOT its name
-- or position — on any database where this view already exists with its old
-- column named `team` (i.e. beakon-prod, which is never dropped/rebuilt),
-- the `create or replace view` below would fail with Postgres error 42P16
-- ("cannot change name of view column ... to ...") without renaming that
-- column first. Guarded so it's a no-op on a fresh database (view doesn't
-- exist yet) and on any database where the rename has already happened —
-- see supabase/migrations/2026-08-heron-team-strategic-objective-backfill.sql's
-- "Part A0" for the incident this guards against, and
-- supabase/README.md's golden-rule section for why this pattern (not a bare
-- rename) belongs directly in schema.sql.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'external_roadmap'
      and column_name = 'team'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'external_roadmap'
      and column_name = 'team_id'
  ) then
    alter view external_roadmap rename column team to team_id;
  end if;
end $$;

create or replace view external_roadmap as
select
  i.id, i.title, i.summary, i.expected_outcome, i.status,
  i.team_id, i.theme_id, i.target_start, i.target_end, i.position
from initiatives i
where i.visibility = 'external' and i.archived = false
order by i.position;

-- Grant moved here (from the RLS section above) since it targets this view —
-- must run after the view exists, which on a fresh database it now does only
-- from this point on.
grant select on external_roadmap to anon, authenticated;

-- ── OKRs ──
create table if not exists okrs (
  id text primary key,
  title text not null,
  strategic_objective_id text not null references strategic_objectives (id),
  team_id text references teams (id),
  business_unit_id text references business_units (id),
  year smallint not null,
  quarter smallint not null check (quarter between 1 and 4),
  deliverable_detail text not null default '',
  governance_status okr_governance_status not null default 'draft',
  okr_class okr_class,
  target_date date,
  achievement numeric check (achievement >= 0 and achievement <= 1),
  health initiative_health not null default 'on_track',
  notes text not null default '',
  carried_from_id text references okrs (id),
  archived boolean not null default false,
  position double precision not null default 0,
  updated_at timestamptz not null default now(),
  check (team_id is not null or business_unit_id is not null)
);
create index if not exists okrs_quarter_idx on okrs (year, quarter, team_id);

drop trigger if exists okrs_touch_updated_at on okrs;
create trigger okrs_touch_updated_at
  before update on okrs
  for each row execute function touch_updated_at();

-- ── Ownership + initiative links ──
create table if not exists okr_owners (
  okr_id text not null references okrs (id) on delete cascade,
  owner_id text not null references owners (id),
  role text not null default 'contributor',
  primary key (okr_id, owner_id)
);

create table if not exists okr_initiatives (
  okr_id text not null references okrs (id) on delete cascade,
  initiative_id text not null references initiatives (id) on delete cascade,
  primary key (okr_id, initiative_id)
);

-- ── delivery_links: allow linking to an OKR instead of an initiative ──
-- Not yet used by lib/data.ts (DeliveryLink needs a discriminated-union
-- tweak first — Week 3 write-UI task). Existing rows are unaffected:
-- initiative_id is already set on all of them, okr_id is null, so the
-- one-parent constraint holds.
alter table delivery_links add column if not exists okr_id
  text references okrs (id) on delete cascade;
alter table delivery_links alter column initiative_id drop not null;
do $$ begin
  alter table delivery_links add constraint delivery_links_one_parent
    check ((initiative_id is not null) <> (okr_id is not null));
exception when duplicate_object then null; end $$;

-- ── Check-ins + flags (schema only — no data-access/UI this sprint, Phase 2) ──
create table if not exists okr_checkins (
  id text primary key,
  okr_id text not null references okrs (id) on delete cascade,
  checked_in_at date not null default current_date,
  achievement numeric check (achievement >= 0 and achievement <= 1),
  health initiative_health,
  confidence text check (confidence in ('high', 'medium', 'low')),
  narrative text not null default '',
  author_id text references owners (id),
  created_at timestamptz not null default now()
);
create index if not exists okr_checkins_okr_idx on okr_checkins (okr_id, checked_in_at desc);

create table if not exists okr_flags (
  id text primary key,
  okr_id text not null references okrs (id) on delete cascade,
  kind text not null check (kind in ('dependency', 'risk', 'support')),
  severity text not null default 'minor' check (severity in ('none', 'minor', 'critical')),
  description text not null default '',
  owning_team_id text references teams (id),
  needed_by date,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Row Level Security — same open pattern as every existing table
-- (decision #5 — no role gate yet) ──
alter table business_units       enable row level security;
alter table teams                enable row level security;
alter table strategic_objectives enable row level security;
alter table okrs                 enable row level security;
alter table okr_owners           enable row level security;
alter table okr_initiatives      enable row level security;
alter table okr_checkins         enable row level security;
alter table okr_flags            enable row level security;

do $$ begin
  create policy "authenticated full access" on business_units
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on teams
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on strategic_objectives
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on okrs
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on okr_owners
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on okr_initiatives
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on okr_checkins
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated full access" on okr_flags
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════════════
-- persist_okr(): transactional upsert + owner/initiative-link replace
-- ══════════════════════════════════════════════════════════════════════
-- Added Sprint Chickadee Week 2 (also in
-- supabase/migrations/2026-08-persist-okr-rpc.sql — see that file for the
-- full rationale, security-invoker decision, error-shape decision, and
-- manual test plan). lib/data.ts's persistOkr() used to run upsert(okr) ->
-- delete okr_owners -> insert owners -> delete okr_initiatives -> insert
-- links as four separate, non-transactional Supabase calls; a failure
-- partway through (e.g. a duplicate (okr_id, owner_id) primary-key
-- violation) left the deletes committed with no replacement rows. Wrapping
-- all of it in one plpgsql function body makes it one transaction: any
-- exception rolls back everything that ran before it. `security invoker`
-- (the default, stated explicitly here) keeps this RLS-compatible with the
-- "authenticated full access" policies above — no privilege escalation.
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
  p_owners jsonb,          -- array of {"owner_id": text, "role": text}
  p_initiative_ids text[]
) returns void
language plpgsql
security invoker
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
    title                   = excluded.title,
    strategic_objective_id  = excluded.strategic_objective_id,
    team_id                 = excluded.team_id,
    business_unit_id        = excluded.business_unit_id,
    year                    = excluded.year,
    quarter                 = excluded.quarter,
    deliverable_detail      = excluded.deliverable_detail,
    governance_status       = excluded.governance_status,
    okr_class               = excluded.okr_class,
    target_date             = excluded.target_date,
    achievement             = excluded.achievement,
    health                  = excluded.health,
    notes                   = excluded.notes,
    carried_from_id         = excluded.carried_from_id,
    archived                = excluded.archived,
    position                = excluded.position;

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

revoke execute on function persist_okr(
  text, text, text, text, text, smallint, smallint, text, okr_governance_status,
  okr_class, date, numeric, initiative_health, text, text, boolean, double precision,
  jsonb, text[]
) from public;

grant execute on function persist_okr(
  text, text, text, text, text, smallint, smallint, text, okr_governance_status,
  okr_class, date, numeric, initiative_health, text, text, boolean, double precision,
  jsonb, text[]
) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Roadmaps (Sprint Heron Week 2) — unified List/Board/Timeline saved view.
-- See docs/decisions/008-roadmap-entity-visibility-model-and-okr-separation.md
-- and docs/plans/heron-week-2-unified-roadmap-view.md §2a. This is the app's
-- first per-user-owned, RLS-scoped object: sharing is owner-controlled
-- (private / shared-view-only / shared-editable), and exactly one
-- system-owned, non-deletable "General Roadmap" always exists (seeded below
-- in seed.sql/seed_prod.sql, id = 'roadmap-general').
-- ══════════════════════════════════════════════════════════════════════

-- `current_owner_id()` — matches the signed-in JWT's email against `owners`,
-- the same email-match lib/store.tsx's client-side `currentOwner` already
-- does, now available server-side for RLS/RPC use. This is the app's first
-- per-user-scoped RLS — this helper is the seam any future per-user feature
-- should reuse, not a one-off written just for Roadmaps.
create or replace function current_owner_id() returns text
language sql
security invoker
stable
as $$
  select id from owners where email = (auth.jwt() ->> 'email') limit 1;
$$;

revoke execute on function current_owner_id() from public;
grant execute on function current_owner_id() to authenticated;

create table if not exists roadmaps (
  id text primary key,
  owner_id text references owners (id),        -- null only for the system row
  name text not null,
  view_mode text not null default 'list' check (view_mode in ('list', 'board', 'timeline')),
  filters jsonb not null default '{}'::jsonb,
  group_by text not null default 'theme' check (group_by in ('theme', 'team', 'owner')),
  zoom text not null default 'month' check (zoom in ('month', 'quarter', 'half')),
  zoom_scale numeric not null default 1,
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  timeline_sort jsonb,                          -- { key, dir } or null
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  editable boolean not null default false,       -- meaningful only when visibility = 'shared'
  is_system boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roadmaps_system_owner_check
    check ((is_system and owner_id is null) or (not is_system and owner_id is not null))
);

drop trigger if exists roadmaps_touch_updated_at on roadmaps;
create trigger roadmaps_touch_updated_at
  before update on roadmaps
  for each row execute function touch_updated_at();

alter table roadmaps enable row level security;

-- SELECT/DELETE/INSERT only — deliberately no UPDATE policy. All updates to
-- filters/groupBy/viewMode/etc. route through persist_roadmap() below,
-- which runs `security invoker` (still RLS-subject for the reads it does
-- internally) but keeps the real owner/editable/system authorization logic
-- in the function body rather than a using/with check boolean (ADR 008
-- decision 1) — the same reasoning persist_okr() already established for
-- "authorization too conditional for plain RLS."
do $$ begin
  create policy "select own shared or system roadmaps" on roadmaps
    for select to authenticated
    using (owner_id = current_owner_id() or visibility = 'shared' or is_system = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "delete own non-system roadmaps" on roadmaps
    for delete to authenticated
    using (owner_id = current_owner_id() and is_system = false);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insert own roadmaps" on roadmaps
    for insert to authenticated
    with check (owner_id = current_owner_id());
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════════════
-- persist_roadmap(): the only path that updates an existing Roadmap's
-- display fields. See supabase/migrations/2026-08-persist-roadmap-rpc.sql
-- for the full rationale, matching persist_okr()'s documentation
-- convention, and the manual test plan.
-- ══════════════════════════════════════════════════════════════════════
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
    -- Creating a brand-new Roadmap (no existing row with this id yet).
    -- Nobody creates `is_system` rows through the app — the one System row
    -- is seed-only — so every insert here is a normal user-owned Roadmap,
    -- and the caller must be its own owner (mirrors the "insert own
    -- roadmaps" RLS policy a direct table insert would also enforce).
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
    -- ADR 008 decision 2: nobody — not even an "owner," since the System
    -- row has none — updates the System row's display fields through this
    -- function. Its view_mode/filters/etc. stay at their seeded defaults;
    -- per-user view-mode switching on it is client-only state.
    raise exception 'persist_roadmap: the System Roadmap cannot be updated';
  end if;

  if v_existing.owner_id = v_caller then
    -- Full write, including reassigning owner_id/visibility/editable/name —
    -- ownership transfer isn't getting a UI this week, but the RPC doesn't
    -- structurally block it (plan §2a / ADR 008).
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
    -- Deliberate silent-ignore, not an error: an editor's client can only
    -- ever change the view-shaping fields below. owner_id/name/visibility/
    -- editable/position stay pinned to whatever is already in the DB row
    -- regardless of what the caller passed for them — sharing settings are
    -- always owner-only, never delegable to an editor (ADR 008 decision 1).
    -- A shared-editable client resubmitting its last-known name/visibility
    -- unchanged is the common case this is built for, not a hostile one.
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
