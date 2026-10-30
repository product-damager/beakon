# Spec Delta: data-platform

## ADDED Requirements

### Requirement: Known production-only console error from hosting
React hydration error #418 ("server rendered HTML didn't match the client") on production pages SHALL be treated as known and accepted, not as an app defect. It is caused by an HTML comment ("This site is hosted on Netlify…") that Netlify Edge injects into `<head>` on production deploys only; deploy previews and local builds don't get it. Accepted by the PM on 2026-10-30 as cosmetic.

#### Scenario: Error seen on production
- **WHEN** someone sees React error #418 in the browser console on a production page, and the page's served HTML contains the Netlify comment inside `<head>`
- **THEN** it is this known, accepted error and needs no investigation

#### Scenario: Error seen elsewhere
- **WHEN** error #418 appears on a deploy preview or a local build, or on production without the Netlify comment in the served HTML, or with anything visibly broken
- **THEN** it is not this known error and gets investigated as a defect
