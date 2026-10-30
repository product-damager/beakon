# Tasks: okr-order-by-key

## 1. Implementation

- [x] 1.1 `lib/okrGrouping.ts`: replace the updated-at sort with the key/id order (natural, numeric-aware compare). Update the unit tests: natural order, synced-before-Beakon-only, and an edit (newer updatedAt) not changing position. Verify `npm run test`.

## 2. Review and release

- [ ] 2.1 Run typecheck, lint (0 errors), test and build. QA and dev-lead review. Deploy preview: `/share`, `/roadmap` and `/okrs` load. `openspec validate okr-order-by-key --strict`.
