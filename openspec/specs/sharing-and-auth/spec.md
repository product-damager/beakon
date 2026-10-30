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

### Requirement: Anonymous read of the share projection (baseline 2026-10-30)
This and the following baseline requirements record today's anonymous (signed-out, publishable key) database access, gaps included; they are the "before" for security-hardening, not the target state. Anonymous callers SHALL be able to read the external roadmap projection: id, title, summary, expected outcome, status, team id, theme id, target start, target end and position of every external, non-archived initiative.

#### Scenario: Anon reads the external projection
- **WHEN** an anonymous caller queries the external roadmap projection
- **THEN** it receives only external, non-archived initiatives with those ten columns, of which /share displays only title, status, theme and dates

### Requirement: Anonymous read of reference data and scores (baseline 2026-10-30)
Anonymous callers SHALL today be able to read every theme, every owner record (emails included) and the initiative score projection (id and DIVE score of every initiative, internal included; inferred). Owner emails and internal scores are gaps to close in security-hardening.

#### Scenario: Anon reads owners
- **WHEN** an anonymous caller queries owners
- **THEN** today it receives every owner record including email addresses

#### Scenario: Anon reads scores
- **WHEN** an anonymous caller queries the initiative score projection
- **THEN** today it receives a score row for internal initiatives too (inferred)

### Requirement: No anonymous access to workspace tables
Anonymous callers SHALL NOT read or write initiatives, delivery links, business units, teams, strategic objectives, OKRs, OKR owners, OKR–initiative links, check-ins, flags, saved roadmaps or saved OKR views directly; row-level rules on those tables admit signed-in users only.

#### Scenario: Anon reads OKRs
- **WHEN** an anonymous caller queries the OKR tables
- **THEN** it receives no rows

### Requirement: Projections bypass row-level security and accept writes (baseline 2026-10-30)
This gap MUST be treated as a defect to close, not intended behaviour. Both projections (external roadmap, initiative scores) run with their creator's rights, are automatically updatable, and anon holds insert, update and delete grants on them (Supabase advisor and grant inspection on beakon-prod; writes inferred, not exercised).

#### Scenario: Anon edits an external initiative
- **WHEN** an anonymous caller sends an update to the external roadmap projection
- **THEN** today the database does not refuse it on permission grounds and the external initiative can change (inferred)

#### Scenario: Anon deletes through the score projection
- **WHEN** an anonymous caller sends a delete to the initiative score projection
- **THEN** today the database does not refuse it on permission grounds, so any initiative, internal included, can be deleted (inferred)

### Requirement: Exposed functions and mutable search paths (baseline 2026-10-30)
This gap MUST be treated as a defect to close. The company-domain signup check, and a database function not defined in the repository, can be executed by anon and signed-in callers through the API, and seven functions have a mutable search path.

#### Scenario: Advisor run
- **WHEN** the Supabase security advisor is run on beakon-prod
- **THEN** today it reports two security-definer views (error), two security-definer functions executable by anon and by signed-in users, and seven functions with a mutable search path
