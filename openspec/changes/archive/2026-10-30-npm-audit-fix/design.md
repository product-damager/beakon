# Design: npm-audit-fix

## Context

See proposal.md. A dry run on `main` (2026-10-30) gives the facts below.
- `npm audit fix` changed 43 lockfile entries (42 packages, 15 of them rolldown platform bindings), all patch or minor, with nothing added or removed, no semver-major bump and no `package.json` change. The dry run listed 29 because it grouped the platform bindings.
- Four of the changed packages are in the production tree: `source-map-js`, `baseline-browser-mapping`, `caniuse-lite`, `nanoid`.
- `npm ls` shows `source-map-js` and `baseline-browser-mapping` in the production tree, via `next`, `postcss` and `autoprefixer`. They are build-time tools, not shipped to browsers.

## Decisions

### Decision 1: plain `npm audit fix`, not `--omit=dev`
- **Why:** it is one lockfile refresh with every bump inside the declared ranges, so the cost of including the dev fixes (vite, vitest, zod, picomatch…) is the same as leaving them out.
- **What keeps it safe:** the test suite runs on the new vitest, and build plus lint run on the new postcss and browserslist.
- **Alternative:** `--omit=dev` would keep this change to the two production-tree packages and leave 8 dev advisories for later. Rejected as more work later for no risk saved now.

### Decision 2: the Netlify error goes in data-platform as a requirement with a reopen condition
- **Why data-platform:** that spec owns environments and hosting, so its Purpose gains "and hosting" in this change. sharing-and-auth owns access.
- **Why a requirement, not a comment:** the scenario says exactly when the error is the accepted one: production only, the comment present in `<head>`, nothing visibly broken. A future #418 with a different cause still gets investigated.
- **Evidence (2026-10-30):**
  - PR #13's preview runs the same Next 16.4.3 build as production, and has no comment and no error.
  - A local production build reproduces the identical error only when a proxy injects the same comment.

### Decision 3: edit the Purpose directly in the main spec
OpenSpec ignores a `## Purpose` in a delta for an existing capability, so the sharing-and-auth Purpose is edited in `openspec/specs/sharing-and-auth/spec.md` during apply. Archive leaves Purpose sections alone.

## Risks / Trade-offs

- **[Risk] A minor bump of a build tool changes output** (postcss, browserslist and caniuse-lite affect CSS prefixes). → Mitigation: `npm run build`, plus a smoke test of `/share` and the workspace on the Netlify deploy preview.
- **[Risk] vitest 4.1.12 behaves differently.** → Mitigation: run `npm run test` (53 tests) after the fix.

## Migration Plan

Lockfile only. It ships with the normal Netlify deploy after merge. Rollback is reverting the commit.
