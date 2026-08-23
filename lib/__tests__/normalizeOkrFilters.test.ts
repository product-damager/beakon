// Pure-function coverage for normalizeOkrFilters' three-input-shape
// contract (docs/plans/okr-filters-archive-parity-and-delayed-health.md T8):
// (a) already-correct new array shape, (b) malformed/garbage input, (c) the
// OLD single-scalar shape every OkrView saved before the multi-select
// change used. (c) is the one with real production stakes — a missed case
// here silently drops every existing user's saved filters on first load
// post-deploy, so it gets explicit coverage rather than relying on manual QA.
//
// UPDATED (docs/plans/roadmap-dialog-viewmode-and-archive-reversal.md T26,
// item 5): `showArchived` is removed from `OkrFilters` entirely (archived
// OKRs are now always excluded, no toggle). Test inputs below still include
// a stray `showArchived` key on purpose in a couple of cases, to prove
// `normalizeOkrFilters` still ignores it cleanly (doesn't crash, doesn't
// leak it into the returned object) for any `OkrView` saved while the field
// still existed in the persisted jsonb.
//
// UPDATED AGAIN (docs/plans/qa-followup-f1-f2-fp1.md "FP1"): `governanceStatuses`
// is removed from `OkrFilters` entirely too (PM: drop the Governance filter,
// not just hide it). Test inputs below now include a stray
// `governanceStatuses` key on purpose in a couple of cases, for the same
// reason `showArchived` is — proving an OkrView saved while this field still
// existed doesn't crash or leak it through.
import { describe, expect, it } from "vitest";
import { EMPTY_OKR_FILTERS, normalizeOkrFilters } from "../okrFilters";

describe("normalizeOkrFilters", () => {
  it("passes through the new array shape unchanged", () => {
    const input = {
      quarters: [1, 3],
      teamIds: ["team-a"],
      businessUnitIds: ["bu-a"],
      strategicObjectiveIds: ["so-a"],
    };
    expect(normalizeOkrFilters(input)).toEqual(input);
  });

  it("ignores stray showArchived/governanceStatuses keys from an OkrView saved before those fields were removed, without crashing or leaking them into the result", () => {
    const input = {
      quarters: [1, 3],
      teamIds: ["team-a"],
      businessUnitIds: ["bu-a"],
      strategicObjectiveIds: ["so-a"],
      governanceStatuses: ["validated", "draft"],
      showArchived: true,
    };
    const result = normalizeOkrFilters(input);
    expect(result).toEqual({
      quarters: [1, 3],
      teamIds: ["team-a"],
      businessUnitIds: ["bu-a"],
      strategicObjectiveIds: ["so-a"],
    });
    expect(result).not.toHaveProperty("showArchived");
    expect(result).not.toHaveProperty("governanceStatuses");
  });

  it("falls back to empty defaults for malformed/garbage input", () => {
    expect(normalizeOkrFilters(null)).toEqual(EMPTY_OKR_FILTERS);
    expect(normalizeOkrFilters("not an object")).toEqual(EMPTY_OKR_FILTERS);
    expect(normalizeOkrFilters({ quarters: "nope", teamIds: 42 })).toEqual(EMPTY_OKR_FILTERS);
  });

  it("coerces the old single-scalar shape (every OkrView saved before this change) into arrays", () => {
    const old = {
      quarter: 3,
      teamId: "t1",
      businessUnitId: "bu1",
      strategicObjectiveId: "so1",
      // Stray keys from an OkrView saved while `showArchived`/
      // `governanceStatus` still existed on the type — must be silently
      // ignored, not coerced through.
      governanceStatus: "validated",
      showArchived: false,
    };
    expect(normalizeOkrFilters(old)).toEqual({
      quarters: [3],
      teamIds: ["t1"],
      businessUnitIds: ["bu1"],
      strategicObjectiveIds: ["so1"],
    });
  });

  it("drops invalid elements from an array rather than invalidating the whole field", () => {
    expect(normalizeOkrFilters({ quarters: [1, 5, "x", 2] })).toEqual({
      ...EMPTY_OKR_FILTERS,
      quarters: [1, 2],
    });
  });

  it("treats an explicit empty array on the new key as intentionally cleared, not old-shape fallback", () => {
    expect(normalizeOkrFilters({ quarters: [], quarter: 2 })).toEqual({
      ...EMPTY_OKR_FILTERS,
      quarters: [],
    });
  });

  it("old single-scalar quarter value that fails validation doesn't leak through", () => {
    expect(normalizeOkrFilters({ quarter: 7 })).toEqual(EMPTY_OKR_FILTERS);
  });
});
