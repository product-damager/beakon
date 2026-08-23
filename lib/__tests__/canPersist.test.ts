// Pure-function tests for the authorization guards added/hardened in
// Sprint Heron Week 3 (plan §7.5 item 1) — `canPersistRoadmap`/
// `canPersistOkrView` are boundary logic that silently regresses when
// someone touches an adjacent callback six months from now without reading
// every comment, so they get their own deterministic coverage rather than
// relying on manual QA alone. Scoped exactly to these two functions, per
// the plan's own instruction not to build out a broader suite this sprint.
import { describe, expect, it } from "vitest";
import { canPersistOkrView, canPersistRoadmap, isOkrViewOwner, isRoadmapOwner } from "../store";
import type { OkrView, Owner, Roadmap } from "../types";

const owner: Owner = { id: "u-owner", name: "Owner", role: "PM" };
const otherOwner: Owner = { id: "u-other", name: "Other", role: "PM" };

function makeRoadmap(overrides: Partial<Roadmap> = {}): Roadmap {
  return {
    id: "roadmap-1",
    ownerId: owner.id,
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

function makeOkrView(overrides: Partial<OkrView> = {}): OkrView {
  return {
    id: "okr-view-1",
    ownerId: owner.id,
    name: "Q3 leadership OKRs",
    filters: {
      quarters: [],
      teamIds: [],
      businessUnitIds: [],
      strategicObjectiveIds: [],
    },
    visibility: "private",
    editable: false,
    position: 0,
    ...overrides,
  };
}

describe("canPersistRoadmap", () => {
  it("allows the owner", () => {
    expect(canPersistRoadmap(makeRoadmap(), owner)).toBe(true);
  });

  it("allows a Shared+editable non-owner", () => {
    const target = makeRoadmap({ visibility: "shared", editable: true });
    expect(canPersistRoadmap(target, otherOwner)).toBe(true);
  });

  it("rejects a Shared+view-only non-owner", () => {
    const target = makeRoadmap({ visibility: "shared", editable: false });
    expect(canPersistRoadmap(target, otherOwner)).toBe(false);
  });

  it("rejects a non-owner on a private Roadmap", () => {
    const target = makeRoadmap({ visibility: "private" });
    expect(canPersistRoadmap(target, otherOwner)).toBe(false);
  });

  it("rejects everyone — including the nominal owner — on the System Roadmap", () => {
    const target = makeRoadmap({ isSystem: true, ownerId: null });
    expect(canPersistRoadmap(target, owner)).toBe(false);
    expect(canPersistRoadmap(target, undefined)).toBe(false);
  });

  it("rejects an unauthenticated/no-owner caller on a private Roadmap", () => {
    expect(canPersistRoadmap(makeRoadmap(), undefined)).toBe(false);
  });

  it("rejects an ownerId: null Roadmap for an undefined currentOwner (finding #6) — an undefined caller never matches, even when both collapse to null", () => {
    const target = makeRoadmap({ ownerId: null });
    expect(canPersistRoadmap(target, undefined)).toBe(false);
  });
});

describe("canPersistOkrView", () => {
  it("allows the owner", () => {
    expect(canPersistOkrView(makeOkrView(), owner)).toBe(true);
  });

  it("allows a Shared+editable non-owner", () => {
    const target = makeOkrView({ visibility: "shared", editable: true });
    expect(canPersistOkrView(target, otherOwner)).toBe(true);
  });

  it("rejects a Shared+view-only non-owner", () => {
    const target = makeOkrView({ visibility: "shared", editable: false });
    expect(canPersistOkrView(target, otherOwner)).toBe(false);
  });

  it("rejects a non-owner on a private OkrView", () => {
    expect(canPersistOkrView(makeOkrView(), otherOwner)).toBe(false);
  });

  it("rejects an unauthenticated/no-owner caller", () => {
    expect(canPersistOkrView(makeOkrView(), undefined)).toBe(false);
  });
});

// isRoadmapOwner/isOkrViewOwner (Sprint Heron Week 2) are the owner-only
// guards that gate rename/visibility/delete — never delegable to a
// Shared+editable non-owner, unlike canPersistRoadmap/canPersistOkrView
// above (QA-REPORT-HERON-W2-T47.md finding #1; untested until now, per
// QA-REPORT-HERON-W3.md finding #8).
describe("isRoadmapOwner", () => {
  it("allows the owner", () => {
    expect(isRoadmapOwner(makeRoadmap(), owner)).toBe(true);
  });

  it("rejects a non-owner", () => {
    expect(isRoadmapOwner(makeRoadmap(), otherOwner)).toBe(false);
  });

  it("rejects a Shared+editable non-owner — rename/visibility/delete are owner-only even when editable", () => {
    const target = makeRoadmap({ visibility: "shared", editable: true });
    expect(isRoadmapOwner(target, otherOwner)).toBe(false);
  });

  it("rejects everyone on the System Roadmap", () => {
    const target = makeRoadmap({ isSystem: true, ownerId: null });
    expect(isRoadmapOwner(target, owner)).toBe(false);
    expect(isRoadmapOwner(target, undefined)).toBe(false);
  });

  it("rejects an orphaned (ownerId: null) non-System Roadmap for an unauthenticated/no-owner caller — QA-REPORT-HERON-W3C.md finding N2", () => {
    const target = makeRoadmap({ isSystem: false, ownerId: null });
    expect(isRoadmapOwner(target, undefined)).toBe(false);
  });
});

describe("isOkrViewOwner", () => {
  it("allows the owner", () => {
    expect(isOkrViewOwner(makeOkrView(), owner)).toBe(true);
  });

  it("rejects a non-owner", () => {
    expect(isOkrViewOwner(makeOkrView(), otherOwner)).toBe(false);
  });

  it("rejects a Shared+editable non-owner — visibility/delete are owner-only even when editable", () => {
    const target = makeOkrView({ visibility: "shared", editable: true });
    expect(isOkrViewOwner(target, otherOwner)).toBe(false);
  });
});
