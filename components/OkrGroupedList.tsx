"use client";

import { Fragment, useMemo } from "react";
import { useRoadmap } from "@/lib/store";
import { formatShortEN } from "@/lib/dates";
import { groupOkrs, type OkrTeamGroup } from "@/lib/okrGrouping";
import type { OkrFilters } from "@/lib/okrFilters";
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
import { GroupHeaderContent, HealthTag, Tag } from "./ui";
import { InlineTagSelect } from "./form";
import {
  GOVERNANCE_KEYS,
  HEALTH_KEYS,
  OKR_COLUMN_WIDTH,
  OKR_COLUMNS,
  OKR_GOVERNANCE_META,
  STRATEGIC_OBJECTIVE_ALIAS,
  formatAchievement,
} from "./OkrList";

/**
 * Grouped OKR table — replaces the old flat `OkrList` at `/okrs` (Sprint
 * Vireo, Initiative 1). One `<table>` with a static (non-sortable) `<thead>`
 * and a `<tbody>` where each BU/Team band is a spanning row and each OKR is
 * its own row (row markup carried over — not duplicated — from the deleted
 * `OkrList()`'s tbody block).
 */
export function OkrGroupedList({
  okrs,
  teams,
  businessUnits,
  strategicObjectives,
  okrOwners,
  okrInitiatives,
  filters,
  collapsed,
  onToggleGroup,
  saveOkr,
  onSelect,
}: {
  okrs: Okr[];
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
  filters: OkrFilters;
  /** Keyed by the same "bu:<id>"/"team:<id>" keys `groupOkrs` produces — `true` = collapsed. */
  collapsed: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  saveOkr: (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => void;
  onSelect: (id: string) => void;
}) {
  const { notify } = useRoadmap();

  const getObjective = (id: string) => strategicObjectives.find((s) => s.id === id);
  const getTeam = (id: string | undefined) => teams.find((t) => t.id === id);
  const getBU = (id: string | undefined) => businessUnits.find((b) => b.id === id);
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

  const groups = useMemo(
    () => groupOkrs(okrs, teams, businessUnits, filters),
    [okrs, teams, businessUnits, filters]
  );

  const renderRow = (o: Okr) => {
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
        <td className={cn(OKR_COLUMN_WIDTH.title, "max-w-0 px-3 py-2.5")}>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn("truncate font-medium", o.archived ? "text-beige-70" : "text-green-90")}
              title={o.title || "Untitled OKR"}
            >
              {o.title || "Untitled OKR"}
            </span>
            {o.archived && <Tag className="shrink-0 bg-beige-20 text-beige-70">Archived</Tag>}
          </span>
        </td>
        <td
          className={cn(OKR_COLUMN_WIDTH.objective, "max-w-0 truncate px-3 py-2.5 text-green-70")}
          title={objective?.name}
        >
          {objective ? (STRATEGIC_OBJECTIVE_ALIAS[objective.id] ?? objective.name) : "—"}
        </td>
        <td className={cn(OKR_COLUMN_WIDTH.quarter, "truncate whitespace-nowrap px-3 py-2.5 text-green-70")}>
          Q{o.quarter} {o.year}
        </td>
        <td className={cn(OKR_COLUMN_WIDTH.governance, "p-0")}>
          <InlineTagSelect
            fill
            label="Change governance"
            value={o.governanceStatus}
            options={GOVERNANCE_KEYS}
            render={(g: OkrGovernanceStatus) => (
              <Tag shape="square" className={OKR_GOVERNANCE_META[g].tag}>
                <span className="min-w-0 truncate">{OKR_GOVERNANCE_META[g].label}</span>
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
        <td className={cn(OKR_COLUMN_WIDTH.health, "p-0")}>
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
        <td className={cn(OKR_COLUMN_WIDTH.team, "max-w-0 truncate px-3 py-2.5")} title={ownerLabel(o)}>
          <span className="text-green-70">{ownerLabel(o)}</span>
        </td>
        <td className={cn(OKR_COLUMN_WIDTH.achievement, "px-3 py-2.5 text-right")}>
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
        <td className={cn(OKR_COLUMN_WIDTH.updated, "truncate whitespace-nowrap px-3 py-2.5 text-right text-beige-60")}>
          {formatShortEN(o.updatedAt.slice(0, 10))}
        </td>
      </tr>
    );
  };

  const renderTeamGroup = (team: OkrTeamGroup) => {
    const teamCollapsed = Boolean(collapsed[team.key]);
    return (
      <Fragment key={team.key}>
        <tr className="border-y border-beige-20 bg-white">
          <td colSpan={OKR_COLUMNS.length} className="p-0">
            <button
              type="button"
              onClick={() => onToggleGroup(team.key)}
              aria-expanded={!teamCollapsed}
              aria-label={`${teamCollapsed ? "Expand" : "Collapse"} ${team.team.name}`}
              className="flex w-full items-center px-6 py-2 text-left transition-colors hover:bg-beige-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-90"
            >
              <GroupHeaderContent
                depth={1}
                label={team.team.name}
                count={team.okrs.length}
                isCollapsed={teamCollapsed}
              />
            </button>
          </td>
        </tr>
        {!teamCollapsed &&
          (team.okrs.length > 0 ? (
            team.okrs.map((o) => renderRow(o))
          ) : (
            <tr key={`${team.key}-empty`}>
              <td colSpan={OKR_COLUMNS.length} className="px-6 py-3 pl-11 text-sm text-beige-60">
                No OKRs.
              </td>
            </tr>
          ))}
      </Fragment>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-hidden p-6">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-beige-20 bg-white">
        <div className="calm-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-beige-20">
                {OKR_COLUMNS.map((col) => (
                  <th
                    key={col.k}
                    className={cn(
                      "mono-label truncate overflow-hidden bg-beige-20 px-3 py-2.5 text-left text-beige-60",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((bu) => {
                const buCollapsed = Boolean(collapsed[bu.key]);
                const buEmpty = bu.totalCount === 0;
                return (
                  <Fragment key={bu.key}>
                    <tr className="border-y border-beige-40 bg-beige-20/70">
                      <td colSpan={OKR_COLUMNS.length} className="p-0">
                        {(() => {
                          // Defensive "unassigned" bucket (bu.bu === null) has no
                          // BU to attach a toggle to conceptually, but is still a
                          // depth-0 band like any other BU — same header
                          // component/health-rollup treatment either way.
                          const label = bu.bu === null ? "Unassigned" : bu.bu.name;
                          return (
                            <button
                              type="button"
                              onClick={() => onToggleGroup(bu.key)}
                              aria-expanded={!buCollapsed}
                              aria-label={`${buCollapsed ? "Expand" : "Collapse"} ${label}`}
                              className="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-beige-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-90"
                            >
                              <GroupHeaderContent
                                depth={0}
                                label={label}
                                count={bu.totalCount}
                                isCollapsed={buCollapsed}
                              />
                              {!buEmpty && (
                                <span className="mr-2 flex shrink-0 items-center gap-2">
                                  {(Object.keys(bu.healthCounts) as Health[])
                                    .filter((h) => bu.healthCounts[h] > 0)
                                    .map((h) => (
                                      <span
                                        key={h}
                                        className="flex items-center gap-1"
                                        title={`${bu.healthCounts[h]} ${HEALTH_META[h].label}`}
                                      >
                                        <span className={cn("h-2 w-2 rounded-full", HEALTH_META[h].dot)} />
                                        <span className="mono-label-sm text-beige-60">
                                          {bu.healthCounts[h]}
                                        </span>
                                      </span>
                                    ))}
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                    {!buCollapsed && (
                      <>
                        {buEmpty && (
                          <tr key={`${bu.key}-empty`}>
                            <td colSpan={OKR_COLUMNS.length} className="px-6 py-3 pl-6 text-sm text-beige-60">
                              No OKRs.
                            </td>
                          </tr>
                        )}
                        {bu.bu !== null && bu.directOkrs.length > 0 && (
                          <>
                            <tr key={`${bu.key}-direct-label`}>
                              <td colSpan={OKR_COLUMNS.length} className="px-6 py-1.5">
                                <GroupHeaderContent
                                  depth={1}
                                  label={`Direct to ${bu.bu.name}`}
                                  collapsible={false}
                                />
                              </td>
                            </tr>
                            {bu.directOkrs.map((o) => renderRow(o))}
                          </>
                        )}
                        {bu.bu === null &&
                          bu.directOkrs.map((o) => renderRow(o))}
                        {bu.teamGroups.map((team) => renderTeamGroup(team))}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-beige-60">No OKRs match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
