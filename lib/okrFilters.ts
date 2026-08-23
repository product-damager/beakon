// ── OKR filter dimensions ──
// Moved out of components/OkrFilterBar.tsx (Sprint Heron Week 3, per
// docs/decisions/009-okr-saved-views-reverse-adr-008-deferral.md) so
// lib/types.ts can type `OkrView.filters` as this real shape instead of a
// loose `Record<string, unknown>`. Unlike `Roadmap.filters` — which stays
// untyped jsonb because lib/filters.ts already imports from lib/types.ts,
// and importing its `Filters` type back would create a cycle — `OkrFilters`
// has no such cycle: `lib/types.ts` only needs the *type* of
// `OkrGovernanceStatus` below, and this module only needs the *type* of
// `OkrFilters` back in lib/types.ts, both erased at compile time, so a
// type-only mutual import between the two files is not a runtime cycle.
//
// NOTE for frontend-engineer: components/OkrFilterBar.tsx now imports
// `OkrFilters`/`EMPTY_OKR_FILTERS` from here and re-exports them (rather
// than declaring them itself) purely to avoid an immediate compile break —
// app/(workspace)/okrs/page.tsx still imports both names from
// "@/components/OkrFilterBar". Feel free to update that page's import (and
// any other consumer) to pull directly from "@/lib/okrFilters" instead and
// drop the re-export once you're in that file for other Week 3 work —
// left as-is here to stay within backend scope.
//
// SHAPE CHANGE (docs/plans/okr-filters-archive-parity-and-delayed-health.md
// T8, item 1): filter fields went from single nullable scalars to arrays, to
// back the new pill-style MultiSelect (frontend's build,
// components/OkrFilterBar.tsx) — empty array now means "no filter applied"
// on that field, replacing what `null` used to mean. `normalizeOkrFilters`
// below carries an explicit old-shape→new-shape coercion so every OkrView
// already saved in the DB before this change (old single-scalar shape,
// e.g. `{ quarter: 3, teamId: "t1" }`) keeps working rather than silently
// losing its filters on first load post-deploy — see that function's own
// comment.
//
// REVERSAL (docs/plans/roadmap-dialog-viewmode-and-archive-reversal.md T26,
// item 5): the T8/T11-added `showArchived` field is removed again —
// Initiatives' `applyFilters` and OKRs' `applyOkrFilters` (the latter lives
// in components/OkrFilterBar.tsx, not this file — see the note at the bottom
// of this file) both go back to unconditionally excluding archived rows,
// matching the restored dedicated `/archived` page model instead of an
// inline toggle. An `OkrView` saved while `showArchived` still existed in
// the type will have a stray `showArchived: <bool>` key sitting in its
// persisted `filters` jsonb; `normalizeOkrFilters` below only reads the
// known keys off the raw object by name (`"quarters" in r`, etc.) and
// constructs its return value field-by-field, so that stray key is simply
// never touched — it's silently ignored, not defensively stripped, and the
// result is a well-formed `OkrFilters` either way. Confirmed by reading the
// function, not assumed.
//
// GOVERNANCE FILTER DROPPED (PM request, QA follow-up batch, see
// docs/plans/qa-followup-f1-f2-fp1.md "FP1"): `governanceStatuses` was
// removed from this type entirely, not just hidden in the UI. The per-OKR
// `governanceStatus` attribute itself (`lib/types.ts`), its display
// (`OKR_GOVERNANCE_META`), and its editing (`OkrList.tsx`/`OkrDrawer.tsx`)
// are untouched — only the ability to narrow the OKR list by it is gone. An
// `OkrView` saved while this field still existed will have a stray
// `governanceStatuses` key in its persisted `filters` jsonb; same
// silently-ignored handling as `showArchived` above, not a new risk.

/**
 * OKR filter dimensions — deliberately its own shape, not lib/filters.ts's
 * Filters type (that one is Initiative-shaped: theme/owner/team/status).
 * Quarter/team/BU/strategic-objective/governance-status are a different
 * domain; forcing them through a shared type would couple two unrelated
 * models for reuse's sake alone.
 */
export interface OkrFilters {
  quarters: number[];
  teamIds: string[];
  businessUnitIds: string[];
  strategicObjectiveIds: string[];
}

export const EMPTY_OKR_FILTERS: OkrFilters = {
  quarters: [],
  teamIds: [],
  businessUnitIds: [],
  strategicObjectiveIds: [],
};

/** Element-level validator shared by both the array path and the legacy-scalar coercion path. */
const isValidQuarter = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 4;

/** Filter+cast an arbitrary array-ish value down to valid quarters (1-4 integers), dropping invalid elements rather than invalidating the whole array. */
function coerceQuarters(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isValidQuarter);
}
/** Same shape as coerceQuarters, for string-id fields (teamIds/businessUnitIds/strategicObjectiveIds) — no further validation possible beyond "is a string" since these are foreign ids, not a closed enum. */
function coerceStringIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * Coerce an arbitrary value (e.g. an OkrView's `filters` jsonb column) into a
 * well-formed `OkrFilters`. `okr_views.filters` is jsonb storage with no
 * schema-level shape guarantee — a malformed/partial blob (a future 7th
 * filter field added while old rows still have six, or any row created
 * outside the app path) would otherwise produce `undefined` fields that
 * silently fail every `applyOkrFilters` check, hiding every OKR with no
 * `Clear all` escape hatch (QA Finding #4, Heron Week 3c). Same defensive-
 * normalization pattern `lib/filters.ts`'s `normalizeFilters()` established
 * for `roadmaps.filters`.
 *
 * Handles three input shapes:
 *  (a) already-correct new array shape (`{ quarters: [3], ... }`)
 *  (b) malformed/garbage input (existing defensive behavior — falls back to
 *      empty arrays / `EMPTY_OKR_FILTERS` defaults)
 *  (c) the OLD single-scalar shape every OkrView saved before this change
 *      used (`{ quarter: 3, teamId: "t1" }`) — coerced to the new array
 *      shape (`{ quarters: [3], teamIds: ["t1"] }`) rather than silently
 *      dropped to empty arrays, so an existing saved OkrView doesn't lose
 *      its filters on first load post-deploy. A field is read from its new
 *      array key if present (even if empty — an explicit `[]` means "user
 *      cleared it," not "still on the old shape"), else falls back to
 *      coercing the old scalar key if that's present, else empty.
 */
export function normalizeOkrFilters(raw: unknown): OkrFilters {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const quarters =
    "quarters" in r ? coerceQuarters(r.quarters) : isValidQuarter(r.quarter) ? [r.quarter as number] : [];
  const teamIds =
    "teamIds" in r
      ? coerceStringIds(r.teamIds)
      : typeof r.teamId === "string"
        ? [r.teamId]
        : [];
  const businessUnitIds =
    "businessUnitIds" in r
      ? coerceStringIds(r.businessUnitIds)
      : typeof r.businessUnitId === "string"
        ? [r.businessUnitId]
        : [];
  const strategicObjectiveIds =
    "strategicObjectiveIds" in r
      ? coerceStringIds(r.strategicObjectiveIds)
      : typeof r.strategicObjectiveId === "string"
        ? [r.strategicObjectiveId]
        : [];
  return {
    quarters,
    teamIds,
    businessUnitIds,
    strategicObjectiveIds,
  };
}

// Note: `okrFilterCount` and `applyOkrFilters` — the other two call sites the
// plan asked to update for this shape change — actually live in
// components/OkrFilterBar.tsx (not this file), which this task explicitly
// puts off-limits for this backend pass. Left untouched here; see the final
// report for the flag to frontend-engineer.
