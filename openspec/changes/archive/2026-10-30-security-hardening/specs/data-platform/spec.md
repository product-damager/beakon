# Spec Delta: data-platform

## MODIFIED Requirements

### Requirement: Production database matches the repository schema
Every function, view, trigger, policy and grant in the production database SHALL be defined in the repository schema. The automatic row-level-security enabler (`rls_auto_enable()` and its event trigger), present in both projects since before 2026-10-30, is part of the repository schema.

#### Scenario: Unknown function in production
- **WHEN** the production database is inspected and holds a function not defined in the repository schema
- **THEN** that is treated as drift to fix, either by adding it to the schema or removing it from the database

#### Scenario: Fresh project
- **WHEN** the repository schema is applied to a new, empty Supabase project
- **THEN** it gets the same functions, triggers, views, policies and grants as beakon-prod
