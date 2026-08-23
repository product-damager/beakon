"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { formatShortEN } from "@/lib/dates";
import {
  HEALTH_META,
  type BusinessUnit,
  type Health,
  type Okr,
  type OkrGovernanceStatus,
  type OkrInitiativeLink,
  type OkrOwner,
  type StrategicObjective,
  type Team,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { HealthTag, Tag } from "./ui";
import { InlineTagSelect } from "./form";

type SortKey = "title" | "team" | "objective" | "quarter" | "governance" | "health" | "achievement" | "updated";
type SortState = { key: SortKey; dir: 1 | -1 };

const HEALTH_ORDER: Record<Health, number> = { on_track: 0, at_risk: 1, blocked: 2, delayed: 3 };
/** Health values in severity order, for the inline picker options. */
const HEALTH_KEYS = Object.keys(HEALTH_META) as Health[];

/**
 * Governance workflow state — its own meaning-bearing palette (distinct from
 * STATUS_META's delivery-funnel colors), following the same tag-class shape.
 */
export const OKR_GOVERNANCE_META: Record<OkrGovernanceStatus, { label: string; tag: string; order: number }> = {
  // bg-beige-20/text-beige-60 measured ~2.98:1 on white — fails WCAG AA
  // (4.5:1). text-beige-70 (~5.4:1 on white, ~4.7:1 on this bg) keeps Draft
  // the visually quietest of the six governance states without the fail.
  draft: { label: "Draft", tag: "bg-beige-20 text-beige-70", order: 0 },
  to_validate: { label: "To validate", tag: "bg-blue-30 text-blue-70", order: 1 },
  being_reviewed: { label: "Being reviewed", tag: "bg-orange-30 text-orange-70", order: 2 },
  to_refine: { label: "To refine", tag: "bg-pink-30 text-pink-60", order: 3 },
  validated: { label: "Validated", tag: "bg-green-30 text-green-70", order: 4 },
  rejected: { label: "Rejected", tag: "bg-red-30 text-red-70", order: 5 },
};
/** Governance values in workflow order, for the inline picker options. */
const GOVERNANCE_KEYS = Object.keys(OKR_GOVERNANCE_META) as OkrGovernanceStatus[];

/** Short column alias per strategic objective, so the list column doesn't
 * have to carry each objective's full name ("Core: Strengthening our
 * foundations", etc.) — the full name is still available via a `title`
 * tooltip at the call site. Keyed by id, not parsed from the name string,
 * so it doesn't silently break if naming conventions change. Falls back to
 * the full name for any future objective not yet given a short alias. */
const STRATEGIC_OBJECTIVE_ALIAS: Record<string, string> = {
  "so-core": "Core",
  "so-ai": "AI",
  "so-data": "Data",
  "so-internal": "Internal",
};

/** Achievement is null when the OKR hasn't been assessed yet — mirrors the
 * DIVE "Not cast yet" convention (see lib/types.ts's scoreTier()). Rendered
 * as the shorter "N/A" to keep the list column compact; a `title` tooltip
 * at the call site spells out "Not assessed yet" for anyone who hovers. */
export function formatAchievement(a: number | null): string {
  return a === null ? "N/A" : `${Math.round(a * 100)}%`;
}

interface Column {
  k: SortKey;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
}

const COLUMNS: Column[] = [
  { k: "title", label: "Title", className: "w-80" },
  { k: "objective", label: "Objective", className: "w-20" },
  { k: "quarter", label: "Quarter" },
  { k: "governance", label: "Governance", className: "w-44" },
  { k: "health", label: "Health", className: "w-32" },
  { k: "team", label: "Team", className: "w-28" },
  { k: "achievement", label: "Achievement", align: "right", className: "w-28" },
  { k: "updated", label: "Updated", align: "right" },
];

function Th({ col, sort, onToggle }: { col: Column; sort: SortState; onToggle: (k: SortKey) => void }) {
  const { k, label, align = "left", className } = col;
  const active = sort.key === k;
  const chevron = active && (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />);
  return (
    <th
      className={cn(
        "bg-beige-20 px-3 py-0",
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
        {/* For right-aligned columns, the reserved chevron slot goes first so
         * the label's own right edge — not the (often empty) chevron slot —
         * lands flush against the column's true right edge, matching the
         * right-aligned value below it instead of reading as shifted left. */}
        {align === "right" && <span className="flex w-3.5 shrink-0 justify-center text-green-60">{chevron}</span>}
        {label}
        {align !== "right" && <span className="flex w-3.5 shrink-0 justify-center text-green-60">{chevron}</span>}
      </button>
    </th>
  );
}

export function OkrList({
  okrs,
  teams,
  businessUnits,
  strategicObjectives,
  okrOwners,
  okrInitiatives,
  saveOkr,
  onSelect,
}: {
  okrs: Okr[];
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
  saveOkr: (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => void;
  onSelect: (id: string) => void;
}) {
  const { notify } = useRoadmap();
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

  // Inline governance/health edits go through saveOkr(), which replaces an
  // OKR's owners/initiative links wholesale — pass the current ones through
  // unchanged so an inline edit here never silently drops them (mirrors how
  // OkrDrawer's patch() always re-sends ownersDraft/initiativeIdsDraft).
  const ownersFor = (id: string) => okrOwners.filter((o) => o.okrId === id);
  const initiativeIdsFor = (id: string) =>
    okrInitiatives.filter((l) => l.okrId === id).map((l) => l.initiativeId);

  const sorted = useMemo(() => {
    const val = (o: Okr): string | number => {
      switch (sort.key) {
        case "title":
          return o.title.toLowerCase();
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
    <div className="min-h-0 flex-1 overflow-hidden p-6">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-beige-20 bg-white">
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
                return (
                  <tr
                    key={o.id}
                    onClick={() => {
                      if (window.getSelection()?.toString()) return;
                      onSelect(o.id);
                    }}
                    className="cursor-pointer border-b border-beige-10 hover:bg-beige-10"
                  >
                    <td className="w-80 max-w-0 px-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "truncate font-medium",
                            o.archived ? "text-beige-70" : "text-green-90"
                          )}
                          title={o.title || "Untitled OKR"}
                        >
                          {o.title || "Untitled OKR"}
                        </span>
                        {o.archived && (
                          <Tag className="shrink-0 bg-beige-20 text-beige-70">Archived</Tag>
                        )}
                      </span>
                    </td>
                    <td className="w-20 max-w-0 truncate px-3 py-2.5 text-green-70" title={objective?.name}>
                      {objective ? (STRATEGIC_OBJECTIVE_ALIAS[objective.id] ?? objective.name) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-green-70">
                      Q{o.quarter} {o.year}
                    </td>
                    <td className="w-44 p-0">
                      <InlineTagSelect
                        fill
                        label="Change governance"
                        value={o.governanceStatus}
                        options={GOVERNANCE_KEYS}
                        render={(g: OkrGovernanceStatus) => (
                          <Tag shape="square" className={OKR_GOVERNANCE_META[g].tag}>
                            {OKR_GOVERNANCE_META[g].label}
                          </Tag>
                        )}
                        onSelect={(governanceStatus) => {
                          saveOkr({ ...o, governanceStatus }, ownersFor(o.id), initiativeIdsFor(o.id));
                          notify({
                            message: `Governance set to ${OKR_GOVERNANCE_META[governanceStatus].label}`,
                            tone: "success",
                          });
                        }}
                      />
                    </td>
                    <td className="w-32 p-0">
                      <InlineTagSelect
                        fill
                        label="Change health"
                        value={o.health}
                        options={HEALTH_KEYS}
                        render={(h: Health) => <HealthTag health={h} shape="square" />}
                        onSelect={(health) => {
                          saveOkr({ ...o, health }, ownersFor(o.id), initiativeIdsFor(o.id));
                          notify({ message: `Health set to ${HEALTH_META[health].label}`, tone: "success" });
                        }}
                      />
                    </td>
                    <td className="w-28 max-w-0 truncate px-3 py-2.5" title={ownerLabel(o)}>
                      <span className="text-green-70">{ownerLabel(o)}</span>
                    </td>
                    <td className="w-28 px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "font-display font-semibold tabular-nums",
                          o.achievement === null ? "text-beige-60" : "text-green-90"
                        )}
                        title={o.achievement === null ? "Not assessed yet" : undefined}
                      >
                        {formatAchievement(o.achievement)}
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
      </div>
    </div>
  );
}
