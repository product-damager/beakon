-- org-2027-configure-launch (2026-10-30) — see openspec/changes/archive/2026-10-30-org-2027-configure-launch/
--
-- Adds the 2027 business unit "Configure & Launch" and its two squads. Data
-- only; touches nothing but these three ids. Existing OKRs, initiatives and
-- owners are NOT moved (PM decision): Q3 work stays on "Tech & Perso Builders"
-- (the squad's 2026 name), team-less initiatives stay team-less until
-- vault-sync assigns them. The rest of the 2026 org is left as is.
--
-- Idempotent: re-running only re-asserts names and the parent BU.
-- Mirrored in supabase/seed_prod.sql, supabase/seed.sql and lib/seed.ts.
-- Applied to beakon-preview first, then beakon-prod.
--
-- Rollback (only while nothing references these ids):
--   delete from teams where id in ('team-finalize-rollout', 'team-assets-creation');
--   delete from business_units where id = 'bu-configure-launch';

begin;

insert into business_units (id, name) values
  ('bu-configure-launch', 'Configure & Launch')
on conflict (id) do update set name = excluded.name;

insert into teams (id, name, business_unit_id) values
  ('team-finalize-rollout', 'Finalize & Roll out', 'bu-configure-launch'),
  ('team-assets-creation',  'Assets Creation',     'bu-configure-launch')
on conflict (id) do update
  set name = excluded.name, business_unit_id = excluded.business_unit_id;

commit;
