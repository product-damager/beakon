# Design: security-hardening

## Context

See proposal.md for motivation. Current state as of 2026-10-30, after the hotfix:

- Every public table has RLS enabled, but Supabase's default grants give `anon` full table privileges on all of them. RLS policies are the only guard. `anon` has select policies on `themes` and `owners` ("anon read …").
- `external_roadmap` and `initiative_scores` are owned by `postgres`, with no `security_invoker`, so they bypass RLS. After the hotfix both are SELECT-only. `anon` can read `external_roadmap` only; `authenticated` can read both.
- `external_roadmap` returns 10 columns. `fetchExternalRoadmap()` (lib/data.ts) maps only id, title, status, theme_id, target_start and target_end, and reads `themes`.
- `enforce_company_domain()` (BEFORE INSERT trigger on `auth.users`) and `rls_auto_enable()` (event trigger `ensure_rls` on `ddl_command_end`) are SECURITY DEFINER. Through the PUBLIC default, both are executable by `anon` and `authenticated`.
  - `rls_auto_enable()` exists on both projects but not in `schema.sql`. Its `search_path` is already pinned to `pg_catalog`.
- Seven functions have no pinned `search_path`: `touch_updated_at`, `enforce_company_domain`, `persist_okr`, `current_owner_id`, `persist_owner_profile`, `persist_roadmap`, `persist_okr_view`.
- `next` is 16.2.10. The app has no middleware/proxy file and no Server Actions.
- beakon-prod has no Supabase migration history. Schema changes are run as SQL (SQL editor / `execute_sql`), preview first.
- beakon-prod has 0 external initiatives and beakon-preview has 8. End-to-end /share checks with data are only possible on preview.

## Goals / Non-Goals

**Goals:**
- Anonymous access equals what /share needs: external rows, displayed columns, themes. Nothing else.
- Security advisor clean apart from leaked-password protection (no passwords in Beakon).
- No visible change for signed-in users or /share visitors.

**Non-Goals:**
- Workspace role model (who may edit what): unchanged, open to every signed-in teammate.
- Changing `authenticated` table grants. Signed-in access stays as it is.

## Decisions

### Decision 1: Owners — drop the anon policy and revoke anon grants
`drop policy if exists "anon read owners" on owners;` then `revoke all on owners from anon;`.
- Nothing signed-out reads owners: /share uses `external_roadmap` + `themes` only, and the login screen reads nothing.
- Alternative considered: keep a column-limited anon read (names only). Rejected because no anonymous consumer exists, so any exposure is gratuitous.

### Decision 2: Views use the caller's rights; /share is served by a narrow anon row policy plus column grants
- **Both views** get `security_invoker = true`.
- **`external_roadmap`** is rebuilt with only the displayed columns (id, title, status, theme_id, target_start, target_end), still `order by position`, with `security_invoker = true`.
- **Base table `initiatives`:**
  - `revoke all on initiatives from anon;`
  - `grant select (id, title, status, theme_id, target_start, target_end, position, visibility, archived) on initiatives to anon;`
  - Policy `"anon read external initiatives"`: `for select to anon using (visibility = 'external' and archived = false)`.
  - With `security_invoker`, the invoker needs SELECT on every base column the view references, including WHERE/ORDER BY columns. That's why position, visibility and archived are granted. They only ever cover rows that are already external and active, which is harmless.
