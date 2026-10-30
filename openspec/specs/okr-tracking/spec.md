# okr-tracking Specification

## Purpose
Track quarterly OKRs as delivery commitments: one OKR per commitment, owned by a squad (team) or directly by a business unit, tied to a company strategic objective, with a declared achievement, health and governance status, linked to the initiatives that deliver it. In vault terms, a Beakon OKR is a commitment ("We have shipped X...") = okr.json squads[].commitments[]; a Beakon Team is a squad. The measurable layer (objectives with KRs) is not modelled yet. Source: okr-tracking-spec (Part 1 decisions log 2026-08-06), ADR 008, 009, 012, 013, code.

## Requirements

### Requirement: Org structure
Business units, teams and strategic objectives SHALL be records shared by OKRs and initiatives. Every team belongs to one business unit. A strategic objective is company-wide and has a year, a name, a description and an optional sponsor.

#### Scenario: Team under its business unit
- **WHEN** a team is shown in a picker or a grouped list
- **THEN** it appears under its business unit

### Requirement: OKR fields
An OKR SHALL have: title, strategic objective (required), exactly one of team or business unit, year, quarter (1–4), deliverable detail (free text), governance status, OKR class (optional), optional target date, achievement (optional), health, notes, owners, linked initiatives, an archived flag, a sort position and a last-updated time. An OKR MAY reference the OKR it was carried from; there is no UI for carry-over yet (inferred).

#### Scenario: Drawer contents
- **WHEN** a user opens an OKR
- **THEN** the drawer shows title, governance and health in the header, then team or business unit, strategic objective, year and quarter, target date, deliverable detail, achievement, notes, OKR class, owners and linked initiatives

### Requirement: Team or business unit, never both
An OKR SHALL belong to exactly one team or exactly one business unit. Picking one in the combined picker clears the other. The database requires at least one of the two; the UI enforces exactly one (inferred: the repository schema states "at least one", an applied migration states "exactly one").

#### Scenario: Business-unit OKR
- **WHEN** a user picks "Configure & Launch" in the "Business units" section of the picker
- **THEN** the OKR belongs to that business unit and has no team

### Requirement: Create an OKR
Users SHALL create OKRs from a "New OKR" button, which opens a draft with Create OKR. Title, strategic objective and exactly one team or business unit are required. Draft defaults: current year and quarter, the first team, the first strategic objective, governance Draft, health On track, achievement not assessed (inferred defaults). Closing a changed draft asks "Discard this OKR?".

#### Scenario: Missing objective
- **WHEN** a draft has no strategic objective
- **THEN** "Create OKR" is disabled and the drawer says "Choose a strategic objective."

#### Scenario: Created
- **WHEN** a valid draft is created
- **THEN** the toast "OKR created" appears

### Requirement: Edits save automatically
Edits to an existing OKR SHALL save without a Save button: pickers, owners and links save immediately, text fields when they lose focus and only if changed. Saving an OKR with its owners and links is all-or-nothing (see data-platform).

#### Scenario: Inline governance change
- **WHEN** a user changes governance status from a list row
- **THEN** it is saved and a toast says "Governance set to" the new value

### Requirement: Governance status
Governance status SHALL be one of Draft, To validate, Being reviewed, To refine, Validated, Rejected. There is no separate "Discarded" status (decision 4).

#### Scenario: Rejected OKR still displayed
- **WHEN** an OKR is Rejected and has no achievement
- **THEN** it still appears in the OKR list, with achievement "N/A"

### Requirement: OKR class
OKR class SHALL be optional and one of Committed, Conditional, Optional; unset shows as "Not classified". OKR class expresses the level of commitment. It is distinct from tier (T1/T2/T3, the size of the work), which Beakon does not have yet.

#### Scenario: Unclassified
- **WHEN** an OKR has no class
- **THEN** it shows "Not classified"

### Requirement: Declared achievement
Achievement SHALL be a declared delivery assessment entered by people, as a whole percentage from 0 to 100 (stored as 0–1), never computed from linked initiatives. Not assessed SHALL be distinct from 0%: it shows as "N/A" ("Not assessed yet"), and a set value can be cleared with "Mark as not assessed".

