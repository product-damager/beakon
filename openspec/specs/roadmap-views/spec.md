# roadmap-views Specification

## Purpose
How initiatives are looked at: one roadmap page with three view modes (Board, Timeline, List), filters and search, and saved roadmaps that a user owns and may share with teammates. Source: roadmap-workspace-v1-spec (views, filtering), ADR 008, 010, 011, code.

## Requirements

### Requirement: Single roadmap page with three view modes
The workspace SHALL open on the roadmap page, which shows the active saved roadmap in one of three view modes, offered in the order Board, Timeline, List. Board SHALL be the default view mode. Old per-view addresses (timeline, board, list) and the root address SHALL redirect to the roadmap page.

#### Scenario: First open
- **WHEN** a signed-in user opens Beakon
- **THEN** the roadmap page shows the General Roadmap in Board mode (unless the user has switched mode on it in this browser session)

#### Scenario: Old link
- **WHEN** someone opens a saved link to the old timeline address
- **THEN** they land on the roadmap page

### Requirement: Board mode
Board mode SHALL show five columns, one per status, in funnel order, each with a count and "No initiatives" when empty. Cards SHALL show theme, title, health, target quarter (from the end date) and an owner quick-edit. Dragging a card to another column SHALL change its status (with a toast); dragging within a column SHALL reorder it. A card cannot be placed above an initiative it depends on in the same column (inferred). Board ignores grouping.

#### Scenario: Drag to change status
- **WHEN** a user drags a card from Solution Framing to In Development
- **THEN** the initiative's status becomes In Development and a toast confirms it

### Requirement: Timeline mode
Timeline mode SHALL show initiatives as bars across time, coloured by status, with a "Today" marker, a count of initiatives and risky initiatives, and a status legend. Dependency lines are not drawn; selecting an initiative highlights its prerequisites (inferred).

#### Scenario: Today marker
- **WHEN** a user opens Timeline mode
- **THEN** a "Today" marker shows the current date across all rows

### Requirement: Timeline arrangement
Timeline rows SHALL be grouped by theme, team or owner, with groups collapsible for the session. Zoom SHALL be month, quarter or half-year, with a zoom scale from 50% to 300%, and density comfortable or compact. Rows within groups SHALL be sortable by start date, DIVE score, status or title, ascending or descending.

#### Scenario: Group by team
- **WHEN** a user groups the timeline by team
- **THEN** each squad gets its own group of rows

### Requirement: Reschedule on the timeline
Users SHALL be able to drag a bar to move it or drag its edges to resize it (minimum one day), which changes the initiative's target dates.

#### Scenario: Reschedule by drag
- **WHEN** a user drags a bar's right edge two weeks later
- **THEN** the initiative's target end moves two weeks later and a toast confirms the reschedule

#### Scenario: Empty timeline
- **WHEN** filters match no initiatives
- **THEN** the timeline shows "No initiatives match" with "Reset filters"

### Requirement: Presentation mode
Timeline mode SHALL offer a "Present" mode that hides the app chrome, shows a "Product roadmap" header with the grouping and the legend, disables dragging, and has an Exit button. It is not saved.

#### Scenario: Present
- **WHEN** a user clicks Present on the timeline
- **THEN** the sidebar and toolbars disappear and bars cannot be dragged, but clicking a bar still opens the initiative

### Requirement: List mode
List mode SHALL show a table with columns Initiative (with an external badge), Owner, Status, Health, Target, Team, DIVE (tier and score) and Updated, sortable by clicking a column header (clicking again reverses), defaulting to DIVE highest first. Status and health are editable inline. Sorting is not saved. List ignores grouping.

#### Scenario: Inline health edit
- **WHEN** a user changes health in a list row
- **THEN** the initiative's health is saved and a toast confirms it

### Requirement: Filters and search
Users SHALL filter initiatives by status, owner, team, theme and visibility. Each filter is multi-select with an "is" / "is not" choice; owner, team and theme lists are searchable; each active filter shows as a removable pill, and "Clear all" resets them. Search SHALL match title, summary, theme name, owner name and team name. Archived initiatives are always excluded (see archive).

#### Scenario: Exclude a team
- **WHEN** a user sets the team filter to "is not" "Assets Creation"
- **THEN** initiatives of that team are hidden in every view mode

#### Scenario: Search by owner
- **WHEN** a user searches for an owner's name
- **THEN** that owner's initiatives are shown

### Requirement: System General Roadmap
Exactly one system roadmap, "General Roadmap", SHALL always exist. It cannot be renamed, shared, deleted or updated by anyone. Filter, grouping, sort and view-mode changes on it apply only to the current user's session and are discarded on switching away, without a prompt.

#### Scenario: Filter on General
- **WHEN** a user filters the General Roadmap and switches to another roadmap
- **THEN** no prompt appears and the General Roadmap keeps its unfiltered definition for everyone

### Requirement: Saved roadmaps
A signed-in user who has an owner record SHALL be able to create a named roadmap. New roadmaps default to Board mode, theme grouping, month zoom and private. The owner can rename, share or delete it; deletion asks for confirmation, warns when the roadmap is shared, and falls back to the General Roadmap if it was active.

#### Scenario: Create
- **WHEN** a user clicks "New roadmap" and enters "Q3 planning"
- **THEN** a private roadmap "Q3 planning" appears first under My views › Roadmaps and becomes active

#### Scenario: Delete a shared roadmap
- **WHEN** the owner deletes a shared roadmap
- **THEN** the confirmation says it is permanently removed and that people it is shared with lose access

### Requirement: Explicit save for what a roadmap means
On a roadmap the user may update, changes to filters, grouping and timeline sort SHALL stay local until the user clicks "Update Roadmap" (overwrite) or "Save as new Roadmap" (create a copy); both buttons appear only when there are unsaved changes. Switching away from a roadmap with unsaved changes SHALL ask "Save & switch" or "Discard & switch".

#### Scenario: Unsaved filter change
- **WHEN** the owner changes a filter on their roadmap and switches to another roadmap
- **THEN** they are asked to save or discard before switching

### Requirement: Display settings save automatically
On a roadmap the user may update, view mode, zoom, zoom scale and density SHALL save automatically onto the roadmap itself, so on a shared editable roadmap the next viewer sees the last editor's choice (inferred consequence of ADR 011).

#### Scenario: View mode change
- **WHEN** the owner switches their roadmap from Board to Timeline
- **THEN** the roadmap opens in Timeline next time without any save action

### Requirement: Roadmap sharing
The owner SHALL set a roadmap to Private, or Shared with either "Can edit" or "View only". Shared roadmaps appear for every signed-in user under "Shared with me", with the owner's name. A "View only" roadmap shows a "View only" tag, no save buttons and a disabled view-mode switcher.

#### Scenario: Shared with me
- **WHEN** a user shares a roadmap as "View only"
- **THEN** every other signed-in user sees it under "Shared with me" with a "View only" tag

### Requirement: Roadmap edit rights enforced by the database
A non-owner on a "Can edit" roadmap SHALL be able to change and save filters, grouping, sort, view mode, zoom and density, but not its name, sharing settings or ownership, and SHALL NOT delete it. The database SHALL enforce these rules regardless of the UI.

#### Scenario: Editor tries to rename
- **WHEN** a non-owner with "Can edit" access attempts to change the roadmap's name or visibility
- **THEN** the name and visibility stay unchanged

#### Scenario: Viewer tries to update
- **WHEN** a non-owner of a "View only" roadmap attempts to save a change
- **THEN** the database refuses it

#### Scenario: Private roadmap
- **WHEN** a roadmap is private
- **THEN** no one but its owner can see it
