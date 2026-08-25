"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { applyFilters } from "@/lib/filters";
import { formatShortEN, quarterLabelFromISO } from "@/lib/dates";
import {
  diveScore,
  HEALTH_META,
  ownerName,
  scoreTier,
  STATUS_META,
  STATUSES,
  THEME_COLOR_META,
  type Health,
  type Initiative,
  type Status,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, HealthTag, StatusTag, Tag } from "./ui";
import { InlineTagSelect } from "./form";
import { FilterBar } from "./FilterBar";

type SortKey = "title" | "owner" | "team" | "theme" | "status" | "target" | "priority" | "health" | "updated";

const HEALTH_ORDER: Record<Health, number> = { on_track: 0, at_risk: 1, blocked: 2, delayed: 3 };
/** Health values in severity order, for the inline picker options. */
const HEALTH_KEYS = Object.keys(HEALTH_META) as Health[];

export type SortState<K extends string = string> = { key: K; dir: 1 | -1 };

export interface Column<K extends string = string> {
  k: K;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
}

const COLUMNS: Column<SortKey>[] = [
  { k: "title", label: "Initiative", className: "w-[28%]" },
  { k: "owner", label: "Owner", className: "w-[14%]" },
  { k: "status", label: "Status", className: "w-[14%]" },
  { k: "health", label: "Health", className: "w-[10%]" },
  { k: "target", label: "Target", className: "w-[9%]" },
  { k: "team", label: "Team", className: "w-[10%]" },
  { k: "priority", label: "DIVE", align: "right", className: "w-[8%]" },
  { k: "updated", label: "Updated", align: "right", className: "w-[7%]" },
];

/** Every cell (header and body) pulls its width from here, so header and
 * body can't drift apart the way separately hand-typed `w-*` classes did
 * before (Target/Updated previously had no width at all, which is what let
 * them stretch unpredictably under `table-layout: auto` at lower zoom). */
const COLUMN_WIDTH: Record<SortKey, string | undefined> = Object.fromEntries(
  COLUMNS.map((c) => [c.k, c.className])
) as Record<SortKey, string | undefined>;

/**
 * Sortable column header. Module-level so it isn't re-created on every
 * render. Generic over the sort-key union so Archived.tsx (its own, smaller
 * column set) can reuse this exact table-header shell instead of a second
 * near-identical component.
 */
