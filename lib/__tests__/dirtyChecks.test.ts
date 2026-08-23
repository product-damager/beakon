// Pure-function tests for the dirty-check comparisons added in Sprint
// Heron Week 3 (plan §7.5 item 2) — structural-equality behavior, not
// object-identity, is exactly the thing a future refactor is most likely
// to subtly break (e.g. by comparing object identity instead of structural
// equality after some unrelated change). Scoped exactly to Roadmap's
// field compare and OkrView's filter compare, per the plan's own
// instruction not to build out a broader suite this sprint.
//
// UPDATED (docs/plans/roadmap-dialog-viewmode-and-archive-reversal.md T22,
// item 3): `roadmapFieldsEqual` dropped `viewMode` from its three-field
// (was four) compare — `viewMode` is now a personal-rendering-preference/
// autosave field (like zoom/zoomScale/density), not part of the
// definitional/explicit-save dirty-check. The old "is false when viewMode
// diverges" case is replaced below with its mirror: viewMode diverging
// alone must NOT make the compare return false. Also (item 5):
// `okrFiltersEqual` dropped `showArchived` — the field no longer exists on
// `OkrFilters` at all (archived OKRs are now always excluded, no toggle),
// so its own comparison and test case are removed rather than repurposed.
import { describe, expect, it } from "vitest";
import { okrFiltersEqual, roadmapFieldsEqual } from "../store";
import { EMPTY_FILTERS, type Filters } from "../filters";
import type { OkrFilters } from "../okrFilters";
import type { GroupBy, Roadmap, TimelineSort } from "../types";

function makeRoadmap(overrides: Partial<Roadmap> = {}): Roadmap {
  return {
    id: "roadmap-1",
    ownerId: "u-owner",
    name: "Q3 planning",
    viewMode: "list",
    filters: {},
    groupBy: "theme",
    zoom: "month",
    zoomScale: 1,
    density: "comfortable",
    timelineSort: null,
    visibility: "private",
    editable: false,
    isSystem: false,
    position: 0,
    ...overrides,
  };
}

function live(overrides: {
  filters?: Filters;
  groupBy?: GroupBy;
  timelineSort?: TimelineSort;
} = {}) {
  return {
    filters: EMPTY_FILTERS,
    groupBy: "theme" as GroupBy,
    timelineSort: { key: "start", dir: 1 } as TimelineSort,
    ...overrides,
  };
}

describe("roadmapFieldsEqual", () => {
  it("is true when live values structurally match the persisted row (fresh object, same shape)", () => {
    const target = makeRoadmap();
    expect(roadmapFieldsEqual(live(), target)).toBe(true);
  });

  it("is false when groupBy diverges", () => {
    const target = makeRoadmap({ groupBy: "theme" });
    expect(roadmapFieldsEqual(live({ groupBy: "owner" }), target)).toBe(false);
  });

  it("viewMode changing alone does NOT make the Roadmap dirty (moved to the autosave/personal-preference bucket, no longer part of this compare)", () => {
    const target = makeRoadmap({ viewMode: "list" });
    // `live()` here has no `viewMode` field at all — roadmapFieldsEqual's
    // signature no longer accepts one, so there's nothing to diverge on.
    // Compare stays true purely on groupBy/filters/timelineSort, even though
    // `target.viewMode` ("list") differs from what a caller might otherwise
    // expect the live view to be ("board").
    expect(roadmapFieldsEqual(live(), target)).toBe(true);
  });

  it("is false when timelineSort diverges, and treats a null persisted sort as the default", () => {
    const target = makeRoadmap({ timelineSort: null });
    expect(roadmapFieldsEqual(live({ timelineSort: { key: "start", dir: 1 } }), target)).toBe(true);
    expect(roadmapFieldsEqual(live({ timelineSort: { key: "score", dir: -1 } }), target)).toBe(false);
  });

  it("is false when a filter field diverges", () => {
    const target = makeRoadmap({ filters: { ...EMPTY_FILTERS, search: "pbx" } });
    expect(roadmapFieldsEqual(live({ filters: EMPTY_FILTERS }), target)).toBe(false);
  });

  it("treats reordered multi-select filter arrays as equal (structural, not order-sensitive)", () => {
    const target = makeRoadmap({
      filters: { ...EMPTY_FILTERS, owners: ["u-a", "u-b"] },
    });
    const liveFilters: Filters = { ...EMPTY_FILTERS, owners: ["u-b", "u-a"] };
    expect(roadmapFieldsEqual(live({ filters: liveFilters }), target)).toBe(true);
  });

  it("is not fooled by object identity — a fresh but equal filters object still reads as clean", () => {
    const target = makeRoadmap({ filters: { ...EMPTY_FILTERS, teams: ["team-a"] } });
    const freshEqualFilters: Filters = { ...EMPTY_FILTERS, teams: ["team-a"] };
    expect(target.filters).not.toBe(freshEqualFilters); // different reference
    expect(roadmapFieldsEqual(live({ filters: freshEqualFilters }), target)).toBe(true);
  });
});

describe("okrFiltersEqual", () => {
  const base: OkrFilters = {
    quarters: [],
    teamIds: [],
    businessUnitIds: [],
    strategicObjectiveIds: [],
  };

  it("is true for two structurally-identical-but-distinct objects", () => {
    const a = { ...base };
    const b = { ...base };
    expect(a).not.toBe(b);
    expect(okrFiltersEqual(a, b)).toBe(true);
  });

  it("is false when any of the four fields diverges", () => {
    expect(okrFiltersEqual(base, { ...base, quarters: [1] })).toBe(false);
    expect(okrFiltersEqual(base, { ...base, teamIds: ["team-a"] })).toBe(false);
    expect(okrFiltersEqual(base, { ...base, businessUnitIds: ["bu-a"] })).toBe(false);
    expect(okrFiltersEqual(base, { ...base, strategicObjectiveIds: ["so-a"] })).toBe(false);
  });

  it("treats reordered multi-select filter arrays as equal (structural, not order-sensitive)", () => {
    const a = { ...base, teamIds: ["team-a", "team-b"] };
    const b = { ...base, teamIds: ["team-b", "team-a"] };
    expect(okrFiltersEqual(a, b)).toBe(true);
  });
});
