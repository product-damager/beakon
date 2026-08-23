// ── OKR grouping (Sprint Vireo, Initiative 1) ──
// Pure, UI-free grouping/bucketing logic for the grouped OKR view
// (BU → Team → OKR disclosure). See
// docs/plans/vireo-grouped-okr-view-and-drawer-detail-rework.md for the
// full spec.

import type { BusinessUnit, Health, Okr, Team } from "./types";
import type { OkrFilters } from "./okrFilters";

export interface OkrTeamGroup {
  key: string; // `team:${team.id}`
  team: Team;
  okrs: Okr[]; // already in the flat list's default sort order (updated desc)
}

export interface OkrBuGroup {
  key: string; // `bu:${bu.id}` | "unassigned"
  bu: BusinessUnit | null; // null only for the defensive Unassigned bucket
  directOkrs: Okr[]; // businessUnitId set, teamId unset — "direct to BU"
  teamGroups: OkrTeamGroup[];
  totalCount: number;
  healthCounts: Record<Health, number>;
}

const ZERO_HEALTH_COUNTS: Record<Health, number> = {
  on_track: 0,
  at_risk: 0,
  blocked: 0,
  delayed: 0,
};

/** Default sort inside every bucket — same as the (now-deleted) flat list's
 * default sort, per the plan's explicit scope cut (no per-group interactive
 * sort). ISO datetime strings sort correctly lexically. */
function sortByUpdatedDesc(okrs: Okr[]): Okr[] {
  return [...okrs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

function healthCountsFor(okrs: Okr[]): Record<Health, number> {
  const counts = { ...ZERO_HEALTH_COUNTS };
  for (const o of okrs) counts[o.health] += 1;
  return counts;
}

/**
 * Buckets an already-filtered OKR list into a BU → Team → OKR disclosure
 * tree. `okrs` is expected to already be the output of `applyOkrFilters()` —
 * this function does no archive/filter logic of its own, only arranges
 * whatever it's given.
 *
 * Edge cases (per the plan's brief-derived rules, all confirmed, none a PM
 * call):
 * - A BU or Team bucket with zero OKRs is dropped, *unless* the active
 *   filter explicitly named it (`filters.businessUnitIds`/`teamIds`
 *   includes that id) — in which case it's kept (empty), so the caller can
 *   render a quiet "No OKRs" line instead of the bucket silently vanishing.
 * - Direct-to-BU OKRs (`businessUnitId` set, `teamId` unset) are returned
 *   separately from `teamGroups` (`directOkrs`) so the caller can render
 *   them first, above any Team sub-groups.
 * - OKRs with neither id set (or referencing a team/BU id that no longer
 *   exists — data drift, "shouldn't exist" per `Okr`'s own doc comment)
 *   fall into a defensive `"unassigned"` bucket, rendered last, only if
 *   non-empty — same posture as `normalizeThemeColor()`: bucket it, don't
 *   silently drop the row.
 */
export function groupOkrs(
  okrs: Okr[],
  teams: Team[],
  businessUnits: BusinessUnit[],
  filters: OkrFilters
): OkrBuGroup[] {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const businessUnitsById = new Map(businessUnits.map((b) => [b.id, b]));

  const teamOkrsByTeamId = new Map<string, Okr[]>();
  const directOkrsByBuId = new Map<string, Okr[]>();
  const unassigned: Okr[] = [];

  for (const o of okrs) {
    if (o.teamId && teamsById.has(o.teamId)) {
      const bucket = teamOkrsByTeamId.get(o.teamId) ?? [];
      bucket.push(o);
      teamOkrsByTeamId.set(o.teamId, bucket);
      continue;
    }
    if (o.businessUnitId && businessUnitsById.has(o.businessUnitId)) {
      const bucket = directOkrsByBuId.get(o.businessUnitId) ?? [];
      bucket.push(o);
      directOkrsByBuId.set(o.businessUnitId, bucket);
      continue;
    }
    unassigned.push(o);
  }

  // Every BU that owns at least one team is a candidate band (even with zero
  // OKRs of its own right now) — plus any BU a filter explicitly named
  // (which may otherwise have neither a team nor a direct OKR at all).
  const candidateBuIds = new Set<string>(businessUnits.map((b) => b.id));
  for (const id of filters.businessUnitIds) candidateBuIds.add(id);

  const buGroups: OkrBuGroup[] = [];
  for (const buId of candidateBuIds) {
    const bu = businessUnitsById.get(buId);
    if (!bu) continue; // filter named an id that doesn't resolve to a real BU — nothing to render

    const directOkrs = sortByUpdatedDesc(directOkrsByBuId.get(buId) ?? []);

    const teamGroups: OkrTeamGroup[] = [];
    for (const team of teams.filter((t) => t.businessUnitId === buId)) {
      const teamOkrs = teamOkrsByTeamId.get(team.id) ?? [];
      const explicitlyFiltered = filters.teamIds.includes(team.id);
      if (teamOkrs.length === 0 && !explicitlyFiltered) continue;
      teamGroups.push({ key: `team:${team.id}`, team, okrs: sortByUpdatedDesc(teamOkrs) });
    }
    teamGroups.sort((a, b) => a.team.name.localeCompare(b.team.name));

    const totalCount = directOkrs.length + teamGroups.reduce((sum, g) => sum + g.okrs.length, 0);
    const explicitlyFiltered =
      filters.businessUnitIds.includes(buId) ||
      teamGroups.some((g) => filters.teamIds.includes(g.team.id));
    if (totalCount === 0 && !explicitlyFiltered) continue;

    buGroups.push({
      key: `bu:${buId}`,
      bu,
      directOkrs,
      teamGroups,
      totalCount,
      healthCounts: healthCountsFor([...directOkrs, ...teamGroups.flatMap((g) => g.okrs)]),
    });
  }
  buGroups.sort((a, b) => (a.bu?.name ?? "").localeCompare(b.bu?.name ?? ""));

  if (unassigned.length > 0) {
    const sorted = sortByUpdatedDesc(unassigned);
    buGroups.push({
      key: "unassigned",
      bu: null,
      directOkrs: sorted,
      teamGroups: [],
      totalCount: sorted.length,
      healthCounts: healthCountsFor(sorted),
    });
  }

  return buGroups;
}

/**
 * Defensively normalizes an arbitrary jsonb value (as read back from
 * `okr_views.collapsed_group_keys`) into a string array — mirrors
 * `normalizeOkrFilters`'s posture in `lib/okrFilters.ts` exactly: filters
 * out non-string entries, never throws on a malformed/legacy row. Every
 * `OkrView` saved before this migration has no `collapsed_group_keys`
 * value at all, so callers should pass `row.collapsed_group_keys ?? []`.
 */
export function normalizeCollapsedGroupKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((key): key is string => typeof key === "string");
}
