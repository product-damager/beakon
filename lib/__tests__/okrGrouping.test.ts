// Pure-function coverage for the Sprint Vireo grouping helpers
// (docs/plans/vireo-grouped-okr-view-and-drawer-detail-rework.md, plan
// checklist item 1). Covers the edge cases the plan's brief calls out —
// direct-to-BU bucket ordering, the defensive "unassigned" bucket, the
// empty-bucket hide/show rule for both BU- and Team-scoped explicit
// filters (including the QA-found regression where a Team-only filter on
// an empty team dropped its whole parent BU band), and default sort order.
import { describe, expect, it } from "vitest";
import { groupOkrs, normalizeCollapsedGroupKeys } from "../okrGrouping";
import { EMPTY_OKR_FILTERS } from "../okrFilters";
import type { BusinessUnit, Okr, Team } from "../types";

const buA: BusinessUnit = { id: "bu-a", name: "Growth" };
const buB: BusinessUnit = { id: "bu-b", name: "Platform" };
const teamA1: Team = { id: "team-a1", name: "Acquisition", businessUnitId: "bu-a" };

function makeOkr(overrides: Partial<Okr> = {}): Okr {
  return {
    id: "okr-1",
    title: "Some OKR",
    strategicObjectiveId: "so-1",
    year: 2026,
    quarter: 1,
    deliverableDetail: "",
    governanceStatus: "draft",
    okrClass: null,
    achievement: null,
    health: "on_track",
    notes: "",
    archived: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupOkrs", () => {
  it("hides a BU with no teams and no OKRs by default", () => {
    expect(groupOkrs([], [], [buA], EMPTY_OKR_FILTERS)).toEqual([]);
  });

  it("renders a BU with no teams but at least one direct OKR", () => {
    const okr = makeOkr({ businessUnitId: buA.id });
    const groups = groupOkrs([okr], [], [buA], EMPTY_OKR_FILTERS);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("bu:bu-a");
    expect(groups[0].directOkrs).toEqual([okr]);
    expect(groups[0].teamGroups).toEqual([]);
  });

  it("hides a team with zero OKRs by default", () => {
    const groups = groupOkrs([], [teamA1], [buA], EMPTY_OKR_FILTERS);
    // teamA1's BU has a team but no OKRs anywhere and no explicit filter —
    // the whole BU band is hidden, and so would the team be if the BU were
    // otherwise kept alive.
    expect(groups).toEqual([]);
  });

  it("shows a team with zero OKRs when explicitly filtered by teamIds (QA regression: must not drop the parent BU band either)", () => {
    const filters = { ...EMPTY_OKR_FILTERS, teamIds: [teamA1.id] };
    const groups = groupOkrs([], [teamA1], [buA], filters);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("bu:bu-a");
    expect(groups[0].totalCount).toBe(0);
    expect(groups[0].teamGroups).toHaveLength(1);
    expect(groups[0].teamGroups[0]).toMatchObject({ key: `team:${teamA1.id}`, okrs: [] });
  });

  it("shows a BU with zero OKRs when explicitly filtered by businessUnitIds", () => {
    const filters = { ...EMPTY_OKR_FILTERS, businessUnitIds: [buB.id] };
    const groups = groupOkrs([], [], [buA, buB], filters);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("bu:bu-b");
    expect(groups[0].totalCount).toBe(0);
    expect(groups[0].teamGroups).toEqual([]);
  });

  it("orders direct-to-BU OKRs separately from, and ahead of, team sub-groups", () => {
    const direct = makeOkr({ id: "okr-direct", businessUnitId: buA.id });
    const teamOkr = makeOkr({ id: "okr-team", teamId: teamA1.id });
    const groups = groupOkrs([direct, teamOkr], [teamA1], [buA], EMPTY_OKR_FILTERS);
    expect(groups).toHaveLength(1);
    expect(groups[0].directOkrs).toEqual([direct]);
    expect(groups[0].teamGroups).toHaveLength(1);
    expect(groups[0].teamGroups[0].okrs).toEqual([teamOkr]);
  });

  it("buckets OKRs with neither a resolvable teamId nor businessUnitId into a defensive 'unassigned' bucket, rendered last, only when non-empty", () => {
    const orphan = makeOkr({ id: "okr-orphan", businessUnitId: "does-not-exist" });
    const direct = makeOkr({ id: "okr-direct", businessUnitId: buA.id });
    const groups = groupOkrs([direct, orphan], [], [buA], EMPTY_OKR_FILTERS);
    expect(groups.map((g) => g.key)).toEqual(["bu:bu-a", "unassigned"]);
    const unassigned = groups[groups.length - 1];
    expect(unassigned.bu).toBeNull();
    expect(unassigned.directOkrs).toEqual([orphan]);
  });

  it("omits the unassigned bucket entirely when there's nothing to put in it", () => {
    const direct = makeOkr({ businessUnitId: buA.id });
    const groups = groupOkrs([direct], [], [buA], EMPTY_OKR_FILTERS);
    expect(groups.some((g) => g.key === "unassigned")).toBe(false);
  });

  it("sorts OKRs within a bucket by updatedAt descending by default", () => {
    const older = makeOkr({ id: "okr-older", businessUnitId: buA.id, updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeOkr({ id: "okr-newer", businessUnitId: buA.id, updatedAt: "2026-02-01T00:00:00.000Z" });
    const groups = groupOkrs([older, newer], [], [buA], EMPTY_OKR_FILTERS);
    expect(groups[0].directOkrs.map((o) => o.id)).toEqual(["okr-newer", "okr-older"]);
  });
});

describe("normalizeCollapsedGroupKeys", () => {
  it("passes through a valid string array unchanged (as a new array)", () => {
    expect(normalizeCollapsedGroupKeys(["bu:bu-a", "team:team-a1"])).toEqual([
      "bu:bu-a",
      "team:team-a1",
    ]);
  });

  it("filters out non-string entries rather than invalidating the whole value", () => {
    expect(normalizeCollapsedGroupKeys(["bu:bu-a", 42, null, { x: 1 }, "team:team-a1"])).toEqual([
      "bu:bu-a",
      "team:team-a1",
    ]);
  });

  it("defensively falls back to an empty array for non-array input (null, undefined, object, string)", () => {
    expect(normalizeCollapsedGroupKeys(null)).toEqual([]);
    expect(normalizeCollapsedGroupKeys(undefined)).toEqual([]);
    expect(normalizeCollapsedGroupKeys("not an array")).toEqual([]);
    expect(normalizeCollapsedGroupKeys({ a: 1 })).toEqual([]);
  });
});
