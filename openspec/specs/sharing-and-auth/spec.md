# sharing-and-auth Specification

## Purpose
Who can get into Beakon and what anonymous visitors can see. The workspace is limited to Kameleoon teammates through passwordless magic-link sign-in; a curated, read-only public page (/share) shows external initiatives to anyone. This spec also records today's exact anonymous database access, so security-hardening has a clear before and after. Source: ADR 004, ADR 014, schema, Supabase advisors and grants on beakon-prod (checked 2026-10-30).

## Requirements

### Requirement: Magic-link sign-in
In Supabase mode, the workspace SHALL require sign-in by magic link: the user enters an email, receives a one-time link, and opening it signs them in. There SHALL be no passwords.

#### Scenario: Request a link
- **WHEN** a user enters their email on the login screen and clicks "Send magic link"
- **THEN** the screen says to check the inbox and open the link on this device, and offers "Use a different email"

#### Scenario: Unauthenticated workspace route
- **WHEN** a signed-out visitor opens any workspace route (roadmap, OKRs, archived pages)
- **THEN** the login screen is shown in place of the page, without a redirect (inferred)

#### Scenario: Seed mode
- **WHEN** Supabase is not configured
- **THEN** no sign-in is required and the first seed owner acts as the current user (inferred)

### Requirement: Accounts limited to the company domain
Account creation SHALL be rejected by the database for any email that is not on the company domain (@kameleoon.com) and not on the explicit personal allow-list kept in the schema. The check is server-side only; the client only turns the rejection into a friendly message (inferred).

#### Scenario: Outside email
- **WHEN** someone requests a magic link with an email on another domain that is not allow-listed
- **THEN** no account is created and the login screen explains that access is limited to Kameleoon team members and allow-listed guests

#### Scenario: Company email
- **WHEN** a teammate requests a link with an @kameleoon.com email
- **THEN** the account is created and the link signs them in

### Requirement: Open access inside the workspace
Every signed-in user SHALL be able to read and write every initiative, theme, owner, team, business unit, strategic objective, OKR, OKR owner, OKR–initiative link, check-in and flag; there is no role gate (OKR spec decision 5). Saved roadmaps and saved OKR views are the exception: they follow their own sharing rules (see roadmap-views and okr-tracking).

#### Scenario: Any teammate edits any OKR
- **WHEN** a signed-in teammate edits an OKR owned by another squad
- **THEN** the change is saved

### Requirement: Current user resolved by email
The signed-in user SHALL be matched to an owner record by email. The client match is case-insensitive; the server-side match used by row-level rules is exact (inferred). Saving one's profile (name, surname, team, job title) SHALL find or create the owner record for the signed-in email on the server, never trusting an id sent by the client, so one email never yields two owner records.

#### Scenario: First profile save
- **WHEN** a signed-in user with no owner record saves their profile
- **THEN** exactly one owner record is created for their email

#### Scenario: Concurrent first saves
- **WHEN** two first-time profile saves for the same email race
- **THEN** at most one owner record exists afterwards; the losing save fails rather than creating a duplicate

### Requirement: Public share page
The /share page SHALL be reachable without sign-in and SHALL show, read-only, only initiatives that are external and not archived, as a timeline grouped by theme with quarter columns. There is one global share page, not one per roadmap; the sidebar's "External preview" opens it.

#### Scenario: Anonymous visitor
- **WHEN** a signed-out visitor opens /share
- **THEN** they see the external, non-archived initiatives on a timeline, with the footer "internal notes, scores, and owners are never shown here"

#### Scenario: Internal initiative
- **WHEN** an initiative's visibility is internal, or it is archived
- **THEN** it does not appear on /share

#### Scenario: Nothing external
- **WHEN** no initiative is external and active
- **THEN** /share shows "Nothing to show yet"

#### Scenario: Seed mode
- **WHEN** Supabase is not configured
- **THEN** /share shows the seed data's external, non-archived initiatives without any fetch

### Requirement: Fields shown on the share page
For each initiative, /share SHALL display only the title, a public status label (Backlog, Exploring, Designing, In progress, Shipped), the theme and the target start and end dates. It SHALL never display internal notes, DIVE scores, owners, health or team.

#### Scenario: Internal fields hidden
- **WHEN** an external initiative has notes, a DIVE score, an owner and health At risk
- **THEN** /share shows none of them

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
