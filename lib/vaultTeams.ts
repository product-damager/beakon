import type { Okr, Team } from "./types";

/**
 * Teams whose OKRs come from the PM's vault (openspec vault-sync, "Vault-managed
 * teams"): a team owning a vault-synced OKR, archived or not, in the quarter
 * before `now`, the current one or a later one. Mirrors the database's
 * vault_managed_team_ids() in supabase/schema.sql — keep the two in step.
 */
export function vaultManagedTeamIds(
  okrs: Pick<Okr, "source" | "teamId" | "year" | "quarter">[],
  now: Date
): Set<string> {
  const current = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3) + 1;
  const ids = new Set<string>();
  for (const o of okrs) {
    if (o.source === "vault" && o.teamId && o.year * 4 + o.quarter >= current - 1) ids.add(o.teamId);
  }
  return ids;
}

/** Hint under the team picker naming the vault-managed teams, alphabetically (the loaded team order isn't stable). */
export function vaultTeamsHint(teams: Team[], ids: Set<string>): string | null {
  const names = teams
    .filter((t) => ids.has(t.id))
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "is" : "are"} managed in the vault — add the commitment to 02 OKR, then sync.`;
}

/** Default team of a "New OKR" draft: the first team not vault-managed, or none. */
export function firstAllowedTeamId(teams: Team[], ids: Set<string>): string | undefined {
  return teams.find((t) => !ids.has(t.id))?.id;
}
