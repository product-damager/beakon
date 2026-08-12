"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatShortEN } from "@/lib/dates";
import {
  HEALTH_META,
  type BusinessUnit,
  type Health,
  type Okr,
  type OkrGovernanceStatus,
  type StrategicObjective,
  type Team,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Tag } from "./ui";

type SortKey = "team" | "objective" | "quarter" | "governance" | "achievement" | "health" | "updated";
type SortState = { key: SortKey; dir: 1 | -1 };

const HEALTH_ORDER: Record<Health, number> = { on_track: 0, at_risk: 1, blocked: 2 };

/**
 * Governance workflow state — its own meaning-bearing palette (distinct from
 * STATUS_META's delivery-funnel colors), following the same tag-class shape.
 */
export const OKR_GOVERNANCE_META: Record<OkrGovernanceStatus, { label: string; tag: string; order: number }> = {
  draft: { label: "Draft", tag: "bg-beige-20 text-beige-60", order: 0 },
  to_validate: { label: "To validate", tag: "bg-blue-30 text-blue-70", order: 1 },
  being_reviewed: { label: "Being reviewed", tag: "bg-orange-30 text-orange-70", order: 2 },
  to_refine: { label: "To refine", tag: "bg-pink-30 text-pink-60", order: 3 },
  validated: { label: "Validated", tag: "bg-green-30 text-green-70", order: 4 },
  rejected: { label: "Rejected", tag: "bg-red-30 text-red-70", order: 5 },
};

/** Achievement is null when the OKR hasn't been assessed yet — mirrors the
 * DIVE "Not cast yet" convention (see lib/types.ts's scoreTier()). */
export function formatAchievement(a: number | null): string {
  return a === null ? "Not assessed yet" : `${Math.round(a * 100)}%`;
}

interface Column {
  k: SortKey;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
}

const COLUMNS: Column[] = [
  { k: "team", label: "Team" },
  { k: "objective", label: "Strategic objective" },
  { k: "quarter", label: "Quarter" },
  { k: "governance", label: "Governance" },
  { k: "achievement", label: "Achievement", align: "right" },
  { k: "health", label: "Health" },
  { k: "updated", label: "Updated", align: "right" },
];

function Th({ col, sort, onToggle }: { col: Column; sort: SortState; onToggle: (k: SortKey) => void }) {
  const { k, label, align = "left", className } = col;
  return (
    <th
      className={cn(
        "bg-beige-5 px-3 py-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <button
        onClick={() => onToggle(k)}
        className={cn(
          "mono-label flex h-10 items-center gap-1 text-beige-60 hover:text-green-90",
          align === "right" && "ml-auto",
          align === "center" && "mx-auto"
        )}
      >
        {label}
        <span className="flex w-3.5 shrink-0 justify-center text-green-60">
          {sort.key === k && (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
        </span>
      </button>
    </th>
  );
}

export function OkrList({
  okrs,
  teams,
  businessUnits,
  strategicObjectives,
  onSelect,
}: {
  okrs: Okr[];
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortState>({ key: "updated", dir: -1 });

  const getTeam = (id: string | undefined) => teams.find((t) => t.id === id);
  const getBU = (id: string | undefined) => businessUnits.find((b) => b.id === id);
  const getObjective = (id: string) => strategicObjectives.find((s) => s.id === id);

  /** "Team" column resolves to the team name, or the business unit name for
   * the (rarer) OKRs owned directly by a BU rather than a squad. */
  const ownerLabel = (o: Okr): string => {
    const team = getTeam(o.teamId);
    if (team) return team.name;
    const bu = getBU(o.businessUnitId);
    return bu ? bu.name : "—";
  };

  const sorted = useMemo(() => {
    const val = (o: Okr): string | number => {
      switch (sort.key) {
        case "team":
          return ownerLabel(o).toLowerCase();
        case "objective":
          return getObjective(o.strategicObjectiveId)?.name.toLowerCase() ?? "";
        case "quarter":
          return o.year * 10 + o.quarter;
        case "governance":
          return OKR_GOVERNANCE_META[o.governanceStatus].order;
        case "achievement":
          return o.achievement ?? -Infinity;
        case "health":
          return HEALTH_ORDER[o.health];
        case "updated":
          return o.updatedAt;
      }
    };
    return [...okrs].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ownerLabel/getObjective are derived from teams/businessUnits/strategicObjectives, already in deps below
  }, [okrs, sort, teams, businessUnits, strategicObjectives]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <div className="calm-scroll min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-beige-20">
            {COLUMNS.map((col) => (
              <Th key={col.k} col={col} sort={sort} onToggle={toggle} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => {
            const objective = getObjective(o.strategicObjectiveId);
            const governance = OKR_GOVERNANCE_META[o.governanceStatus];
            return (
              <tr
                key={o.id}
                onClick={() => {
                  if (window.getSelection()?.toString()) return;
                  onSelect(o.id);
                }}
                className="cursor-pointer border-b border-beige-10 hover:bg-beige-5"
              >
                <td className="px-3 py-2.5">
                  <span className="font-medium text-green-90">{ownerLabel(o)}</span>
                </td>
                <td className="px-3 py-2.5 text-green-70">{objective?.name ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-green-70">
                  Q{o.quarter} {o.year}
                </td>
                <td className="px-3 py-2.5">
                  <Tag className={governance.tag}>{governance.label}</Tag>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className={cn(
                      "font-display font-semibold tabular-nums",
                      o.achievement === null ? "text-beige-60" : "text-green-90"
                    )}
                  >
                    {formatAchievement(o.achievement)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("mono-label inline-flex items-center gap-1 rounded-md px-2 py-1", HEALTH_META[o.health].tag)}>
                    {HEALTH_META[o.health].label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-beige-60">
                  {formatShortEN(o.updatedAt.slice(0, 10))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="p-10 text-center text-sm text-beige-60">No OKRs match the current filters.</div>
      )}
    </div>
  );
}
