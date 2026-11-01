# Tasks

## 1. Tier wording

- [x] 1.1 In `openspec/config.yaml` context, replace the glossary line "tier (T1/T2/T3) = size of the work, used by design and PMM; not in Beakon yet." with the launch-tier definition (T1 Market-moving / high impact, T2 Capability / medium, T3 Enhancement / low; not the size of the work; vault-owned, shown in Beakon). Verify `grep -n "size of the work" openspec/config.yaml` returns nothing and the file still parses (`openspec context --json` succeeds).
- [x] 1.2 Update the tier comments in `lib/types.ts` (3 places, incl. "T1 largest … T3 smallest"), `components/ui.tsx` (`TierTag`) and `components/OkrDrawer.tsx` to the launch-tier wording. Comments only — verify `git diff` shows no change outside comments and `grep -rn "size of the work" lib components app` returns nothing.

## 2. Strategic objective names in code and seeds

- [x] 2.1 In `lib/seed.ts` `STRATEGIC_OBJECTIVES`, set `so-core` to "A trusted platform for every team" and `so-ai` to "AI everywhere, increasingly autonomous"; leave `so-data`, `so-internal`, ids and years. Update the `STRATEGIC_OBJECTIVE_ALIAS` comment in `components/OkrList.tsx` that quotes the old full name (aliases stay "Core"/"AI"). Verify in seed mode (no Supabase env vars, `npm run dev`): the OKR drawer and the objective filter show the new names.
- [x] 2.2 Same two names in `supabase/seed.sql` and `supabase/seed_prod.sql` (strategic objectives block only). Verify `grep -rn "Strengthening our foundations\|Scaling PBX adoption" lib supabase components app` returns only the rollback comment of the new migration (task 3.1).

## 3. Data migration (preview first, then prod)

- [x] 3.1 Add `supabase/migrations/2026-11-objective-names.sql`: header (purpose, link to this change, idempotent, mirrored in seed.sql / seed_prod.sql / lib/seed.ts, preview then prod, rollback statements with the old names), then in one transaction `update strategic_objectives set name = … where id = 'so-core'` and `… where id = 'so-ai'`. Verify by reading: no other table, row or column touched.
- [x] 3.2 Apply to beakon-preview. Verify `select id, name from strategic_objectives order by id` shows the four expected names; run the migration a second time and confirm the result is identical; open the OKR page on preview and check a "Finalize & Roll out" and an "Assets Creation" OKR show the new names and their links/saved views still match. (PM decision 2026-11-01: preview UI check skipped; DB check plus seed-mode UI check are enough.)
- [x] 3.3 Ask the PM for an explicit go, then apply to beakon-prod. Verify with the same select (before and after) and the OKR page on prod; confirm OKR and initiative counts per objective are unchanged (`select strategic_objective_id, count(*) from okrs group by 1` and same for initiatives, before vs after).
- [x] 3.4 Run the Supabase security advisors on preview and prod; verify no new findings compared with before the change.

## 4. Checks and review

- [x] 4.1 Run `python3 scripts/vault-sync/test_vault_sync.py` and a vault-sync `build` (report only, `--current` = a dump of preview rows, nothing applied); verify it reports no strategic-objective changes for existing OKRs (codes still map to the same ids).
- [x] 4.2 `openspec validate objective-names-and-tier-definition --strict` passes.
- [x] 4.3 qa-engineer pass (seed mode and preview: names on drawer, filter, list tooltip, share page if it shows objectives; tier chip unchanged); findings become new tasks.
- [x] 4.4 `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` all pass.

## 5. QA findings

- [x] 5.1 Sort strategic objectives by a fixed id order (so-core, so-ai, so-data, so-internal, unknown ids last by name) after the Supabase load in `lib/data.ts`; verify with `lib/__tests__/strategicObjectiveOrder.test.ts` and a preview check that the first objective by that order is so-core.
- [x] 5.2 Add the okr-tracking requirement "Strategic objective order" (new OKR defaults to the core objective), D4 in design.md with the corrected Context line, and reword the OKR class comment in `components/OkrDrawer.tsx` ("commitment level", not tier); verify `openspec validate --strict` and a comments-only diff for the drawer.

## Workflow follow-up

- Archive after dev-lead approval and the PM's product acceptance.
- After archiving: no vault note needs a content update (quarter OKR notes and `../bu-dashboard/data/okr.json` already use the new names and "Tier n"); check that `02 OKR/2026-Q4 OKR.md` describes tiers the same way.