- **Why not an RPC:** a SECURITY DEFINER function returning the projection would itself be an anon-executable definer function, so the advisor flags it (lint 0028) and item 3 contradicts it. It also changes client code (`.rpc` instead of `.from`). A SECURITY INVOKER SQL function would need the same grants as the view, so it adds no benefit.
- **Why not keep the definer view with a `security_barrier`:** the advisor error stays, and the view stays one grant away from the original incident.
- **Why drop columns:** the spec limits anonymous reads to displayed fields. Summary and expected outcome are prose PMs may write for internal readers. The column change needs `drop view` + `create view` (Postgres can't remove view columns with `create or replace`). Per supabase/README.md's golden rule, that "breaking" step lives in a guarded block in a one-off migration file, mirrored in `schema.sql` behind an `information_schema` guard, the same pattern as the 2026-08 `team → team_id` rename.
- **`initiative_scores`** only needs `security_invoker = true`. `authenticated` has a full-access policy on `initiatives`, so results are unchanged. Anon has no grant (hotfix).

### Decision 3: Anon table privileges and default privileges
- `revoke all on all tables in schema public from anon;` then re-grant only the following:
  - SELECT on `themes`;
  - the `initiatives` column SELECT from Decision 2;
  - SELECT on `external_roadmap`.
- `revoke all on all sequences in schema public from anon;`
- `alter default privileges for role postgres in schema public revoke all on tables from anon;` and the same for sequences, so a future table never starts readable by anon.
- `alter default privileges for role postgres in schema public revoke execute on functions from public;` so a future function is never callable by anon by default. Existing RPCs already `grant execute … to authenticated` explicitly, so new ones must follow that pattern, which is the existing convention.
- **Why:** RLS stays the primary guard, but this incident showed that an object which bypasses RLS plus default grants is enough to leak. Removing anon grants is the second lock.
- **Alternative considered:** RLS-only, relying on "no policy = no rows". Rejected because it is exactly what failed for views.
- **Limit:** default privileges are set for objects created by `postgres`, which is the role the SQL editor and `execute_sql` use. Objects created by Supabase internals (`supabase_admin`) are not covered. The advisor run after release catches regressions.

### Decision 4: Trigger-only functions — revoke EXECUTE; bring `rls_auto_enable()` into the repo
- `revoke execute on function enforce_company_domain() from public, anon, authenticated;` and the same for `rls_auto_enable()`.
- Trigger and event-trigger functions are not privilege-checked when they fire (the check happens at `create trigger` time), so signup enforcement and auto-RLS keep working.
- `rls_auto_enable()` is added to `schema.sql` verbatim from beakon-prod: SECURITY DEFINER, `search_path = pg_catalog`, enables RLS on new `public` tables.
- Its event trigger `ensure_rls` is created behind an `if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls')` guard. Creating event triggers can need elevated rights on a fresh project, so the guard also catches `insufficient_privilege` and raises a notice instead of failing the whole file.
- **Alternative considered:** drop `rls_auto_enable()`. Rejected because it is useful (no new table can ship without RLS), and Supabase installs it on purpose.

### Decision 5: Pin `search_path = public, pg_temp` in the definitions
- Add `set search_path = public, pg_temp` to the seven function definitions in `schema.sql`. `create or replace function` resets function settings to what the statement says, so an `alter function … set` alone would be undone by the next schema re-run. The migration file also runs `alter function … set search_path = public, pg_temp` so the live databases change without re-running whole definitions.
- **Alternative considered:** `search_path = ''` with fully qualified names. That is stricter but means rewriting every table reference in seven bodies for no extra protection, since `anon` and `authenticated` cannot create objects in `public` (verified as a task).
- **Accepted consequence:** `current_owner_id()` (SQL, used in RLS policies) can no longer be inlined. The tables involved are tiny, so the cost is negligible.

### Decision 6: Next.js 16.4.3
- `npm install next@16.4.3 eslint-config-next@16.4.3 --save-exact` for `next`, keeping the caret style for `eslint-config-next` as today. React is unchanged.
- Low real exposure (no middleware, no Server Actions), but the deploy target is public, so keep it patched.
- `package.json` currently has an uncommitted local `allowScripts` block that must stay out of commits. Stage the version hunks only (`git add -p`).

### Decision 7: Branch and delivery order
- Branch `fix/security-hardening` from `chore/openspec-baseline`, then merge `fix/revoke-view-writes` into it so the hotfix SQL is the base. Both are unpushed local branches.
- Items ship in the proposal's order. Each database item is applied preview → verify → prod → verify before the next starts, so a failure is isolated to one item.
- SQL lives in `supabase/migrations/2026-10-security-hardening.sql` (idempotent, guarded) and is mirrored in `schema.sql`.

## Risks / Trade-offs

- **[Risk] /share breaks while the view switches to invoker before the anon policy exists.** → Mitigation: item 2 runs as one transaction (`begin … commit`) that creates the policy and grants first, then rebuilds the view. Verify on preview (8 external rows) before prod.
- **[Risk] Column grants missing a column the view references** cause `permission denied` for /share. → Mitigation: the preview check uses `select *` exactly as `fetchExternalRoadmap()` does, plus the browser render.
- **[Risk] Revoking anon table grants breaks something signed-out we did not see.** → Mitigation: the only signed-out surfaces are the login screen (no data) and /share. Both are checked on preview.
- **[Risk] Revoking EXECUTE stops the signup check from firing.** → Mitigation: on preview, a magic-link request with a non-company address must still be rejected.
- **[Risk] Revoking EXECUTE stops `ensure_rls` from enabling RLS.** → Mitigation: on preview, create and drop a probe table and check `relrowsecurity`. No company address is used, so no email is sent.
- **[Risk] Next upgrade changes behaviour.** → Mitigation: typecheck, lint, test, build, then a dev-server smoke check of /share, /roadmap and /okrs, then the Netlify deploy preview before merge.
- **[Trade-off] Default-privilege revokes make every future table or function need explicit grants.** Intended. It is the convention already used for RPCs.
- **[Limit] beakon-prod has no external initiatives**, so prod verification of /share proves "reads succeed, nothing leaks", not "rows render". Preview proves rendering.

## Migration Plan

1. Per item, apply the migration section to beakon-preview with `execute_sql`, inside a transaction where noted, then run the verification for that item.
2. Apply the same section to beakon-prod, run the same verification, and run the security advisor.
3. Rollback per item:
   - item 1: re-create the "anon read owners" policy and grant;
   - item 2: `alter view … set (security_invoker = false)` and re-grant the old columns (the dropped columns need the previous view definition, which stays in git history);
   - item 3: re-grant EXECUTE;
   - item 4: `alter function … reset search_path`;
   - item 5: revert `package.json` and the lockfile.
4. Next.js ships through the normal Netlify deploy after PM acceptance.
