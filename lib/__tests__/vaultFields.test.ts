import { describe, expect, it } from "vitest";
import { initiativeToRow, stripVaultOwned } from "../data";
import { INITIATIVES } from "../seed";
import { isVaultManaged, vaultOwns } from "../types";

const vaultInitiative = INITIATIVES.find((i) => i.source === "vault")!;
const beakonInitiative = INITIATIVES.find((i) => i.source !== "vault")!;

describe("vaultOwns / isVaultManaged", () => {
  it("is true only for columns listed on a vault row", () => {
    expect(isVaultManaged(vaultInitiative)).toBe(true);
    expect(vaultOwns(vaultInitiative, "title")).toBe(true);
    expect(vaultOwns(vaultInitiative, "health")).toBe(false);
  });

  it("is false for Beakon-only rows, even if vaultFields were set", () => {
    expect(isVaultManaged(beakonInitiative)).toBe(false);
    expect(vaultOwns({ source: null, vaultFields: ["title"] }, "title")).toBe(false);
  });
});

describe("stripVaultOwned", () => {
  it("drops exactly the listed columns", () => {
    expect(stripVaultOwned({ title: "a", status: "planned", health: "on_track" }, ["title", "status"])).toEqual({
      health: "on_track",
    });
  });

  it("returns the row unchanged when nothing is vault-owned", () => {
    const row = { title: "a" };
    expect(stripVaultOwned(row, [])).toBe(row);
    expect(stripVaultOwned(row, undefined)).toBe(row);
  });
});

describe("initiativeToRow", () => {
  it("never sends vault-owned columns or vault metadata for a vault initiative", () => {
    const row = initiativeToRow(vaultInitiative) as Record<string, unknown>;
    for (const col of vaultInitiative.vaultFields!) expect(row).not.toHaveProperty(col);
    for (const meta of ["source", "source_key", "vault_fields", "area"]) expect(row).not.toHaveProperty(meta);
    expect(row).toHaveProperty("health");
    expect(row).toHaveProperty("notes");
  });

  it("keeps every editable column for a Beakon-only initiative", () => {
    const row = initiativeToRow(beakonInitiative) as Record<string, unknown>;
    for (const col of ["title", "team_id", "status", "archived", "target_start", "target_end", "tier"]) {
      expect(row).toHaveProperty(col);
    }
    for (const meta of ["source", "source_key", "vault_fields", "area"]) expect(row).not.toHaveProperty(meta);
  });
});
