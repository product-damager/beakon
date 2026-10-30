# prioritization-dive Specification

## Purpose
Rank initiatives with DIVE (Demand, Impact, Viability, Effort), a log-calibrated take on RICE: product value is heavy-tailed, so each factor is scored on its real order of magnitude and the product of factors rewards a rare transformative bet instead of flattening it. Scores are shown as coarse tiers to avoid false precision. Source: ADR 003, product overview.

## Requirements

### Requirement: DIVE inputs use fixed scales
An initiative's DIVE inputs SHALL be chosen from fixed scales:
- Demand (accounts reached per month), as band midpoints: 1–5 → 3, 6–25 → 15, 26–100 → 50, 101–500 → 250, 501+ → 1000.
- Impact: Minimal 0.25, Low 0.5, Medium 1, High 3, Massive 10.
- Viability: Hopeful 0.5, Evidence 0.8, Proven 1.
- Effort: person-months, a number of at least 0.5 in steps of 0.5 (inferred: the database only requires effort > 0).

#### Scenario: Out-of-scale value rejected
- **WHEN** a stored initiative is given a demand of 100
- **THEN** the database rejects the write, because 100 is not one of 3, 15, 50, 250, 1000

#### Scenario: Effort floor in the editor
- **WHEN** a user types an effort of 0 in the DIVE editor
- **THEN** the effort is set to 0.5 (inferred)

### Requirement: DIVE score formula
The DIVE score SHALL be (Demand × Impact × Viability) ÷ Effort, rounded to the nearest integer.

#### Scenario: Score computed
- **WHEN** an initiative has demand 250, impact 1, viability 0.8 and effort 1
- **THEN** its DIVE score is 200

#### Scenario: Large bet outweighs a tweak
- **WHEN** initiative A has demand 1000, impact 10, viability 0.5, effort 10 and initiative B has demand 250, impact 0.5, viability 1, effort 1
- **THEN** A scores 500 and B scores 125, so A ranks above B

### Requirement: Unscored is a distinct state
An initiative MAY be unscored. Unscored SHALL be stored as all four inputs empty together, displayed as the tier "Not cast yet", and never treated as a score of zero.

#### Scenario: New initiative without score
- **WHEN** an initiative is created and no DIVE inputs are added
- **THEN** it shows the tier "Not cast yet" and no numeric score

#### Scenario: Adding a score starts from defaults
- **WHEN** a user clicks "Add DIVE score" on an unscored initiative
- **THEN** the inputs are prefilled with demand 250, impact 1, viability 0.8, effort 1 (inferred)

#### Scenario: Clearing a score
- **WHEN** a user clicks "Clear score" on a scored initiative
- **THEN** the initiative returns to "Not cast yet"

### Requirement: Score tiers
The score SHALL be presented as a tier: "Big catch" for a score of 500 or more, "Worth a dive" for 50 to 499, "Surface nibble" below 50, and "Not cast yet" when unscored.

#### Scenario: Tier boundaries
- **WHEN** scores are 500, 499, 50 and 49
- **THEN** their tiers are "Big catch", "Worth a dive", "Worth a dive" and "Surface nibble"

### Requirement: DIVE is internal-only
DIVE inputs and scores SHALL NOT be shown on the public share page.

#### Scenario: External initiative on the share page
- **WHEN** an external, scored initiative is shown on the public share page
- **THEN** neither its tier nor its score nor its inputs are displayed

### Requirement: Sorting by score
Where initiatives can be sorted by score or priority, they SHALL sort by DIVE score with unscored initiatives treated as lower than any score, so they come last in a highest-first sort and first in a lowest-first sort (inferred). The List view SHALL open sorted by priority, highest first (inferred).

#### Scenario: Unscored sink
- **WHEN** the list is sorted by priority, highest first, and contains scored and unscored initiatives
- **THEN** every unscored initiative appears after every scored one

#### Scenario: Default list order
- **WHEN** a user opens the List view
- **THEN** initiatives are sorted by priority, highest first
