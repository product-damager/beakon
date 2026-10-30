# Proposal: security-hardening

## Why

Inspection of beakon-prod on 2026-10-30 showed that anyone holding the public (publishable) key could read every teammate's email address and, until the same-day hotfix, write through two views that bypass row-level security. The Supabase security advisor still reports one error and six warnings, and the deployed Next.js version carries a critical advisory. Beakon is about to hold the BU's OKR live state (vault-sync, measurable-krs), so its anonymous surface has to be exactly what /share needs before more data lands in it.

No vault feature note motivates this; the sources are the Supabase advisor, the grant inspection behind the `sharing-and-auth` baseline ("Anonymous read…" and "Projections…" requirements), and `npm audit`.

**Already done, not part of this change:** the 2026-10-30 hotfix (branch `fix/revoke-view-writes`, `supabase/migrations/2026-10-revoke-view-writes.sql`, applied to beakon-preview then beakon-prod) revoked all write grants on `external_roadmap` and `initiative_scores` and the anonymous read of `initiative_scores`. Verified on both projects: anonymous writes and score reads now fail with `42501 permission denied`, /share still loads.

## What Changes

In this order, which is also the delivery order:

1. **Owner emails no longer readable anonymously.** Remove the anonymous read of `owners` (names, job titles, teams, emails). Nothing signed-out uses it.
2. **Views run with the caller's rights, and anonymous access shrinks to what /share needs.**
   - `external_roadmap` and `initiative_scores` stop bypassing row-level security.
   - /share keeps working for anonymous visitors through a narrow anonymous read of external, non-archived initiatives, limited to the fields /share displays (title, status, theme, dates) plus what is needed to filter and order them. The projection drops summary, expected outcome and team, which /share never displayed. **BREAKING** only for an outside caller reading those columns; the app does not.
   - Anonymous callers keep read access to themes (for /share labels) and lose every other table grant, including on tables created later.
3. **Internal database functions are no longer callable through the API.**
   - The company-domain signup check and `rls_auto_enable()` can no longer be called by anonymous or signed-in callers. Both still fire as triggers.
   - `rls_auto_enable()`, which exists in both projects but not in the repo, is added to the repository schema, ending the drift.
4. **Every function pins its search path.** This covers the seven flagged by the advisor.
5. **Next.js 16.2.10 → 16.4.3**, plus eslint-config-next to match. This addresses the critical middleware/proxy-bypass and Server Actions advisories. Beakon has no middleware and no Server Actions today, so exposure is low, but the version stays current. Dev-only `npm audit` findings are out of scope.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `sharing-and-auth`: the anonymous-access requirements change from the recorded "before" (owner emails readable, projections running with creator's rights, internal functions callable) to the hardened state, with /share unchanged for visitors.
- `data-platform`: "Production database matches the repository schema" drops its known-drift note once `rls_auto_enable()` is in the repository schema.

## Field ownership

No field is added or changes owner. This change only alters who can read or call things in Supabase.

## Out of scope

- Who can edit what inside the workspace (any signed-in teammate can still edit everything; formal access model is owned by product leadership).
- Leaked-password protection (the advisor warning): Beakon uses magic links only, no passwords.
- Dev-only `npm audit` findings.
- The vault ↔ Supabase sync, tier field, KRs: vault-sync and measurable-krs.

## Impact

- **Database:** `supabase/schema.sql` (owners policy, both views, row policy and column grants on initiatives, anon table and default grants, function grants, `search_path` on 7 functions, `rls_auto_enable()` and its event trigger), plus a one-off file in `supabase/migrations/` for the view rebuild. Applied to beakon-preview first, then beakon-prod.
- **App:** `package.json` and lockfile (Next.js). No change to `lib/` or `components/` is expected; `fetchExternalRoadmap()` already reads only the columns kept.
- **Anonymous access:** changes, as described in items 1–3. The /share page looks the same.
