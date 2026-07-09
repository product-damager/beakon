-- Beakon roadmap workspace — Postgres schema for Supabase.
-- Run this in the Supabase SQL editor, then run seed.sql.

create type initiative_status as enum ('planned', 'in_progress', 'at_risk', 'done');
create type initiative_visibility as enum ('internal', 'external');
create type initiative_confidence as enum ('low', 'medium', 'high');
create type delivery_link_type as enum ('jira', 'linear', 'notion', 'spec', 'doc', 'other');

create table themes (
  id text primary key,
  name text not null,
  description text default '',
  color text not null default 'green'
);

create table owners (
  id text primary key,
  name text not null,
  role text default ''
);

create table initiatives (
  id text primary key,
  title text not null,
  summary text default '',
  problem text default '',
  expected_outcome text default '',
  status initiative_status not null default 'planned',
  owner_id text references owners (id),
  team text not null,
  theme_id text references themes (id),
  strategic_goal text default '',
  impact int not null default 3 check (impact between 1 and 5),
  effort int not null default 3 check (effort between 1 and 5),
  strategic_fit int not null default 3 check (strategic_fit between 1 and 5),
  urgency int not null default 3 check (urgency between 1 and 5),
  confidence initiative_confidence not null default 'medium',
  target_start date not null,
  target_end date not null,
  depends_on text[] not null default '{}',
  visibility initiative_visibility not null default 'internal',
  notes text default '', -- internal only; never exposed to the external share view
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);

create table delivery_links (
  id text primary key,
  initiative_id text not null references initiatives (id) on delete cascade,
  label text not null,
  url text not null,
  type delivery_link_type not null default 'other'
);

-- Derived priority score = impact + strategic_fit + urgency - effort.
create view initiative_scores as
select id, (impact + strategic_fit + urgency - effort) as priority_score
from initiatives;

-- A safe projection for the external roadmap page: approved items only,
-- with internal-only fields (notes, scores, confidence) stripped out.
create view external_roadmap as
select
  i.id, i.title, i.summary, i.expected_outcome, i.status,
  i.team, i.theme_id, i.target_start, i.target_end
from initiatives i
where i.visibility = 'external' and i.archived = false;

-- ── Row level security (enable when wiring auth) ──
-- alter table initiatives enable row level security;
-- create policy "editors read all" on initiatives for select using (auth.role() = 'authenticated');
-- create policy "editors write" on initiatives for all using (auth.role() = 'authenticated');
-- The external_roadmap view can be exposed to the anon role for the public page.
