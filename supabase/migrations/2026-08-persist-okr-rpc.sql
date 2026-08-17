-- New RPC — safe to fold into schema.sql directly (unlike the two prior
-- migrations in this sprint, this isn't tightening a constraint against
-- existing data; it's a brand-new function with no backward-compat hazard,
-- so `create or replace function` is idempotent on its own). This file is
-- kept as a standalone migration anyway, per the plan's file-layout
-- decision, so the change has its own reviewable diff; the identical
-- definition also lives in supabase/schema.sql (see the "persist_okr():
-- transactional upsert" section there) so a from-scratch bootstrap of a
-- new Supabase project still gets it.
--
-- Why this exists: QA Chickadee Week 1 Finding #1 — lib/data.ts's
-- persistOkr() previously ran upsert(okr) -> delete okr_owners -> insert
-- owners -> delete okr_initiatives -> insert links as four separate,
-- non-transactional Supabase calls. A failure partway through (e.g. a
-- duplicate (okr_id, owner_id) primary-key violation on the owners
-- insert, or any transient network error) left the deletes already
-- committed and the following insert failed, so the OKR ended up with
-- zero owners/links in the DB while the client's optimistic local state
-- still showed the old list until reload. Supabase's JS client can't span
-- multiple .from() calls in one client-side transaction, so the real fix
-- is a Postgres function: a plpgsql function body is one transaction, so
-- an exception anywhere inside it rolls back every statement that ran
-- before it, including the deletes.
--
-- security invoker (not definer): this schema has exactly one
-- `security definer` function today (enforce_company_domain), and that's
-- only because it fires on INSERT into auth.users, which the calling role
-- has no direct privilege over. persist_okr only ever touches okrs/
-- okr_owners/okr_initiatives, which the `authenticated` role already has
-- full RLS-backed read/write access to (see the "authenticated full
-- access" policies in schema.sql). Running as `invoker` means the
-- function executes with the calling user's own privileges and RLS still
-- applies row-by-row inside it — no privilege escalation, no new anon
-- attack surface, consistent with every other table in this schema having
-- an open `for all to authenticated using (true) with check (true))`
-- policy. If a future table this function touches ever gets row-scoped
-- RLS (e.g. per-team ownership), invoker is what makes persist_okr keep
-- respecting that automatically instead of silently bypassing it.
--
-- Error shape: the duplicate-owner case (two rows in the same p_owners
-- array sharing an owner_id, or a stale client re-submitting an owner
-- that already exists — the exact bug this fix closes) is caught
-- explicitly and re-raised as a friendlier message rather than left as
-- Postgres's raw "duplicate key value violates unique constraint
-- okr_owners_pkey" text, which leaks internal column/constraint names to
-- the client. The original SQLSTATE (`unique_violation`, 23505) is
-- preserved via `using errcode = 'unique_violation'` so callers that want
-- to branch on the error code programmatically still can.
--
-- Manual test plan (no live DB access in this session — someone with
-- beakon-preview access needs to run this):
--   1. Apply this file's function body in the beakon-preview SQL editor
--      (or re-run all of schema.sql, which now includes it).
--   2. Happy path: call persist_okr with two distinct owners and one
--      initiative link; confirm okrs/okr_owners/okr_initiatives all
--      reflect the new state (via Table Editor) and no error is raised.
--   3. Duplicate-owner repro (the actual QA finding): call persist_okr
--      passing the SAME owner_id twice in p_owners, e.g.
--        select persist_okr(
--          '<existing-okr-id>', 'Test title', '<strategic_objective_id>',
--          '<team_id>', null, 2026, 3, '', 'draft', null, null, null,
--          'on_track', '', null, false, 0,
--          '[{"owner_id":"<owner-id>","role":"contributor"},
--            {"owner_id":"<owner-id>","role":"contributor"}]'::jsonb,
--          array[]::text[]
--        );
--      (param order: id, title, strategic_objective_id, team_id,
--      business_unit_id, year, quarter, deliverable_detail,
--      governance_status, okr_class, target_date, achievement, health,
--      notes, carried_from_id, archived, position, owners, initiative_ids
--      — matches lib/data.ts's okrToRow() field order.)
--      Expect: the call raises the friendly "Duplicate owner in OKR ..."
--      exception (not a raw constraint-violation string), AND — this is
--      the actual regression test — re-querying okr_owners for that
--      okr_id afterward must show the OKR's *original* owners untouched
--      (the delete inside the same function call must have rolled back
--      too, not just the failed insert). Before this fix, the equivalent
--      four-call sequence left okr_owners empty for that okr_id.
--   4. Repeat step 3's assertion pattern in beakon-prod only once this
--      lands there (prod migration for this schema area is explicitly
--      deferred this week per the plan — no urgency, but the same
--      before/after check applies whenever it does roll out).

create or replace function persist_okr(
  p_id text,
  p_title text,
  p_strategic_objective_id text,
  p_team_id text,
  p_business_unit_id text,
  p_year smallint,
  p_quarter smallint,
  p_deliverable_detail text,
  p_governance_status okr_governance_status,
  p_okr_class okr_class,
  p_target_date date,
  p_achievement numeric,
  p_health initiative_health,
  p_notes text,
  p_carried_from_id text,
  p_archived boolean,
  p_position double precision,
  p_owners jsonb,          -- array of {"owner_id": text, "role": text}
  p_initiative_ids text[]
) returns void
language plpgsql
security invoker
as $$
begin
  insert into okrs (
    id, title, strategic_objective_id, team_id, business_unit_id, year, quarter,
    deliverable_detail, governance_status, okr_class, target_date, achievement,
    health, notes, carried_from_id, archived, position
  )
  values (
    p_id, p_title, p_strategic_objective_id, p_team_id, p_business_unit_id, p_year, p_quarter,
    p_deliverable_detail, p_governance_status, p_okr_class, p_target_date, p_achievement,
    p_health, p_notes, p_carried_from_id, p_archived, p_position
  )
  on conflict (id) do update set
    title                   = excluded.title,
    strategic_objective_id  = excluded.strategic_objective_id,
    team_id                 = excluded.team_id,
    business_unit_id        = excluded.business_unit_id,
    year                    = excluded.year,
    quarter                 = excluded.quarter,
    deliverable_detail      = excluded.deliverable_detail,
    governance_status       = excluded.governance_status,
    okr_class               = excluded.okr_class,
    target_date             = excluded.target_date,
    achievement             = excluded.achievement,
    health                  = excluded.health,
    notes                   = excluded.notes,
    carried_from_id         = excluded.carried_from_id,
    archived                = excluded.archived,
    position                = excluded.position;

  delete from okr_owners where okr_id = p_id;
  if p_owners is not null and jsonb_array_length(p_owners) > 0 then
    begin
      insert into okr_owners (okr_id, owner_id, role)
      select p_id, elem->>'owner_id', coalesce(elem->>'role', 'contributor')
      from jsonb_array_elements(p_owners) as elem;
    exception when unique_violation then
      raise exception 'persist_okr: duplicate owner in OKR % — each owner can only be listed once', p_id
        using errcode = 'unique_violation';
    end;
  end if;

  delete from okr_initiatives where okr_id = p_id;
  if p_initiative_ids is not null and array_length(p_initiative_ids, 1) > 0 then
    begin
      insert into okr_initiatives (okr_id, initiative_id)
      select p_id, initiative_id from unnest(p_initiative_ids) as initiative_id;
    exception when unique_violation then
      raise exception 'persist_okr: duplicate initiative link in OKR % — each initiative can only be linked once', p_id
        using errcode = 'unique_violation';
    end;
  end if;
end;
$$;

revoke execute on function persist_okr(
  text, text, text, text, text, smallint, smallint, text, okr_governance_status,
  okr_class, date, numeric, initiative_health, text, text, boolean, double precision,
  jsonb, text[]
) from public;

grant execute on function persist_okr(
  text, text, text, text, text, smallint, smallint, text, okr_governance_status,
  okr_class, date, numeric, initiative_health, text, text, boolean, double precision,
  jsonb, text[]
) to authenticated;
