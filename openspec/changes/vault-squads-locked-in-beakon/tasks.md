# Tasks

## 1. Vault-managed team rule (app)

- [x] 1.1 Add `vaultManagedTeamIds(okrs, now)` in `lib/` (synced OKRs, archived included, immediately previous quarter, current quarter or later) and a vitest file covering the vault-sync scenarios: this quarter, previous quarter mid-January, two quarters back, Q1 → previous Q4 across the year, later quarter, Beakon-only OKRs ignored; verify with `npm run test`
- [x] 1.2 Add the hint builder (names joined "A and B" / "A, B and C", "is" for one team) with tests asserting the exact two-squad text from the spec; verify with `npm run test`

## 2. Database guard (backend-engineer)

- [x] 2.1 In the vault-sync section of `supabase/schema.sql`, add `vault_managed_team_ids()` (stable, security invoker, fixed search_path, not granted to anon) and extend `guard_vault_definitions()` for `okrs`: refuse a signed-in insert on a vault-managed team when the id does not exist yet, refuse a signed-in update that moves a Beakon-only OKR onto one; verify the file re-runs cleanly (idempotent) and leaves initiatives untouched
- [x] 2.2 Apply to beakon-preview and verify with SQL as `authenticated` in a rolled-back transaction: create on "Finalize & Roll out" refused; move a Beakon-only OKR onto "Assets Creation" refused; `persist_okr` raising achievement on a synced OKR saved; moving a Beakon-only OKR between two unlocked teams saved; a Beakon-only initiative on "Assets Creation" saved; an insert as `postgres` saved
- [x] 2.3 Run the Supabase security advisor on beakon-preview and verify no new warning

## 3. UI (frontend-engineer)

- [x] 3.1 `TeamOrBuPicker`: accept hidden team ids and a hint; hide those teams, keep the selected team as the label, show the hint under the picker when any team is hidden; verify in the browser on a Beakon-only OKR that the squads are not listed and "Configure & Launch" is still pickable as a business unit
- [x] 3.2 OKR drawer: pass the set for new drafts and Beakon-only OKRs only (synced OKRs keep their read-only team); verify that opening a synced OKR is unchanged
- [x] 3.3 `newOkrDraft`: default to the first team not vault-managed, or no team when none is left; add a test and verify "New OKR" in the browser
- [ ] 3.4 Verify in seed mode (no Supabase env vars) and against beakon-preview that the picker, hint and default behave as in the okr-tracking scenarios
- [x] 3.5 product-designer review of the picker hint (placement, wording, truncation); findings become tasks
- [x] 3.6 Design finding: the open dropdown covered the hint — repeat it as a footer row inside the dropdown; verified in the browser (seed mode)
- [x] 3.7 Design finding: validation error rendered under the hint — show "Choose exactly one team or business unit." right under the button, hint after it; typecheck green
- [x] 3.8 Design finding: hint not tied to the vault vocabulary — prefix it with the vault lock icon (aria-hidden); verified in the browser

## 4. Release

- [x] 4.1 qa-engineer pass against the okr-tracking and vault-sync scenarios; findings become tasks
- [x] 4.1a QA finding: hint followed the unstable team load order — hint names sorted alphabetically, spec scenario and design updated; test passes the teams in both orders
- [x] 4.1b QA finding: no test for business-unit-level synced OKRs — added; archived OKRs count by construction (noted in the test)
- [x] 4.1c QA finding: the rule depends on the "authenticated full access" read policy — commented in `supabase/schema.sql`
- [x] 4.2 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`, all green
- [x] 4.3 After the PM's explicit go: apply the schema change to beakon-prod, repeat the 2.2 checks without writing (refusals only, inside rolled-back transactions), and run the security advisor on beakon-prod

## Workflow follow-up

- Archive after dev-lead approval and the PM's product acceptance.
- After archiving: note in `02 OKR/2026-Q4 OKR.md` (or the vault-sync how-to) that new commitments for vault-managed squads go through 02 OKR + sync, and that the lock carries over one quarter while the next quarter's commitments are pending.
