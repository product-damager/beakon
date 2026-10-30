# Proposal: npm-audit-fix

## Why

Two small follow-ups came out of security-hardening (archived as `2026-10-30-security-hardening`):

- **Transitive advisories in production dependencies.** `npm audit --omit=dev` still reports `source-map-js` (high: event-loop denial of service from crafted source maps) and `baseline-browser-mapping` (moderate). Both come in through `next` and `postcss`, and both are fixable within the current version ranges.
- **Knowledge to write down:**
  - **Stale Purpose:** the `sharing-and-auth` Purpose still says it records anonymous access "so security-hardening has a clear before and after", which is no longer true.
  - **Accepted console error:** every production page logs React error #418. The cause was confirmed on 2026-10-30: Netlify injects an HTML comment into `<head>` on production deploys only, and the PM accepted it as cosmetic. Recording it in a spec stops anyone from re-investigating it.

## What Changes

1. **Run `npm audit fix` without `--force`.** It refreshes 43 entries in `package-lock.json` (42 packages, 15 of them rolldown platform bindings), all patch or minor and within the current ranges, with nothing added or removed. `package.json` is unchanged.
   - It clears all 10 advisories:
     - the 2 production-tree ones: `source-map-js` 1.2.1 → 1.2.2 and `baseline-browser-mapping` 2.10.42 → 2.11.34;
     - 8 in dev tooling, among them `vite` 8.2.2 → 8.3.5, `vitest` 4.1.11 → 4.1.12, `zod` 4.4.3 → 4.6.7, `picomatch`, `brace-expansion` and `js-yaml`.
     - In the production tree, `caniuse-lite` and `nanoid` get routine patch bumps as well.
   - Plain `npm audit fix` is what the PM asked for. The alternative, `npm audit fix --omit=dev`, would leave the dev advisories for later.
2. **Rewrite the `sharing-and-auth` Purpose** so it describes what the spec covers now.
3. **Add a `data-platform` requirement** recording the production-only hydration error #418 caused by Netlify's injected comment: known, accepted, and when it would need reopening.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `data-platform`: adds "Known production-only console error from hosting".
- `sharing-and-auth`: the Purpose text changes. A Purpose isn't a requirement, so it is edited in the main spec during apply, without a delta.

## Field ownership

No field is added or changes owner.

## Out of scope

- Any `--force` or major-version upgrade.
- Removing the Netlify comment. The PM accepted it on 2026-10-30, and no Netlify ticket is planned.
- Moving the Google Fonts `<link>`s to `next/font`. That would clear the lint warning, but it is unrelated.
- Anything for org-2027-configure-launch, which comes next as its own change.

## Impact

- `package-lock.json` only.
- `openspec/specs/sharing-and-auth/spec.md` (Purpose) and `openspec/specs/data-platform/spec.md` (one added requirement).
- No change to the database, to anonymous access, or to the UI.
