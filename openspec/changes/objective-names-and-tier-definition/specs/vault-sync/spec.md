# Spec Delta

## MODIFIED Requirements

### Requirement: Strategic objective for synced commitments
A synced OKR's strategic objective SHALL come from the commitment's `strategic_objective` (core, ai, data, internal); when it is missing, it SHALL default to "A trusted platform for every team" (core) for "Finalize & Roll out" and "AI everywhere, increasingly autonomous" (ai) for "Assets Creation".

#### Scenario: Commitment without strategic objective
- **WHEN** an "Assets Creation" commitment has no `strategic_objective` and the sync runs
- **THEN** its OKR is linked to "AI everywhere, increasingly autonomous"

#### Scenario: Codes unchanged by the rename
- **WHEN** a "Finalize & Roll out" commitment has `strategic_objective: core` and the sync runs after the rename
- **THEN** its OKR is linked to "A trusted platform for every team", the same objective it was linked to before, and the sync reports no change for that field