#### Scenario: Zero versus not assessed
- **WHEN** one OKR has achievement 0% and another is not assessed
- **THEN** the first shows "0%" and the second shows "N/A"

#### Scenario: Out of range input
- **WHEN** a user enters 140 in achievement
- **THEN** it is stored as 100% (inferred)

#### Scenario: Linked initiatives released
- **WHEN** every initiative linked to an OKR is Released
- **THEN** the OKR's achievement does not change by itself

### Requirement: Health
OKR health SHALL use the same values and order as initiative health: On track, At risk, Blocked, Delayed.

#### Scenario: Health counts on a group
- **WHEN** a business-unit group contains OKRs with different health values
- **THEN** its header shows a count per health value

### Requirement: Owners
An OKR SHALL have any number of owners picked from the owner list, without duplicates. Every owner is stored with the role "contributor"; roles are not shown or editable (inferred).

#### Scenario: All owners used
- **WHEN** every owner is already on the OKR
- **THEN** "Add owner" is disabled

### Requirement: Linked initiatives
An OKR SHALL link to any number of non-archived initiatives. Links are shown, with title and status, only in the OKR drawer.

#### Scenario: Link an initiative
- **WHEN** a user adds an initiative to an OKR
- **THEN** the drawer lists it with its status and an unlink control

### Requirement: Grouped OKR page
The OKR page SHALL show non-archived OKRs grouped by business unit (alphabetical), then within each business unit a "Direct to" block for business-unit OKRs followed by team groups (alphabetical), with an "Unassigned" group last. Business-unit and team groups can be collapsed, individually or all at once. Empty groups are hidden unless explicitly filtered for.

#### Scenario: Business-unit OKR placement
- **WHEN** an OKR belongs directly to "Configure & Launch"
- **THEN** it appears in that business unit's "Direct to" block, above its team groups

#### Scenario: Collapse all
- **WHEN** a user clicks "Collapse all"
- **THEN** every business-unit and team group collapses

### Requirement: OKR filters
Users SHALL filter OKRs by quarter, team, business unit and strategic objective (multi-select; team searchable) and reset with "Clear all". A business-unit filter also matches team OKRs of that business unit. There is no year filter: a quarter filter matches that quarter in any year (inferred). Filters used outside a saved view are remembered in the browser.

#### Scenario: Business-unit filter includes squads
- **WHEN** a user filters on business unit "Configure & Launch"
- **THEN** OKRs of "Finalize & Roll out" and "Assets Creation" are shown along with the business unit's own OKRs

#### Scenario: Reload keeps filters
- **WHEN** a user filters by Q4 and reloads the page without a saved view
- **THEN** the Q4 filter is still applied

### Requirement: Saved OKR views
A user with an owner record SHALL save the current OKR filters and collapsed groups as a named, private view, which becomes active. Changes to an active view stay local until "Update" or "Save as new…". Groups not recorded as collapsed open expanded, including groups that did not exist when the view was saved. There is no system OKR view; the plain "OKRs" entry shows everything.

#### Scenario: New team after saving
- **WHEN** a team is added after a view was saved with some groups collapsed
- **THEN** the new team's group opens expanded in that view

### Requirement: OKR view sharing
The owner SHALL set a view to Private, or Shared with "Can edit" or "View only"; shared views appear to every signed-in user under "Shared with me" with the owner's name. A non-owner with "Can edit" may change the name, filters and collapsed groups, but not sharing, ownership or order, and may not delete it. Only the owner can delete; deletion asks for confirmation. Sharing does not create a link. The database SHALL enforce these rules regardless of the UI.

#### Scenario: Editor changes sharing
- **WHEN** a non-owner with "Can edit" attempts to make a shared view private
- **THEN** the visibility stays unchanged

#### Scenario: Viewer saves
- **WHEN** a non-owner of a "View only" view attempts to save a change
- **THEN** the database refuses it

