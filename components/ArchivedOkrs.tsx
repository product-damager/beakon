"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { formatShortEN } from "@/lib/dates";
import type { Toast } from "@/lib/store";
import type { BusinessUnit, Okr, StrategicObjective, Team } from "@/lib/types";
import { Tag } from "./ui";
import { Th } from "./List";
import type { Column, SortState } from "./List";
import { OKR_GOVERNANCE_META } from "./OkrList";

/**
 * OKR-side sibling of `Archived.tsx` (docs/plans/roadmap-dialog-viewmode-
 * and-archive-reversal.md T27) — mirrors its table-shell/`Th`/`SortState`
 * pattern rather than a second one, filtered on `Okr.archived` and calling
 * `unarchiveOkr` (the OKR equivalent of `unarchiveInitiative`) instead.
 *
 * Column set (Title / Objective / Team / Governance / Updated) is the OKR
 * analogue of Initiatives' Title/Owner/Team/Status/Updated reduction — per
 * product-designer's correction to this plan's own placeholder guess, OKRs
 * have no person-level "Owner" column (Team is the actual accountability
 * field); Governance renders as a plain read-only `Tag`, not the full list's
 * `InlineTagSelect` picker, and no redundant "Archived" badge per row (every
 * row here is archived by definition, same reasoning `Archived.tsx` already
 * applies).
 *
 * Not a top-level sidebar nav entry — reachable via the header-level
 * `ArchivedSwitcher` (`AppShell.tsx`, next to the page title), not an
 * in-page link.
 *
 * Row click opens the full `OkrDrawer` for detail (QA-REPORT-HERON-ARCHIVE-
 * FILTERS.md finding F1, PM-confirmed parity with `Archived.tsx`'s row
 * click) — the page owns the selection state (`onSelect`) since OKR
 * selection isn't global the way Initiative selection is.
 */
type SortKey = "title" | "objective" | "team" | "governance" | "updated";

const COLUMNS: Column<SortKey>[] = [
  { k: "title", label: "OKR", className: "w-72" },
  { k: "objective", label: "Objective", className: "w-32" },
  { k: "team", label: "Team", className: "w-40" },
  { k: "governance", label: "Governance", className: "w-40" },
  { k: "updated", label: "Updated", align: "right" },
];

export function ArchivedOkrs({
  okrs,
  teams,
  businessUnits,
  strategicObjectives,
  unarchiveOkr,
  notify,
  onSelect,
}: {
  okrs: Okr[];
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  unarchiveOkr: (id: string) => void;
  notify: (t: Omit<Toast, "id">) => void;
  /** Opens the full OkrDrawer for the clicked row (F1) — owned by the page,
   * mirroring `/okrs`' own page-scoped selection state. */
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "updated", dir: -1 });

  const getTeam = (id: string | undefined) => teams.find((t) => t.id === id);
  const getBU = (id: string | undefined) => businessUnits.find((b) => b.id === id);
  const getObjective = (id: string) => strategicObjectives.find((s) => s.id === id);
  const teamLabel = (o: Okr): string => {
    const team = getTeam(o.teamId);
    if (team) return team.name;
    const bu = getBU(o.businessUnitId);
    return bu ? bu.name : "—";
  };

  const archived = useMemo(() => okrs.filter((o) => o.archived), [okrs]);

  const sorted = useMemo(() => {
    const val = (o: Okr): string | number => {
      switch (sort.key) {
        case "title": return o.title.toLowerCase();
        case "objective": return getObjective(o.strategicObjectiveId)?.name.toLowerCase() ?? "";
        case "team": return teamLabel(o).toLowerCase();
        case "governance": return OKR_GOVERNANCE_META[o.governanceStatus].order;
        case "updated": return o.updatedAt;
      }
    };
    return [...archived].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamLabel/getObjective derive from teams/businessUnits/strategicObjectives, not independently reactive
  }, [archived, sort, teams, businessUnits, strategicObjectives]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-beige-20 bg-white">
          <div className="calm-scroll min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-beige-20">
                  {COLUMNS.map((col) => (
                    <Th key={col.k} col={col} sort={sort} onToggle={toggle} />
                  ))}
                  {/* Row-action column — no header label, matches the width of the
                   * hover-visible Restore button it holds. */}
                  <th className="w-10 bg-beige-20 px-2 py-0" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => {
                  const objective = getObjective(o.strategicObjectiveId);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        if (window.getSelection()?.toString()) return;
                        onSelect(o.id);
                      }}
                      className="group cursor-pointer border-b border-beige-10 hover:bg-beige-10"
                    >
                      <td className="w-72 max-w-0 px-3 py-2.5">
                        <span
                          className="block truncate font-medium text-green-90"
                          title={o.title || "Untitled OKR"}
                        >
                          {o.title || "Untitled OKR"}
                        </span>
                      </td>
                      <td className="w-32 max-w-0 truncate px-3 py-2.5 text-green-70" title={objective?.name}>
                        {objective?.name ?? "—"}
                      </td>
                      <td className="w-40 max-w-0 truncate px-3 py-2.5 text-green-70" title={teamLabel(o)}>
                        {teamLabel(o)}
                      </td>
                      <td className="w-40 px-3 py-2.5">
                        <Tag shape="square" className={OKR_GOVERNANCE_META[o.governanceStatus].tag}>
                          {OKR_GOVERNANCE_META[o.governanceStatus].label}
                        </Tag>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-beige-70">
                        Updated {formatShortEN(o.updatedAt.slice(0, 10))}
                      </td>
                      <td className="w-10 px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unarchiveOkr(o.id);
                            notify({ message: `“${o.title || "Untitled OKR"}” restored`, tone: "success" });
                          }}
                          aria-label={`Restore ${o.title || "Untitled OKR"}`}
                          title="Restore"
                          className="rounded-md p-1.5 text-beige-60 opacity-0 transition-opacity hover:bg-beige-20 hover:text-green-90 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <ArchiveRestore size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <div className="p-6">
                <div className="rounded-2xl border border-dashed border-beige-30 bg-beige-5/50 px-8 py-12 text-center">
                  <div className="font-display text-lg font-semibold text-green-90">Nothing archived</div>
                  <p className="mt-1 text-sm text-beige-60">OKRs you archive will collect here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
