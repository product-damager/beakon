import { ownerName } from "./types";
import type { GroupBy, Initiative, Owner, Status, Theme, ThemeColor, Visibility } from "./types";

/** Whether a value filter includes (is) or excludes (is not) its selected values. */
export type FilterMode = "is" | "is_not";

export interface Filters {
  search: string;
  owners: string[];
  teams: string[];
  themes: string[];
  statuses: Status[];
  visibility: Visibility[];
  showDone: boolean;
  // Per-field operator. "is" keeps only matches; "is_not" excludes them.
  ownersMode: FilterMode;
  teamsMode: FilterMode;
  themesMode: FilterMode;
  statusesMode: FilterMode;
  visibilityMode: FilterMode;
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  owners: [],
  teams: [],
  themes: [],
  statuses: [],
  visibility: [],
  showDone: true,
  ownersMode: "is",
  teamsMode: "is",
  themesMode: "is",
  statusesMode: "is",
  visibilityMode: "is",
};

/** True when an initiative's value passes a field filter given its selected values + mode. */
function matchesField(values: string[], mode: FilterMode, value: string): boolean {
  if (!values.length) return true;
  const inSet = values.includes(value);
  return mode === "is_not" ? !inSet : inSet;
}

export function activeFilterCount(f: Filters): number {
  return (
    f.owners.length +
    f.teams.length +
    f.themes.length +
    f.statuses.length +
    f.visibility.length +
    (f.showDone ? 0 : 1)
  );
}

export function applyFilters(
  initiatives: Initiative[],
  f: Filters,
  themes: Theme[],
  owners: Owner[]
): Initiative[] {
  const themeName = (id: string) => themes.find((t) => t.id === id)?.name ?? "";
  const ownerLabel = (id: string) => ownerName(owners.find((o) => o.id === id));
  const q = f.search.trim().toLowerCase();

  return initiatives.filter((i) => {
    if (i.archived) return false;
    if (!f.showDone && i.status === "released") return false;
    if (!matchesField(f.owners, f.ownersMode, i.ownerId)) return false;
    if (!matchesField(f.teams, f.teamsMode, i.team)) return false;
    if (!matchesField(f.themes, f.themesMode, i.themeId)) return false;
    if (!matchesField(f.statuses, f.statusesMode, i.status)) return false;
    if (!matchesField(f.visibility, f.visibilityMode, i.visibility)) return false;
    if (q) {
      const hay = [
        i.title,
        i.summary,
        themeName(i.themeId),
        ownerLabel(i.ownerId),
        i.team,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface Group {
  key: string;
  label: string;
  sublabel?: string;
  color?: ThemeColor;
  items: Initiative[];
}

export function groupInitiatives(
  initiatives: Initiative[],
  groupBy: GroupBy,
  themes: Theme[],
  owners: Owner[]
): Group[] {
  const groups: Group[] = [];
  const index = new Map<string, Group>();

  const ensure = (key: string, label: string, color?: ThemeColor, sublabel?: string) => {
    let g = index.get(key);
    if (!g) {
      g = { key, label, color, sublabel, items: [] };
      index.set(key, g);
      groups.push(g);
    }
    return g;
  };

  for (const i of initiatives) {
    if (groupBy === "theme") {
      const t = themes.find((x) => x.id === i.themeId);
      ensure(i.themeId, t?.name ?? "No theme", t?.color).items.push(i);
    } else if (groupBy === "team") {
      ensure(i.team, i.team).items.push(i);
    } else {
      const o = owners.find((x) => x.id === i.ownerId);
      ensure(i.ownerId, ownerName(o) || "Unassigned", undefined, o?.role).items.push(i);
    }
  }

  // Keep theme/owner order stable to their source lists.
  if (groupBy === "theme") {
    groups.sort(
      (a, b) => themes.findIndex((t) => t.id === a.key) - themes.findIndex((t) => t.id === b.key)
    );
  } else if (groupBy === "owner") {
    groups.sort(
      (a, b) => owners.findIndex((o) => o.id === a.key) - owners.findIndex((o) => o.id === b.key)
    );
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label));
  }

  return groups;
}
