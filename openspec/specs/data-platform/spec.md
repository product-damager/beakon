# data-platform Specification

## Purpose
Where Beakon's data lives and how it changes: a zero-config demo mode on in-memory seed data, a real mode on Supabase, two separate Supabase projects for preview and production, forward-only schema changes, and how production hosting (Netlify) affects what runs in the browser. Source: ADR 001, ADR 002, supabase/README.md.

## Requirements

### Requirement: Seed mode and Supabase mode
The app SHALL run against Supabase when both the Supabase URL and publishable key are configured, and otherwise SHALL run on built-in seed data held in memory, with no sign-in and no persistence across reloads (inferred for "no persistence").

#### Scenario: No environment configured
- **WHEN** the app starts without Supabase URL or publishable key
- **THEN** the workspace opens directly on seed initiatives, OKRs, teams and objectives, without a login screen

#### Scenario: Supabase configured
- **WHEN** both Supabase settings are present
- **THEN** the workspace loads its data from Supabase and requires sign-in

### Requirement: Feature parity across modes
Every persisted field SHALL exist both in seed data and in the Supabase schema, so behaviour in seed mode matches Supabase mode.

#### Scenario: New field added
- **WHEN** a change adds a persisted field to initiatives
- **THEN** the seed data, the Supabase schema and the preview seed SQL all gain that field in the same change

### Requirement: Two Supabase projects
Beakon SHALL use two separate Supabase projects running the same schema: beakon-preview, holding seed data, used by local development and preview deploys, which may be dropped and reseeded; and beakon-prod, holding real data, which is never dropped or reset. Preview data and production data SHALL never mix.

#### Scenario: Preview deploy
- **WHEN** a branch or preview deploy runs
- **THEN** it reads and writes beakon-preview, never beakon-prod

#### Scenario: Seed data stays out of production
- **WHEN** the demo seed is loaded
- **THEN** it is loaded into beakon-preview only; production gets only its own production seed

### Requirement: Idempotent, forward-only schema changes
The schema SHALL be maintained as a single file that is safe to re-run against a populated database: tables, columns, indexes, types and policies are created only if missing, enum values are added only if missing, and nothing is dropped or reset. Data backfills and one-off non-idempotent steps SHALL live in separate migration files. Every change SHALL be applied and checked on beakon-preview before beakon-prod.

#### Scenario: Re-running the schema
- **WHEN** the schema file is applied twice to the same database
- **THEN** the second run succeeds and changes nothing

#### Scenario: Order of application
- **WHEN** a schema change is ready
- **THEN** it is applied to beakon-preview first, verified, and only then applied to beakon-prod

### Requirement: Transactional multi-row writes
Writes that touch several rows of one object (an OKR with its owners and initiative links, a saved roadmap, a saved OKR view, an owner profile) SHALL succeed or fail as a whole.

#### Scenario: Failure partway through an OKR save
- **WHEN** saving an OKR fails while replacing its owners
- **THEN** the OKR, its owners and its initiative links all stay as they were before the save

### Requirement: Optimistic writes
In Supabase mode, edits SHALL appear immediately in the UI and persist in the background. When a background write fails, the UI SHALL show an error message saying the change may not be saved; the local change is not rolled back (inferred). The owner-profile save is the exception: it waits for the server's answer before updating the UI.

#### Scenario: Failed background write
- **WHEN** a status change on an initiative fails to persist
- **THEN** the user sees an error message and the board still shows the new status until reload (inferred)

### Requirement: Production database matches the repository schema
Every function, view, trigger, policy and grant in the production database SHALL be defined in the repository schema. The automatic row-level-security enabler (`rls_auto_enable()` and its event trigger), present in both projects since before 2026-10-30, is part of the repository schema.

#### Scenario: Unknown function in production
- **WHEN** the production database is inspected and holds a function not defined in the repository schema
- **THEN** that is treated as drift to fix, either by adding it to the schema or removing it from the database

#### Scenario: Fresh project
- **WHEN** the repository schema is applied to a new, empty Supabase project
- **THEN** it gets the same functions, triggers, views, policies and grants as beakon-prod

### Requirement: Known production-only console error from hosting
React hydration error #418 ("server rendered HTML didn't match the client") on production pages SHALL be treated as known and accepted, not as an app defect. It is caused by an HTML comment ("This site is hosted on Netlify…") that Netlify Edge injects into `<head>` on production deploys only; deploy previews and local builds don't get it. Accepted by the PM on 2026-10-30 as cosmetic.

#### Scenario: Error seen on production
- **WHEN** someone sees React error #418 in the browser console on a production page, the page's served HTML contains the Netlify comment inside `<head>`, nothing on the page is visibly broken, and the same commit's deploy preview loads that page without #418
- **THEN** it is this known, accepted error and needs no investigation

#### Scenario: Error seen elsewhere
- **WHEN** error #418 also appears on the deploy preview or a local build of the same commit, or on production without the Netlify comment in the served HTML, or together with anything visibly broken
- **THEN** it is not (only) this known error and gets investigated as a defect
