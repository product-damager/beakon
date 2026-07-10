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

-- ── Reference tables ──
create table if not exists themes (
  id text primary key,
  name text not null,
  description text not null default '',
  color text not null default 'green' -- green | blue | lime | pink | orange | beige
);

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

-- ── Public projection for the external roadmap page ──
-- Approved (external), non-archived items only, with internal-only fields
-- (notes, DIVE inputs, health, owner) stripped out. Owned by postgres so it
-- bypasses RLS on `initiatives` — safe because it only ever selects external rows.
create or replace view external_roadmap as
select
  i.id, i.title, i.summary, i.expected_outcome, i.status,
  i.team, i.theme_id, i.target_start, i.target_end, i.position
from initiatives i
where i.visibility = 'external' and i.archived = false
order by i.position;

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
grant select on external_roadmap to anon, authenticated;

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
