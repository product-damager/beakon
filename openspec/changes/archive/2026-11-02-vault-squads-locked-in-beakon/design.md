# Design

## Context

See proposal.md (Why). Current state, observed in code and data on 2026-11-01:

- `okrs.source` is `'vault'` for synced rows, null otherwise. The trigger `guard_vault_definitions()` (`supabase/schema.sql`, vault-sync section) runs on insert, update and delete for signed-in users only (`current_user = 'authenticated'`). The sync runs as `postgres` and skips it. On insert it forces `source`, `source_key` and `vault_fields` to empty, so every OKR a signed-in user creates is Beakon-only.
- Every OKR save from the app, create or edit, goes through the `persist_okr` RPC: `insert … on conflict (id) do update`. A BEFORE INSERT trigger fires for the proposed row **before** Postgres detects the conflict. So an insert-time check would also see every edit of an existing OKR, synced ones included, as an insert.
- The app loads all OKRs, archived ones included (`select * from okrs`), in Supabase mode; seed mode uses `lib/seed.ts`, where only "Finalize & Roll out" has a synced 2026-Q4 OKR.
- "New OKR" defaults to `teams[0]` (`app/(workspace)/okrs/page.tsx`); the team-or-business-unit picker is `TeamOrBuPicker` in `components/okr-fields.tsx`, also used by the existing-OKR drawer.
- Data in both projects: "Finalize & Roll out" and "Assets Creation" own only synced 2026-Q4 OKRs; no Beakon-only OKR sits on either squad.
- Save failures surface through the store's `reportError` (AppShell error banner).

## Goals / Non-Goals

**Goals:**
- One rule for "vault-managed team", applied identically in the UI (to hide and explain) and in the database (to refuse).
- Synced OKRs keep saving live state exactly as today.

**Non-Goals:**
- Initiatives (proposal, Out of scope).
- Locking business units.
- A team order, or a change to it: "next allowed team" follows the order the app already uses for `teams[0]`.
- Server-side quarter configuration: "current quarter" is the calendar quarter.

## Decisions

### 1. The rule lives in one SQL function and one pure TypeScript function
- **Database**: `vault_managed_team_ids()` returns the team ids that own an OKR with `source = 'vault'` and `year * 4 + quarter >= (current year * 4 + current quarter) - 1` of `current_date`, i.e. the immediately previous quarter, the current one or later (the quarter index makes Q1 → previous Q4 of last year fall out naturally). It is `stable`, `security invoker`, with a fixed `search_path`. Signed-in users can already read every OKR (RLS "authenticated full access"), so invoker rights see the full set. It is used only inside the guard trigger and is not granted to `anon`.
- **App**: `vaultManagedTeamIds(okrs, now)` in `lib/` computes the same set from the OKRs already loaded. `now` is a parameter so tests are deterministic. This works in seed mode with no extra request.
- *Alternative considered*: the app calls the SQL function as an RPC. Rejected: seed mode has no database, it adds a request and a loading state, and the loaded OKRs already contain the answer.
- *Alternative considered*: a `teams.vault_managed` flag written by the sync. Rejected: a second piece of state that can drift from the OKRs. The user asked for a rule derived from data.

### 2. Insert vs update in the guard, so upserts behave
In `guard_vault_definitions()`, for `okrs` only and for signed-in users:
- **INSERT**: after the existing reset of the vault metadata, if `new.team_id` is vault-managed **and no OKR with `new.id` exists yet**, refuse. If the id exists, this is the insert half of `persist_okr`'s upsert: let it through, and the UPDATE branch decides.
- **UPDATE** on a Beakon-only row (`old.source is null`): refuse when `new.team_id is distinct from old.team_id` and `new.team_id` is vault-managed.
- Vault rows (`old.source = 'vault'`) are unchanged: the team is already a guarded vault field.
- Error: errcode `42501`, message `Managed in the vault: OKRs of "<team name>" come from the vault — add the commitment to 02 OKR, then sync`.
- *Deviation from the request, on purpose*: the request said to reject any insert or update of a Beakon-only OKR on those teams. Rejecting every **update** would freeze a Beakon-only OKR that was on a team before the team became vault-managed (none today, but possible when a new squad joins the vault): no achievement, no archive, no move away. Refusing only **moves onto** a locked team has the same protective effect and avoids that. The spec scenario "Beakon-only OKR already on the team before it became vault-managed" records it.
- *Alternative considered*: a separate trigger or a CHECK constraint. Rejected: a CHECK cannot read other rows, and a second trigger would duplicate the `current_user` gate and the upsert subtlety. Extending the existing guard keeps the vault rules in one place.

### 3. UI: hide, explain, default
- `TeamOrBuPicker` takes the set of hidden team ids and a hint string. It hides those teams from the Teams section and shows the hint under the picker whenever at least one team is hidden. The currently selected team still shows as the picker label even if it is hidden, for a legacy Beakon-only OKR.
- The OKR drawer passes the set for new drafts and Beakon-only OKRs. Synced OKRs already show their team read-only and never open the picker.
- The hint is built from the names of the hidden teams, sorted alphabetically (the loaded team order is not stable, QA finding), joined "A and B" ("A, B and C" for more), "is" for one team: with today's data it reads exactly "Assets Creation and Finalize & Roll out are managed in the vault — add the commitment to 02 OKR, then sync."
- `newOkrDraft` picks the first team not in the set; when none is left it leaves the team empty, and the existing "exactly one team or business unit" validation keeps Create disabled.
- Seed mode: same code path. With the seed data only "Finalize & Roll out" is hidden while today's quarter is 2026-Q4.

### 4. Schema delivery
`create or replace function` for both functions in the vault-sync section of `supabase/schema.sql`, which is idempotent. No `supabase/migrations/` file: there is no backfill and nothing non-idempotent. No table, column, index, RLS policy or grant change; anonymous access is unchanged.

Supersedes no earlier decision; extends the vault guard decision of the archived `2026-10-30-vault-sync` change.

## Risks / Trade-offs

- [Quarter rollover gap: new-quarter commitments reach the vault only after the OKR meetings, often mid-January] → Decided with the PM (2026-11-01): the immediately previous quarter also counts, so a squad with synced 2026-Q4 OKRs stays locked through 2027-Q1 until its Q1 commitments are synced. A squad that leaves the vault unlocks only two quarters after its last synced quarter; that is accepted.
- [Clock difference: the database uses `current_date` in UTC, the browser its local date. For a few hours at a quarter boundary the picker and the database can disagree] → The database is the authority. The worst case is a hidden team that the database would accept, or a refused save shown in the error banner.
- [Upsert detection by id existence: a race where two creates use the same new id] → Ids are random client-side; the primary key still rejects a true duplicate.
- [A legacy Beakon-only OKR on a vault-managed team stays outside the source of truth] → None exist today. It can be moved away or archived; it is not deleted or moved automatically.

## Migration Plan

1. Apply the updated `supabase/schema.sql` section to beakon-preview. Verify with SQL as `authenticated` inside a rolled-back transaction: create on a locked team → refused; move a Beakon-only OKR onto it → refused; `persist_okr` on a synced OKR with a new achievement → saved; insert as `postgres` → saved.
2. Check the UI against preview, then run the Supabase security advisor.
3. Apply to beakon-prod only after the PM's explicit go; repeat the read-only checks.
4. Rollback: re-apply the previous `guard_vault_definitions()` body from git and drop `vault_managed_team_ids()`. No data to restore.
