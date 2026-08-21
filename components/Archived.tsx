"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { applyFilters } from "@/lib/filters";
import { formatShortEN } from "@/lib/dates";
import { ownerName, STATUSES, type Initiative } from "@/lib/types";
import { Avatar, StatusTag } from "./ui";
import { FilterBar } from "./FilterBar";
import { Th } from "./List";
import type { Column, SortState } from "./List";

/**
 * Sibling of List.tsx rather than a second, parallel card-list layout (Sprint
 * Heron Week 1 — docs/design/archived-view.md finding 1, option (a)): reuses
 * the same table shell/sortable-Th/FilterBar machinery, with `archived: true`
 * passed into applyFilters instead of List's default (active-only) view.
 *
 * Column set is intentionally smaller than List's: Title, Owner, Team,
 * Status, Updated. DIVE/Health/Target are dropped — post-archive, only
 * identity (title/owner/team) + resolution status (Status) + who/when
 * (Updated) matter; a stale DIVE score or target date on a shelved
 * initiative isn't information worth a column (docs/design/archived-view.md
 * finding 4).
 */
type SortKey = "title" | "owner" | "team" | "status" | "updated";

const COLUMNS: Column<SortKey>[] = [
  { k: "title", label: "Initiative", className: "w-72" },
  { k: "owner", label: "Owner", className: "w-40" },
  { k: "team", label: "Team", className: "w-40" },
  { k: "status", label: "Status" },
  { k: "updated", label: "Updated", align: "right" },
];

export function Archived() {
  const {
    initiatives,
    filters,
    themes,
    owners,
    teams,
    getOwner,
    getTeam,
    select,
    unarchiveInitiative,
    notify,
  } = useRoadmap();
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "updated", dir: -1 });

  const filtered = useMemo(
    () => applyFilters(initiatives, filters, themes, owners, teams, { archived: true }),
    [initiatives, filters, themes, owners, teams]
  );

  const sorted = useMemo(() => {
    const val = (i: Initiative): string | number => {
      switch (sort.key) {
        case "title": return i.title.toLowerCase();
        case "owner": return ownerName(getOwner(i.ownerId)).toLowerCase();
        case "team": return (getTeam(i.teamId)?.name ?? "").toLowerCase();
        case "status": return STATUSES.indexOf(i.status);
        case "updated": return i.updatedAt;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [filtered, sort, getOwner, getTeam]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <div className="flex h-full flex-col">
      <FilterBar />
      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-beige-20 bg-white">
          <p className="border-b border-beige-20 bg-beige-5/60 px-4 py-2.5 text-xs text-beige-60">
            Archived initiatives are hidden from Timeline, Board and List. Restore one to bring it
            back wherever it was.
          </p>
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
                {sorted.map((i) => {
                  const owner = getOwner(i.ownerId);
                  const team = getTeam(i.teamId);
                  return (
                    <tr
                      key={i.id}
                      onClick={() => {
                        if (window.getSelection()?.toString()) return;
                        select(i.id);
                      }}
                      className="group cursor-pointer border-b border-beige-10 hover:bg-beige-10"
                    >
                      <td className="w-72 max-w-0 px-3 py-2.5">
                        <span
                          className="block truncate font-medium text-green-90"
                          title={i.title || "Untitled initiative"}
                        >
                          {i.title || "Untitled initiative"}
                        </span>
                      </td>
                      <td className="w-40 max-w-0 px-3 py-2.5">
                        <span className="flex items-center gap-2 text-green-90">
                          {owner && <Avatar name={ownerName(owner)} className="h-6 w-6 shrink-0 text-[10px]" neutral />}
                          <span className="truncate" title={ownerName(owner)}>{ownerName(owner)}</span>
                        </span>
                      </td>
                      <td className="w-40 max-w-0 truncate px-3 py-2.5 text-green-70" title={team?.name}>
                        {team?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusTag status={i.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-beige-70">
                        Updated {formatShortEN(i.updatedAt.slice(0, 10))}
                      </td>
                      <td className="w-10 px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unarchiveInitiative(i.id);
                            notify({ message: `“${i.title || "Untitled initiative"}” restored`, tone: "success" });
                          }}
                          aria-label={`Restore ${i.title || "Untitled initiative"}`}
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
                  <p className="mt-1 text-sm text-beige-60">Initiatives you archive will collect here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
