# archive Specification

## Purpose
Archiving is the soft delete for initiatives and OKRs: archived items leave the working views but stay restorable on dedicated archive pages. Source: ADR 012 (reversal from inline "Show archived" filters to dedicated pages), code.

## Requirements

### Requirement: Archived items leave the working views
Archived initiatives SHALL be excluded from Timeline, Board, List, the dependency picker, the OKR "Add initiative" picker and the public share page. Archived OKRs SHALL be excluded from the OKR page. There is no "show archived" filter.

#### Scenario: Archive an initiative
- **WHEN** a user archives an initiative from its drawer
- **THEN** the drawer closes, the initiative disappears from Timeline, Board and List, and a toast offers Undo

#### Scenario: Archive an OKR
- **WHEN** a user archives an OKR from its drawer
- **THEN** it disappears from the OKR page and a toast offers Undo

### Requirement: Archived initiatives page
Archived initiatives SHALL be listed on an "Archived" page reachable from the sidebar, with columns Initiative, Owner, Team, Status, Updated, sorted by Updated (newest first) by default, and filtered by the same filters as the active roadmap.

#### Scenario: Filters carry over
- **WHEN** the active roadmap filters on team "Finalize & Roll out" and the user opens Archived
- **THEN** only that team's archived initiatives are listed

### Requirement: Archived OKRs page
Archived OKRs SHALL be listed on a separate archived-OKRs page with sortable columns OKR, Objective, Team, Governance, Updated, newest first by default. This page is not a sidebar entry; both archive pages carry an Initiatives / OKRs switcher in their header.

#### Scenario: Switch archives
- **WHEN** a user is on the Archived page and picks OKRs in the header switcher
- **THEN** the archived OKRs page opens

#### Scenario: Empty archive
- **WHEN** nothing is archived
- **THEN** the page shows "Nothing archived"

### Requirement: Restore
Users SHALL restore an archived initiative or OKR from its archive row or from its drawer; it returns to the working views.

#### Scenario: Restore from row
- **WHEN** a user clicks Restore on an archived initiative's row
- **THEN** a success toast appears and the initiative is back on Timeline, Board and List

### Requirement: No permanent deletion
Archive pages SHALL NOT offer permanent deletion of initiatives or OKRs.

#### Scenario: Archive row actions
- **WHEN** a user hovers an archived row
- **THEN** the only action offered is Restore
