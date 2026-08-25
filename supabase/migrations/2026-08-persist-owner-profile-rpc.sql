-- New RPC — safe to fold into schema.sql directly (same reasoning as
-- 2026-08-persist-roadmap-rpc.sql/2026-08-persist-okr-rpc.sql: this isn't
-- tightening a constraint against existing data, it's a brand-new function
-- with no backward-compat hazard, so `create or replace function` is
-- idempotent on its own). This file is kept as a standalone migration
-- anyway, per the plan's file-layout decision
-- (docs/plans/fix-duplicate-owner-accounts.md), so the change has its own
-- reviewable diff; the identical definition also lives in
-- supabase/schema.sql (right after `current_owner_id()`, immediately before
-- the `roadmaps` table) so a from-scratch bootstrap of a new Supabase
-- project still gets it.
--
-- Why this exists: docs/decisions/014-owner-profile-server-side-upsert.md.
-- `saveProfile` (lib/store.tsx) used to mint a brand-new client-side random
-- id whenever the client's local `owners` array hadn't finished loading
-- yet (plausible right after sign-in, on a slow connection), and the old
-- `persistOwner` (lib/data.ts) did a plain client-driven `upsert` with no
-- server-side email match and no DB constraint — nothing stopped a
-- same-email duplicate `owners` row from landing in production. This
-- happened at least twice in beakon-prod before this fix.
--
-- `persist_owner_profile(p_name, p_surname, p_role, p_team_id)` —
-- deliberately no `p_id` parameter. The id is decided server-side (the
-- existing row's id on update, a freshly minted one on insert), never
-- trusted from the client — that's what actually closes the race: the
-- client no longer decides "is there already a row for me," the DB does,
-- inside one statement, against the JWT's own email, so nothing
-- client-observable can be stale.
--
-- Atomicity: the `update ... where lower(email) = lower(v_email)` runs
-- first, and the `insert` only happens `if not found`, inside one function
-- body. Under Postgres's default read-committed isolation, two concurrent
-- calls for the same brand-new email could theoretically both miss the
-- `update` and both `insert` — that's an existing, accepted residual race;
-- `owners_email_unique_idx` (the unique index added alongside this RPC in
-- schema.sql, on `lower(email) where email is not null`) is the actual
-- backstop for that last-mile case: the second concurrent `insert` would
-- fail with a unique-violation instead of silently creating a duplicate.
-- The RPC removes the client-staleness cause; the index removes the
-- last-mile DB race.
--
-- Case-insensitive match (`lower(...)`) is a deliberate tightening over
-- today's code — worth calling out because it's new behavior at the DB
-- layer, not just a port. It matches the same assumption
-- `currentOwner`'s own `.toLowerCase()` compare (lib/store.tsx) already
-- makes client-side.
--
-- security invoker (not definer): matches current_owner_id()'s/
-- persist_roadmap()'s own reasoning — this only ever touches `owners`,
-- which the `authenticated` role already has RLS-backed full read/write
-- access to (see the "authenticated full access" policy on `owners`).
-- Running as invoker means the function executes with the calling user's
-- own privileges — no privilege escalation, no new anon attack surface.
--
-- ── Constraint-ordering hazard (read before applying to beakon-prod) ──
-- `owners_email_unique_idx` (schema.sql, added in the same commit as this
-- RPC) will FAIL to apply to a database that still has duplicate-email
-- rows in `owners` — Postgres cannot build a unique index over existing
-- duplicate values. As of this migration, the PM has already manually
-- deleted beakon-prod's known duplicate rows (confirmed zero FK references
-- existed before deleting, so no repoint was needed), so applying the
-- updated schema.sql to beakon-prod is expected to succeed. If this ever
-- fails on a re-run against prod in the future, that means a NEW
-- duplicate-email pair has appeared since — investigate and clean it up
-- the same way before re-applying, don't drop or weaken the index.
--
-- Manual test plan (no live DB access in this session — someone with
-- beakon-preview access needs to run this):
--   1. Apply this file's function body (and the owners_email_unique_idx
--      index) in the beakon-preview SQL editor, or re-run all of
--      schema.sql, which now includes both.
--   2. First-time save: as a signed-in user with no existing `owners` row
--      for their email, call persist_owner_profile with a name/surname/
--      role/team_id. Confirm it returns a new row with a freshly minted
--      `u-xxxxxxx` id, and that a second `select * from owners where
--      email = '<that email>'` shows exactly one row.
--   3. Existing-user update: as a signed-in user who already has an
--      `owners` row, call persist_owner_profile with a changed name/role.
--      Confirm it returns the SAME id as before, with the updated fields,
--      and no second row was created.
--   4. Case sensitivity: confirm a row with email 'Person@Example.com'
--      matches a JWT email of 'person@example.com' (update path, not a
--      second insert).
--   5. Duplicate-insert-attempt: manually try
--      `insert into owners (id, name, email) values ('u-test1', 'x',
--      'someone@already-has-a-row.example')` for an email that already has
--      a row — confirm it fails with a unique-violation on
--      owners_email_unique_idx, proving the index is live.
--   6. Race simulation (approximates the plan's checklist item 5b): open
--      two browser sessions signed in as a brand-new email with no prior
--      `owners` row, and fire `saveProfile` from both before either
--      request lands (e.g. via the Settings form, or by calling the RPC
--      directly from two SQL editor tabs at once). Confirm at most one
--      `owners` row exists afterward for that email (the loser hits the
--      unique-violation, matching the "residual race, index backstops it"
--      note above).

create or replace function persist_owner_profile(
  p_name text,
  p_surname text,
  p_role text,
  p_team_id text
) returns owners
language plpgsql
security invoker
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_row owners%rowtype;
begin
  if v_email is null then
    raise exception 'persist_owner_profile: no authenticated email';
  end if;

  update owners set
    name = p_name,
    surname = p_surname,
    role = p_role,
    team_id = p_team_id
  where lower(email) = lower(v_email)
  returning * into v_row;

  if found then
    return v_row;
  end if;

  insert into owners (id, name, surname, role, email, team_id)
  values ('u-' || substr(md5(random()::text || clock_timestamp()::text), 1, 7),
          p_name, p_surname, p_role, v_email, p_team_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function persist_owner_profile(text, text, text, text) from public;
grant execute on function persist_owner_profile(text, text, text, text) to authenticated;
