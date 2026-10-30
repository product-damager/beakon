# initiatives Specification

## Purpose
The initiative is the primary roadmap object: one canonical record per piece of planned work, with its owner, squad, timeframe, status, health, prioritization, links to delivery tools and dependencies. Source: roadmap-workspace-v1-spec (entities and initiative management), ADR 006, ADR 007, code.

## Requirements

### Requirement: Initiative fields
An initiative SHALL have: title, summary, problem, expected outcome, status, health, owner (optional, shown as "Unassigned"), exactly one team, an optional theme, an optional strategic objective, optional DIVE scores, target start and target end dates, delivery links, dependencies on other initiatives, visibility (internal or external), internal notes, an archived flag, a sort position and a last-updated time.

#### Scenario: Drawer shows the full record
- **WHEN** a user opens an initiative
- **THEN** a side drawer shows title, status and health in the header; timeframe, owner, team, objective, theme and visibility as properties; the summary; and collapsible sections "Links", "Rationale & prioritization" (problem, DIVE, expected outcome) and "Dependencies & notes"

### Requirement: Status funnel
Status SHALL be one of, in order: Backlog, Opportunity Framing, Solution Framing, In Development, Released. Status colours carry meaning on every view.

#### Scenario: New initiative status
- **WHEN** an initiative is created
- **THEN** its status is Backlog

### Requirement: Health
Health SHALL be one of On track, At risk, Blocked, Delayed, and is a live delivery signal separate from DIVE. When sorted by health, the order SHALL be On track, At risk, Blocked, Delayed (PM decision: Delayed sorts last).

#### Scenario: Risk flag
- **WHEN** an initiative's health is At risk, Blocked or Delayed
- **THEN** the timeline marks it with a risk flag and counts it as risky

### Requirement: Team and objective use the shared org tables
An initiative's team SHALL be a real team record (a Kameleoon squad) picked from a list grouped by business unit; an initiative cannot be assigned to a business unit directly. Its strategic objective SHALL be a real strategic objective record or empty.

#### Scenario: Team picker
- **WHEN** a user opens the team picker on an initiative
- **THEN** teams are listed under their business unit and can be searched, and no business unit is selectable on its own

### Requirement: Create an initiative
Users SHALL create initiatives from a "New initiative" button that opens the drawer in draft mode with Cancel and "Create initiative". The title SHALL be required and the end date SHALL be on or after the start date before creation is allowed. A created initiative goes to the top of the order.

#### Scenario: Missing title
- **WHEN** a user tries to create an initiative with an empty title
- **THEN** "Create initiative" stays disabled and the drawer says "Give the initiative a title."

#### Scenario: Reversed dates
- **WHEN** the end date is before the start date in a draft
- **THEN** creation is blocked with "End date must be on or after the start date."

#### Scenario: Discarding a draft
- **WHEN** a user closes a draft with changes
- **THEN** they are asked "Discard this initiative?" with Discard and Keep editing

#### Scenario: Created
- **WHEN** a valid draft is created
- **THEN** the toast "Initiative created" appears with a "View" action

### Requirement: New initiative defaults
A new initiative draft SHALL start with: status Backlog; owner = current user, else the first owner; team = current user's team, else the first team; no theme; no objective; unscored; health On track; start and end = today; visibility internal (inferred).

#### Scenario: Defaults from profile
- **WHEN** a user whose profile team is "Finalize & Roll out" clicks "New initiative"
- **THEN** the draft has that user as owner, "Finalize & Roll out" as team, and internal visibility

### Requirement: Edits save automatically
Edits to an existing initiative SHALL save without a Save button: pickers, dates, links, DIVE and dependencies save immediately; text fields save when they lose focus, and only if changed. In edit mode, a blank title or reversed dates are shown as errors but do not block the save (inferred).

#### Scenario: Change status in the drawer
- **WHEN** a user changes an existing initiative's status in the drawer
- **THEN** the change is saved and the last-updated time moves to now

### Requirement: Delivery links
An initiative SHALL hold any number of labelled links to delivery tools, each typed as Redmine, Figma, Spec, Notion, Jira, Linear or Other; new links default to Redmine and URLs without a scheme get "https://" (inferred). Links with neither URL nor label are dropped on create.

#### Scenario: Add a link
- **WHEN** a user adds a link and types "redmine.kameleoon.net/issues/1"
- **THEN** it is saved as "https://redmine.kameleoon.net/issues/1" with type Redmine

### Requirement: Dependencies without cycles
An initiative MAY depend on other non-archived initiatives. A dependency that would create a cycle SHALL NOT be selectable. An existing initiative SHALL show the non-archived initiatives it blocks.

#### Scenario: Cycle prevented
- **WHEN** A depends on B and a user opens B's dependency picker
- **THEN** A is listed but disabled as "would create a cycle"

### Requirement: Visibility
Each initiative SHALL be internal or external. Only external, non-archived initiatives appear on the public share page (see sharing-and-auth); internal notes are never shown there.

#### Scenario: Make external
- **WHEN** a user sets visibility to External
- **THEN** the drawer hints that the initiative will appear on /share

### Requirement: Themes
A theme SHALL have a name, description and a colour from green, blue, lime, pink, orange, beige. Users MAY create a theme inline from the theme picker. An unknown stored colour SHALL display as green.

#### Scenario: Legacy colour
- **WHEN** a theme's stored colour is not one of the six
- **THEN** it renders as green instead of breaking the view

### Requirement: No hard delete
Initiatives SHALL NOT be hard-deleted from the UI; they are archived instead (see archive).

#### Scenario: Removing an initiative
- **WHEN** a user wants an initiative gone
- **THEN** the only available action is Archive

### Requirement: Undo for archive only
After archiving an initiative, a toast SHALL offer Undo, which restores it. No other initiative action offers undo (inferred).

#### Scenario: Undo archive
- **WHEN** a user archives an initiative and clicks Undo on the toast
- **THEN** the initiative is active again

### Requirement: Activity is a placeholder
The drawer SHALL show an "Activity" area reserved for later, with no history yet.

#### Scenario: Activity section
- **WHEN** a user opens an initiative
- **THEN** the Activity area says it is coming in a later milestone