### Requirement: Check-ins and flags are schema only
The database SHALL hold check-ins (date, achievement, health, confidence high/medium/low, narrative, author) and flags (dependency, risk or support; severity none/minor/critical; owning team; needed-by date; resolved) per OKR, but the app SHALL NOT yet read, write or show them (inferred).

#### Scenario: No check-in UI
- **WHEN** a user opens an OKR
- **THEN** no check-in history or flag is shown

### Requirement: Archive instead of delete
OKRs SHALL be archived, with Undo, rather than deleted (see archive).

#### Scenario: No delete action
- **WHEN** a user looks for a way to remove an OKR
- **THEN** only Archive is offered

### Requirement: 2027 Configure & Launch organisation
The business unit "Configure & Launch" SHALL exist, with its two squads as teams: "Finalize & Roll out" and "Assets Creation". They SHALL be selectable wherever a team or business unit is picked, in every environment (seed mode, beakon-preview, beakon-prod).

#### Scenario: Pick a 2027 squad for an OKR
- **WHEN** a user opens the team-or-business-unit picker on an OKR
- **THEN** "Finalize & Roll out" and "Assets Creation" are listed under "Configure & Launch", and "Configure & Launch" can be picked as a business unit

#### Scenario: Pick a 2027 squad for an initiative
- **WHEN** a user opens the team picker on an initiative
- **THEN** "Finalize & Roll out" and "Assets Creation" are listed under "Configure & Launch"

### Requirement: Earlier org records kept alongside new ones
Business units and teams from an earlier organisation SHALL stay as records alongside newer ones, so work recorded on them keeps its history. Adding business units or teams SHALL NOT by itself reassign any existing OKR, initiative or owner; reassignment happens only through an explicit edit or sync.

#### Scenario: OKR on an earlier team after new org records are added
- **WHEN** new business units or teams are added and an OKR recorded on an earlier team (e.g. "Tech & Perso Builders") is opened
- **THEN** it still belongs to that team

#### Scenario: Team-less initiative after new org records are added
- **WHEN** new business units or teams are added and an initiative had no team before
- **THEN** it still has none until someone, or a sync, assigns one

### Requirement: OKR tier
An OKR SHALL have an optional tier, T1, T2 or T3 (size of the work), shown next to and independent of its OKR class (commitment level). For a vault-managed OKR, tier comes from the vault.

#### Scenario: Tier and class together
- **WHEN** an OKR has tier T1 and class Committed
- **THEN** the drawer shows both, as separate fields

### Requirement: Vault-managed OKR definitions are read-only
For an OKR created from an `okr.json` commitment, the definition fields (title, squad, year, quarter, deliverable detail, strategic objective, tier) SHALL be read-only in Beakon, marked "Managed in the vault", and the database SHALL reject changes to them from signed-in users; governance, achievement, health, class, notes, owners and initiative links SHALL stay editable.

#### Scenario: Record achievement on a synced commitment
- **WHEN** a signed-in user sets achievement to 40% on a vault-managed OKR
- **THEN** it is saved

#### Scenario: Edit a synced commitment's text
- **WHEN** a signed-in user tries to change the title of a vault-managed OKR
- **THEN** the field is not editable, and an update sent directly to the database is refused

### Requirement: OKR table columns and stable order
OKR rows SHALL show Title, Objective, Quarter, Governance, Health, Team (or business unit), Achievement and Updated. Within a group, OKRs SHALL be ordered by commitment key in natural order (fr-1, fr-2 … fr-10) for vault-synced OKRs, followed by Beakon-only OKRs in record-id order; editing an OKR SHALL NOT change its position. There is no user sorting on this page.

#### Scenario: Edit keeps the position
- **WHEN** a user changes the achievement of fr-4
- **THEN** fr-4 stays between fr-3 and fr-5 in its group

#### Scenario: Natural key order
- **WHEN** a group holds commitments ac-1, ac-2 and ac-10
- **THEN** they are listed ac-1, ac-2, ac-10

#### Scenario: Synced before Beakon-only
- **WHEN** a group holds vault-synced and Beakon-only OKRs
- **THEN** the synced ones come first, then the Beakon-only ones by record id
