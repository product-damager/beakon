# Spec Delta: sharing-and-auth

## ADDED Requirements

### Requirement: No anonymous access to owners
Anonymous callers SHALL NOT read any owner record: no names, job titles, teams or email addresses. Signed-in users keep full access to owners.

#### Scenario: Anon queries owners
- **WHEN** an anonymous caller queries owners
- **THEN** the database returns no owner data

#### Scenario: Signed-in user sees owners
- **WHEN** a signed-in teammate opens the workspace
- **THEN** owner names still appear on initiatives, OKRs and pickers

#### Scenario: Share page unaffected
- **WHEN** an anonymous visitor opens /share
- **THEN** the page loads as before (it never displayed owners)

### Requirement: Anonymous read of the share projection
Anonymous callers SHALL be able to read, for external non-archived initiatives only, the id, title, status, theme, target start and target end, through the external roadmap projection, which applies the caller's own rights. No other initiative field SHALL be readable anonymously, by the projection or directly; filter and sort columns needed by the projection are the only exception (inferred design choice).

#### Scenario: Anon reads the external projection
- **WHEN** an anonymous caller queries the external roadmap projection
- **THEN** it receives only external, non-archived initiatives, with id, title, status, theme id, target start and target end

#### Scenario: Internal initiative stays hidden
- **WHEN** an anonymous caller queries initiatives directly or through the projection
- **THEN** no internal or archived initiative is returned

#### Scenario: Internal fields stay hidden
- **WHEN** an anonymous caller asks for an external initiative's summary, notes, DIVE inputs, owner, team or health
- **THEN** the database refuses or returns none of them

#### Scenario: Share page for anonymous visitors
- **WHEN** a signed-out visitor opens /share and some initiatives are external
- **THEN** the timeline shows them with title, status, theme and dates, as before

### Requirement: Anonymous read of themes
Anonymous callers SHALL be able to read themes (id, name, description, colour) so /share can label and colour its groups, and SHALL NOT write them.

#### Scenario: Anon reads themes
- **WHEN** an anonymous caller queries themes
- **THEN** it receives every theme

#### Scenario: Anon writes a theme
- **WHEN** an anonymous caller tries to create or change a theme
- **THEN** the database refuses it

### Requirement: Internal database functions not callable through the API
Functions that exist only to run as database triggers (the company-domain signup check and the automatic row-level-security enabler) SHALL NOT be callable by anonymous or signed-in callers through the API, and SHALL keep firing as triggers.

#### Scenario: Anon calls the signup check
- **WHEN** an anonymous or signed-in caller tries to invoke either function through the API
- **THEN** the call is refused (not exposed, or "permission denied") and the database reports that neither role holds execute rights on it

#### Scenario: Signup check still enforced
- **WHEN** someone requests a magic link with an email outside the company domain and allow-list
- **THEN** no account is created

#### Scenario: New tables still get row-level security
- **WHEN** a table is created in the public schema
- **THEN** row-level security is enabled on it automatically

### Requirement: Security advisor clean
The Supabase security advisor SHALL report no security-definer views, no security-definer functions callable by anonymous or signed-in users, and no function with a mutable search path, on both beakon-preview and beakon-prod. The leaked-password-protection warning is accepted: Beakon has no passwords.

#### Scenario: Advisor after release
- **WHEN** the security advisor runs on beakon-prod after this change
- **THEN** its only security finding is leaked-password protection

## MODIFIED Requirements

### Requirement: No anonymous access to workspace tables
Anonymous callers SHALL NOT read or write initiatives, delivery links, business units, teams, strategic objectives, OKRs, OKR owners, OKR–initiative links, check-ins, flags, saved roadmaps or saved OKR views directly; row-level rules on those tables admit signed-in users only.

#### Scenario: Anon reads OKRs
- **WHEN** an anonymous caller queries the OKR tables
- **THEN** it receives no rows

#### Scenario: Anon has no table privileges
- **WHEN** the database's grants are inspected
- **THEN** the anonymous role holds no privilege on workspace tables or views other than the initiative columns, themes and the external roadmap projection listed in this spec

#### Scenario: Future table
- **WHEN** a new table is added to the public schema
- **THEN** the anonymous role gets no privilege on it unless the change that adds it grants one explicitly

### Requirement: Projections are read-only
Anonymous and signed-in callers SHALL never insert, update or delete through the external roadmap and initiative score projections; anon reads only the external roadmap, signed-in users read both. Both projections SHALL apply the caller's own rights and row-level rules, never their creator's.

#### Scenario: Anon write refused
- **WHEN** an anonymous caller sends an update or delete to either projection
- **THEN** the database refuses it with "permission denied"

#### Scenario: Share page still reads
- **WHEN** an anonymous visitor opens /share
- **THEN** the external roadmap projection is still readable and the page loads

#### Scenario: Scores for signed-in users
- **WHEN** a signed-in teammate queries the initiative score projection
- **THEN** it returns scores for the initiatives their row-level rules allow, which today is all of them

## REMOVED Requirements

### Requirement: Anonymous read of the share projection (baseline 2026-10-30)
**Reason**: Replaced by "Anonymous read of the share projection": the projection now applies the caller's rights and returns only the fields /share displays (summary, expected outcome, team and position are dropped).
**Migration**: Nothing in the app reads the dropped columns; an outside reader must use title, status, theme id and dates only.

### Requirement: Anonymous read of reference data and scores (baseline 2026-10-30)
**Reason**: Split into "No anonymous access to owners" and "Anonymous read of themes"; the score read was already revoked by the 2026-10-30 hotfix.
**Migration**: None for the app; /share only reads themes.

### Requirement: Exposed functions and mutable search paths (baseline 2026-10-30)
**Reason**: The gap is closed; replaced by "Internal database functions not callable through the API" and "Security advisor clean".
**Migration**: None.
