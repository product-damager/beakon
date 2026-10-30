# Tasks: org-2027-configure-launch

## 1. Data files

- [x] 1.1 Write `supabase/migrations/2026-10-org-2027-configure-launch.sql`: idempotent upserts of `bu-configure-launch` and then `team-finalize-rollout` and `team-assets-creation`, in one transaction, plus a rollback note. Verify it re-runs cleanly twice on beakon-preview.
- [x] 1.2 Add the same rows to `supabase/seed_prod.sql`, `supabase/seed.sql` and `lib/seed.ts` (`BUSINESS_UNITS`, `TEAMS_TABLE`). Verify that the BU and team lists match across the three files.

## 2. Preview → prod

- [x] 2.1 Apply to beakon-preview. Verify:
  - 5 BUs and 13 teams, and the 3 new rows with the right parent;
  - per-team OKR and initiative counts unchanged against the snapshot taken just before;
  - anon still gets 401 on `teams` and `business_units`.
- [x] 2.2 Apply to beakon-prod. Verify the same, plus the 2026-10-30 snapshot:
  - Tech & Perso Builders still has 8 OKRs and 5 initiatives;
  - 13 initiatives still have no team;
  - every other team has 0.

## 3. Checks and review

- [x] 3.1 Run `npm run typecheck`, `npm run lint` (0 errors), `npm run test` and `npm run build`. All pass.
- [x] 3.2 In seed mode (`npm run dev:demo`), verify that the team picker on an initiative and the team-or-BU picker on an OKR list "Finalize & Roll out" and "Assets Creation" under "Configure & Launch".
- [ ] 3.3 qa-engineer pass, covering seed parity and that no existing row moved. dev-lead review: Approved.
- [x] 3.4 `openspec validate org-2027-configure-launch --strict` passes.

## Workflow follow-up

- PR, then check the deploy preview's `/share`, `/roadmap` and `/okrs`. Then merge, archive and summarize.
