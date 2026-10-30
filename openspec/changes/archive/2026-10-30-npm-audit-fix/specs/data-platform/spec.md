# Spec Delta: data-platform

## ADDED Requirements

### Requirement: Known production-only console error from hosting
React hydration error #418 ("server rendered HTML didn't match the client") on production pages SHALL be treated as known and accepted, not as an app defect. It is caused by an HTML comment ("This site is hosted on Netlify…") that Netlify Edge injects into `<head>` on production deploys only; deploy previews and local builds don't get it. Accepted by the PM on 2026-10-30 as cosmetic.

#### Scenario: Error seen on production
- **WHEN** someone sees React error #418 in the browser console on a production page, the page's served HTML contains the Netlify comment inside `<head>`, nothing on the page is visibly broken, and the same commit's deploy preview loads that page without #418
- **THEN** it is this known, accepted error and needs no investigation

#### Scenario: Error seen elsewhere
- **WHEN** error #418 also appears on the deploy preview or a local build of the same commit, or on production without the Netlify comment in the served HTML, or together with anything visibly broken
- **THEN** it is not (only) this known error and gets investigated as a defect
