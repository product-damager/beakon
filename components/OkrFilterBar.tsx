"use client";

import { RotateCcw } from "lucide-react";
import type { BusinessUnit, Okr, OkrGovernanceStatus, StrategicObjective, Team } from "@/lib/types";
import { NativeSelect } from "./form";
import { Button } from "./ui";
import { OKR_GOVERNANCE_META } from "./OkrList";

/**
 * OKR filter dimensions — deliberately its own shape, not lib/filters.ts's
 * Filters type (that one is Initiative-shaped: theme/owner/team/status).
 * Quarter/team/BU/strategic-objective/governance-status are a different
 * domain; forcing them through a shared type would couple two unrelated
 * models for reuse's sake alone.
 */
export interface OkrFilters {
  quarter: number | null;
  teamId: string | null;
  businessUnitId: string | null;
  strategicObjectiveId: string | null;
  governanceStatus: OkrGovernanceStatus | null;
}

export const EMPTY_OKR_FILTERS: OkrFilters = {
  quarter: null,
  teamId: null,
  businessUnitId: null,
  strategicObjectiveId: null,
  governanceStatus: null,
};

export function okrFilterCount(f: OkrFilters): number {
  return Object.values(f).filter((v) => v !== null).length;
}

/** Apply the current OkrFilters to a list of OKRs. BU filter matches either a
 * direct business-unit OKR or a team OKR whose team belongs to that BU. */
export function applyOkrFilters(okrs: Okr[], filters: OkrFilters, teams: Team[]): Okr[] {
  return okrs.filter((o) => {
    if (filters.quarter !== null && o.quarter !== filters.quarter) return false;
    if (filters.governanceStatus !== null && o.governanceStatus !== filters.governanceStatus) return false;
    if (filters.strategicObjectiveId !== null && o.strategicObjectiveId !== filters.strategicObjectiveId)
      return false;
    if (filters.teamId !== null && o.teamId !== filters.teamId) return false;
    if (filters.businessUnitId !== null) {
      const team = o.teamId ? teams.find((t) => t.id === o.teamId) : undefined;
      const bu = o.businessUnitId ?? team?.businessUnitId;
      if (bu !== filters.businessUnitId) return false;
    }
    return true;
  });
}

const GOVERNANCE_STATUSES: OkrGovernanceStatus[] = [
  "draft",
  "to_validate",
  "being_reviewed",
  "to_refine",
  "validated",
  "rejected",
];

export function OkrFilterBar({
  filters,
  onChange,
  teams,
  businessUnits,
  strategicObjectives,
}: {
  filters: OkrFilters;
  onChange: (patch: Partial<OkrFilters>) => void;
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
}) {
  const activeCount = okrFilterCount(filters);

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b border-beige-20 bg-background/90 px-6 py-3 backdrop-blur">
      <NativeSelect
        aria-label="Quarter"
        value={filters.quarter ?? ""}
        onChange={(e) => onChange({ quarter: e.target.value ? Number(e.target.value) : null })}
        className="w-32"
      >
        <option value="">All quarters</option>
        {[1, 2, 3, 4].map((q) => (
          <option key={q} value={q}>
            Q{q}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Team"
        value={filters.teamId ?? ""}
        onChange={(e) => onChange({ teamId: e.target.value || null })}
        className="w-44"
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Business unit"
        value={filters.businessUnitId ?? ""}
        onChange={(e) => onChange({ businessUnitId: e.target.value || null })}
        className="w-44"
      >
        <option value="">All business units</option>
        {businessUnits.map((bu) => (
          <option key={bu.id} value={bu.id}>
            {bu.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Strategic objective"
        value={filters.strategicObjectiveId ?? ""}
        onChange={(e) => onChange({ strategicObjectiveId: e.target.value || null })}
        className="w-56"
      >
        <option value="">All strategic objectives</option>
        {strategicObjectives.map((so) => (
          <option key={so.id} value={so.id}>
            {so.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Governance status"
        value={filters.governanceStatus ?? ""}
        onChange={(e) =>
          onChange({ governanceStatus: (e.target.value || null) as OkrGovernanceStatus | null })
        }
        className="w-48"
      >
        <option value="">All governance statuses</option>
        {GOVERNANCE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {OKR_GOVERNANCE_META[s].label}
          </option>
        ))}
      </NativeSelect>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_OKR_FILTERS)}>
          <RotateCcw size={14} /> Clear all
        </Button>
      )}
    </div>
  );
}
