import { describe, expect, it } from "vitest";
import type { Team } from "../types";
import { firstAllowedTeamId, vaultManagedTeamIds, vaultTeamsHint } from "../vaultTeams";

const okr = (teamId: string, year: number, quarter: number, source: "vault" | null = "vault") => ({
  teamId,
  year,
  quarter,
  source,
});

describe("vaultManagedTeamIds", () => {
  it("locks teams with synced OKRs this quarter", () => {
    const ids = vaultManagedTeamIds([okr("fr", 2026, 4), okr("ac", 2026, 4), okr("x", 2026, 4, null)], new Date(2026, 10, 1));
    expect([...ids].sort()).toEqual(["ac", "fr"]);
  });

  it("keeps the lock in the next quarter until its commitments are synced (Q1 → previous Q4)", () => {
    expect(vaultManagedTeamIds([okr("fr", 2026, 4)], new Date(2027, 0, 15)).has("fr")).toBe(true);
  });

  it("releases teams whose synced OKRs are two quarters back", () => {
    expect(vaultManagedTeamIds([okr("fr", 2026, 4)], new Date(2027, 3, 1)).has("fr")).toBe(false);
  });

  it("locks a team with synced OKRs for a later quarter only", () => {
    expect(vaultManagedTeamIds([okr("new", 2027, 1)], new Date(2026, 10, 1)).has("new")).toBe(true);
  });

  // Archived synced OKRs count by construction: the rule never reads `archived`.
  it("skips business-unit-level synced OKRs (no team)", () => {
    const ids = vaultManagedTeamIds(
      [okr("fr", 2026, 4), { teamId: undefined, year: 2026, quarter: 4, source: "vault" as const }],
      new Date(2026, 10, 1)
    );
    expect([...ids]).toEqual(["fr"]);
  });

  it("ignores Beakon-only OKRs", () => {
    expect(vaultManagedTeamIds([okr("x", 2026, 4, null)], new Date(2026, 10, 1)).size).toBe(0);
  });
});

describe("vaultTeamsHint", () => {
  const teams: Team[] = [
    { id: "fr", name: "Finalize & Roll out", businessUnitId: "bu" },
    { id: "ac", name: "Assets Creation", businessUnitId: "bu" },
    { id: "o", name: "Other", businessUnitId: "bu" },
  ];

  it("names the two squads alphabetically, whatever the team order", () => {
    const expected =
      "Assets Creation and Finalize & Roll out are managed in the vault — add the commitment to 02 OKR, then sync.";
    expect(vaultTeamsHint(teams, new Set(["fr", "ac"]))).toBe(expected);
    expect(vaultTeamsHint([...teams].reverse(), new Set(["fr", "ac"]))).toBe(expected);
  });

  it("uses 'is' for one team and commas for three", () => {
    expect(vaultTeamsHint(teams, new Set(["ac"]))).toBe(
      "Assets Creation is managed in the vault — add the commitment to 02 OKR, then sync."
    );
    expect(vaultTeamsHint(teams, new Set(["fr", "ac", "o"]))).toMatch(/^Assets Creation, Finalize & Roll out and Other are /);
  });

  it("is null when no team is locked", () => {
    expect(vaultTeamsHint(teams, new Set())).toBeNull();
  });
});

describe("firstAllowedTeamId", () => {
  const teams: Team[] = [
    { id: "fr", name: "Finalize & Roll out", businessUnitId: "bu" },
    { id: "ac", name: "Assets Creation", businessUnitId: "bu" },
    { id: "o", name: "Other", businessUnitId: "bu" },
  ];

  it("skips vault-managed teams", () => {
    expect(firstAllowedTeamId(teams, new Set(["fr", "ac"]))).toBe("o");
  });

  it("is undefined when every team is vault-managed", () => {
    expect(firstAllowedTeamId(teams, new Set(["fr", "ac", "o"]))).toBeUndefined();
  });
});
