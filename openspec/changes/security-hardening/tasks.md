# Tasks: security-hardening

Probe script: extend the anon REST check used for the hotfix (no-op writes use filters that match no row) with owners, initiatives, themes-write and RPC probes. Run it against preview and prod after each database item.

## 0. Setup

- [x] 0.1 Create branch `fix/security-hardening` from `chore/openspec-baseline` and merge `fix/revoke-view-writes`; verify `git log` shows both branches' commits and `supabase/migrations/2026-10-revoke-view-writes.sql` exists
- [x] 0.2 Create `supabase/migrations/2026-10-security-hardening.sql` with a header (why, link to this change) and verify it exists; each later group appends its own section

## 1. Owner emails not readable anonymously

- [x] 1.1 Add `drop policy if exists "anon read owners"` + `revoke all on owners from anon` to the migration and mirror in `schema.sql` (remove the old anon-owners policy block); verify the file re-runs cleanly twice on preview
- [x] 1.2 Apply to beakon-preview; verify anon `GET owners` returns no owner data, /share renders its 8 initiatives in the browser, and the signed-in app still shows owner names (dev server, as PM or via an `authenticated`-role query)
- [x] 1.3 Apply to beakon-prod; verify anon `GET owners` returns no owner data and anon `GET external_roadmap` returns 200

## 2. Views with caller's rights and a narrow anonymous surface

- [x] 2.1 Add to the migration, in one transaction:
  - initiatives anon column grant + "anon read external initiatives" policy;
  - guarded rebuild of `external_roadmap` (6 columns, `security_invoker = true`, select re-granted to anon and authenticated);
  - `initiative_scores` set to `security_invoker = true`.

  Mirror it in `schema.sql` with the `information_schema` guard. Verify the file re-runs cleanly on preview.
- [x] 2.2 Add the anon table/sequence revoke + re-grants (themes select) and the `alter default privileges for role postgres` revokes (tables, sequences, functions from public) to the migration and `schema.sql`; verify with a `has_table_privilege('anon', …)` listing that anon holds only: select on themes, external_roadmap, and the 9 initiative columns
- [x] 2.3 Apply 2.1–2.2 to beakon-preview. Verify:
  - `GET external_roadmap?select=*` returns 8 rows with exactly id, title, status, theme_id, target_start, target_end;
  - anon `GET initiatives?select=id,title` returns only external active rows;
  - anon `GET initiatives?select=notes` is refused;
  - /share renders in the browser with no console errors;
  - a signed-in query of `initiative_scores` still returns all rows.
- [x] 2.4 Verify on preview that a new table gets no anon grant (create `public._grant_probe`, check `has_table_privilege('anon', …)` is false, drop it)
- [x] 2.5 Apply to beakon-prod; verify anon `GET external_roadmap?select=*` returns 200 (0 rows expected, no error), anon reads of owners / initiatives notes / OKRs return nothing, and the grant listing matches 2.2

## 3. Internal functions not callable through the API

- [x] 3.1 Add `rls_auto_enable()` to `schema.sql` verbatim from beakon-prod, plus a guarded `ensure_rls` event trigger; verify `pg_get_functiondef` on prod matches the file text
- [x] 3.2 Add `revoke execute … from public, anon, authenticated` for `enforce_company_domain()` and `rls_auto_enable()` to the migration and `schema.sql`; verify with `has_function_privilege` for anon and authenticated (both false)
- [x] 3.3 Apply to beakon-preview. Verify:
  - anon `POST /rpc/enforce_company_domain` → permission denied;
  - a magic-link request for a non-company address is still rejected;
  - a probe table created in `public` gets `relrowsecurity = true` (then drop it).
- [x] 3.4 Apply to beakon-prod; verify the two `has_function_privilege` checks and the anon RPC refusal

## 4. Pinned search paths

- [x] 4.1 Add `set search_path = public, pg_temp` to the seven function definitions in `schema.sql` and `alter function … set search_path = public, pg_temp` for each to the migration; verify `schema.sql` re-runs cleanly on preview
- [x] 4.2 Verify on preview that `anon` and `authenticated` lack CREATE on schema `public` (`has_schema_privilege`)
- [x] 4.3 Apply to beakon-preview. Verify `proconfig` shows the setting for all seven functions, and that the app still saves (in the dev server, edit an OKR, save a roadmap view and save the profile with no error banner, or run the equivalent RPC calls as `authenticated`)
- [x] 4.4 Apply to beakon-prod; verify `proconfig` on all seven functions

## 5. Next.js 16.4.3

- [x] 5.1 Upgrade `next` and `eslint-config-next` to 16.4.3; stage only the version hunks of `package.json` plus the lockfile (leave the local `allowScripts` block unstaged); verify `npm ls next` shows 16.4.3 and `npm audit --omit=dev` lists no critical/high Next.js advisory
- [x] 5.2 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`; all pass
- [ ] 5.3 Smoke-test the dev server against preview: /share renders, /roadmap and /okrs load after sign-in, with no console errors

## 6. Review and release

- [ ] 6.1 Run the Supabase security advisor on beakon-preview and beakon-prod; verify the only security finding left is leaked-password protection
- [ ] 6.2 qa-engineer pass (`/qa security-hardening`): try to read or write anything anonymously beyond the spec, using the probe script; findings become new tasks here
- [ ] 6.3 dev-lead review (`/review`) against this change's spec scenarios; verdict Approved
- [ ] 6.4 Update `supabase/README.md` (golden rule) with the new convention: new tables/functions get explicit grants, anon gets nothing by default; verify the section reads correctly
- [ ] 6.5 `openspec validate security-hardening --strict` passes

## Workflow follow-up

- `/release`, then PM product acceptance, then the Netlify deploy of the Next.js upgrade.
- `/opsx:archive security-hardening` merges the deltas into `openspec/specs/sharing-and-auth` and `data-platform`.
- Remove the "security-hardening" memory note once archived.
