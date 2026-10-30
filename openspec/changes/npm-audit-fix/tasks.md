# Tasks: npm-audit-fix

## 1. Dependencies

- [x] 1.1 Run `npm audit fix` (no `--force`) on branch `chore/npm-audit-fix`.
  - Verify that `git diff --stat` shows only `package-lock.json` among tracked files. The local `allowScripts` block in `package.json` stays unstaged.
  - Verify that `npm audit` reports 0 vulnerabilities, and that `npm ls source-map-js baseline-browser-mapping` shows 1.2.2 and 2.11.34.
- [x] 1.2 Run `npm run typecheck`, `npm run lint` (0 errors), `npm run test` (53/53) and `npm run build`. All must pass.

## 2. Specs

- [x] 2.1 Rewrite the Purpose of `openspec/specs/sharing-and-auth/spec.md` so it describes the spec's current coverage, with no reference to "before and after". Verify with `openspec validate --specs --strict`.
- [x] 2.2 `openspec validate npm-audit-fix --strict` passes.

## 3. Review and release

- [x] 3.1 qa-engineer pass. Check the lockfile diff: only semver-compatible bumps, no new packages beyond the dry run, no `package.json` drift. Then check that `/share` renders on the PR's Netlify deploy preview.
- [x] 3.2 dev-lead review against this change; verdict Approved.

## Workflow follow-up

- After the PM's OK: `/opsx:archive npm-audit-fix`, push to the PR, and the PM merges.