export function Th<K extends string>({
  col,
  sort,
  onToggle,
}: {
  col: Column<K>;
  sort: SortState<K>;
  onToggle: (k: K) => void;
}) {
  const { k, label, align = "left", className } = col;
  const active = sort.key === k;
  // Reserve the chevron slot always, so toggling sort never reflows the column.
  const chevron = active && (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />);
  return (
    <th
      className={cn(
        "overflow-hidden bg-beige-20 px-3 py-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <button
        onClick={() => onToggle(k)}
        className={cn(
          "mono-label flex h-10 min-w-0 items-center gap-1 text-beige-60 hover:text-green-90",
          align === "right" && "ml-auto",
          align === "center" && "mx-auto"
        )}
      >
        {/* For right-aligned columns, the chevron slot goes first so the label's
         * own right edge — not the (often empty) chevron slot — lands flush
         * against the column's true right edge, matching the right-aligned
         * value below it instead of reading as shifted left. */}
        {align === "right" && <span className="flex w-3.5 shrink-0 justify-center text-green-60">{chevron}</span>}
        <span className="truncate">{label}</span>
        {align !== "right" && <span className="flex w-3.5 shrink-0 justify-center text-green-60">{chevron}</span>}
      </button>
    </th>
  );
}

export function List() {
  const {
    initiatives,
    filters,
    themes,
    owners,
    teams,
    getOwner,
    getTheme,
    getTeam,
    select,
    saveInitiative,
    notify,
  } = useRoadmap();
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "priority", dir: -1 });

  const filtered = useMemo(
    () => applyFilters(initiatives, filters, themes, owners, teams),
    [initiatives, filters, themes, owners, teams]
  );

  const sorted = useMemo(() => {
    const val = (i: Initiative): string | number => {
      switch (sort.key) {
        case "title": return i.title.toLowerCase();
        case "owner": return ownerName(getOwner(i.ownerId)).toLowerCase();
        case "team": return (getTeam(i.teamId)?.name ?? "").toLowerCase();
        case "theme": return getTheme(i.themeId)?.name.toLowerCase() ?? "";
        case "status": return STATUSES.indexOf(i.status);
        case "target": return i.targetEnd;
        case "priority": return diveScore(i.scores) ?? -Infinity;
        case "health": return HEALTH_ORDER[i.health];
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
  }, [filtered, sort, getOwner, getTheme, getTeam]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <div className="flex h-full flex-col">
      <FilterBar />
      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-beige-20 bg-white">
          <div className="calm-scroll min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-beige-20">
                  {COLUMNS.map((col) => (
                    <Th key={col.k} col={col} sort={sort} onToggle={toggle} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((i) => {
                  const owner = getOwner(i.ownerId);
                  const theme = getTheme(i.themeId);
                  const team = getTeam(i.teamId);
                  const score = diveScore(i.scores);
                  const tier = scoreTier(score);
                  return (
                    <tr
                      key={i.id}
                      onClick={() => {
                        // Don't make click on a text drag-selection as a row click.
                        if (window.getSelection()?.toString()) return;
                        select(i.id);
                      }}
                      className="cursor-pointer border-b border-beige-10 hover:bg-beige-10"
                    >
                      <td className={cn(COLUMN_WIDTH.title, "max-w-0 px-3 py-2.5")}>
                        <div className="flex min-w-0 items-center gap-2">
                          {theme && (
                            <span className={cn("h-3 w-1 shrink-0 rounded-[2px]", THEME_COLOR_META[theme.color].dot)} />
                          )}
                          <span
                            className={cn(
                              "truncate font-medium",
                              i.archived ? "text-beige-70" : "text-green-90"
                            )}
                            title={i.title || "Untitled initiative"}
                          >
                            {i.title || "Untitled initiative"}
                          </span>
                          {i.archived && (
                            <Tag className="shrink-0 bg-beige-20 text-beige-70">Archived</Tag>
                          )}
                          {i.visibility === "external" && (
                            <span className="mono-label-sm shrink-0 rounded bg-beige-20 px-1.5 py-0.5 text-beige-60">
                              Ext
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn(COLUMN_WIDTH.owner, "max-w-0 px-3 py-2.5")}>
                        <span className="flex items-center gap-2 text-green-90">
                          {owner && <Avatar name={ownerName(owner)} className="h-6 w-6 shrink-0 text-[10px]" neutral />}
                          <span className="truncate" title={ownerName(owner)}>{ownerName(owner)}</span>
                        </span>
                      </td>
                      <td className={cn(COLUMN_WIDTH.status, "overflow-hidden p-0")}>
                        <InlineTagSelect
                          fill
                          label="Change status"
                          value={i.status}
                          options={STATUSES}
                          render={(s: Status) => <StatusTag status={s} />}
                          onSelect={(status) => {
                            saveInitiative({ ...i, status });
                            notify({ message: `Status set to ${STATUS_META[status].label}`, tone: "success" });
                          }}
                        />
                      </td>
                      <td className={cn(COLUMN_WIDTH.health, "overflow-hidden p-0")}>
                        <InlineTagSelect
                          fill
                          label="Change health"
                          value={i.health}
                          options={HEALTH_KEYS}
                          render={(h: Health) => <HealthTag health={h} />}
                          onSelect={(health) => {
                            saveInitiative({ ...i, health });
                            notify({ message: `Health set to ${HEALTH_META[health].label}`, tone: "success" });
                          }}
                        />
                      </td>
                      <td className={cn(COLUMN_WIDTH.target, "truncate whitespace-nowrap px-3 py-2.5 text-green-70")}>
                        {quarterLabelFromISO(i.targetEnd)}
                      </td>
                      <td className={cn(COLUMN_WIDTH.team, "max-w-0 truncate px-3 py-2.5 text-green-70")} title={team?.name}>
                        {team?.name ?? "—"}
                      </td>
                      <td className={cn(COLUMN_WIDTH.priority, "px-3 py-2.5 text-right")}>
                        <span
                          className="inline-flex items-center justify-end gap-1"
                          title={score === null ? tier.label : `${tier.label} · DIVE ${score}`}
                        >
                          <span aria-hidden>{tier.emoji}</span>
                          <span className="font-display font-semibold tabular-nums text-green-90">
                            {score ?? "—"}
                          </span>
                        </span>
                      </td>
                      <td className={cn(COLUMN_WIDTH.updated, "truncate whitespace-nowrap px-3 py-2.5 text-right text-beige-60")}>
                        {formatShortEN(i.updatedAt.slice(0, 10))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 && (
              <div className="p-10 text-center text-sm text-beige-60">No initiatives match the current filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
