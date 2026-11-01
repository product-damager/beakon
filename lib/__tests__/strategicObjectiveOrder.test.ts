// Strategic objectives load from Supabase in no fixed order; "New OKR" takes
// the first one as its default (objective-names-and-tier-definition).
import { describe, expect, it } from "vitest";
import { sortStrategicObjectives } from "../data";
import { STRATEGIC_OBJECTIVES } from "../seed";
import type { StrategicObjective } from "../types";

const so = (id: string, name: string): StrategicObjective => ({ id, name, description: "", year: 2026 });

describe("sortStrategicObjectives", () => {
  it("puts core, ai, data, internal first whatever the row order", () => {
    // The order preview returned after the rename migration.
    const rows = ["so-data", "so-internal", "so-core", "so-ai"].map((id) =>
      STRATEGIC_OBJECTIVES.find((o) => o.id === id)!,
    );
    const sorted = sortStrategicObjectives(rows);
    expect(sorted.map((o) => o.id)).toEqual(["so-core", "so-ai", "so-data", "so-internal"]);
    expect(sorted[0].name).toBe("A trusted platform for every team");
  });

  it("puts unknown ids last, by name", () => {
    const sorted = sortStrategicObjectives([so("so-zeta", "Zeta"), so("so-ai", "AI"), so("so-beta", "Beta")]);
    expect(sorted.map((o) => o.id)).toEqual(["so-ai", "so-beta", "so-zeta"]);
  });

  it("matches the seed-mode order and does not mutate its input", () => {
    const input = [...STRATEGIC_OBJECTIVES].reverse();
    const copy = [...input];
    expect(sortStrategicObjectives(input)).toEqual(STRATEGIC_OBJECTIVES);
    expect(input).toEqual(copy);
  });

  it("handles an empty list", () => {
    expect(sortStrategicObjectives([])).toEqual([]);
  });
});
