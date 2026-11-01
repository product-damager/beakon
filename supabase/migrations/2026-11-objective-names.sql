-- objective-names-and-tier-definition (2026-11-01) — see openspec/changes/objective-names-and-tier-definition/
--
-- Renames two 2026 strategic objectives to the company OKR sheet names. Data
-- only; touches nothing but strategic_objectives.name for these two ids. Ids,
-- OKR/initiative links, saved views and the vault-sync codes (core, ai) are
-- unchanged. so-data and so-internal are left as is.
--
-- Idempotent: re-running sets the same names.
-- Mirrored in supabase/seed_prod.sql, supabase/seed.sql and lib/seed.ts.
-- Applied to beakon-preview first, then beakon-prod.
--
-- Rollback:
--   update strategic_objectives set name = 'Core: Strengthening our foundations' where id = 'so-core';
--   update strategic_objectives set name = 'AI: Scaling PBX adoption' where id = 'so-ai';

begin;

update strategic_objectives set name = 'A trusted platform for every team'      where id = 'so-core';
update strategic_objectives set name = 'AI everywhere, increasingly autonomous' where id = 'so-ai';

commit;
