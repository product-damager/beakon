"use client";

import {
  ArrowUpRight,
  Building2,
  CalendarRange,
  Flag,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { ownerName } from "@/lib/types";
import type {
  BusinessUnit,
  Okr,
  OkrOwner,
  StrategicObjective,
  Team,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Drawer } from "./Drawer";
import { Avatar, Eyebrow, HealthTag, StatusTag, Tag } from "./ui";
import { OKR_GOVERNANCE_META, formatAchievement } from "./OkrList";

const OKR_CLASS_LABEL: Record<NonNullable<Okr["okrClass"]>, string> = {
  committed: "Committed",
  conditional: "Conditional",
  optional: "Optional",
};

function Prop({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-beige-60" />
      <div className="min-w-0">
        <div className="mono-label-sm text-beige-60">{label}</div>
        <div className="mt-0.5 text-sm text-green-90">{children}</div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <p className="whitespace-pre-line text-sm leading-relaxed text-green-90">{children}</p>
    </div>
  );
}

export function OkrDrawer({
  okr,
  onClose,
  teams,
  businessUnits,
  strategicObjectives,
  okrOwners,
  okrInitiatives,
}: {
  okr: Okr | undefined;
  onClose: () => void;
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  okrOwners: OkrOwner[];
  okrInitiatives: { okrId: string; initiativeId: string }[];
}) {
  // Owners and initiatives are already loaded globally via useRoadmap() —
  // reuse them rather than refetching for this read-only join.
  const { owners, initiatives, select } = useRoadmap();

  const team = okr?.teamId ? teams.find((t) => t.id === okr.teamId) : undefined;
  const businessUnit = okr?.businessUnitId
    ? businessUnits.find((b) => b.id === okr.businessUnitId)
    : team
      ? businessUnits.find((b) => b.id === team.businessUnitId)
      : undefined;
  const objective = okr ? strategicObjectives.find((s) => s.id === okr.strategicObjectiveId) : undefined;

  const linkedOwners = okr ? okrOwners.filter((o) => o.okrId === okr.id) : [];
  const linkedInitiativeIds = okr
    ? okrInitiatives.filter((l) => l.okrId === okr.id).map((l) => l.initiativeId)
    : [];
  const linkedInitiatives = linkedInitiativeIds
    .map((id) => initiatives.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const governance = okr ? OKR_GOVERNANCE_META[okr.governanceStatus] : undefined;

  return (
    <Drawer open={Boolean(okr)} onClose={onClose} width={520}>
      {okr && (
        <>
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-beige-20 bg-white px-6 pb-4 pt-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <Eyebrow>{objective?.name ?? "No strategic objective"}</Eyebrow>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <h2 className="font-display text-xl font-semibold leading-snug text-green-90">
              {okr.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {governance && <Tag className={governance.tag}>{governance.label}</Tag>}
              {okr.okrClass && (
                <Tag className="bg-beige-30 text-beige-60">{OKR_CLASS_LABEL[okr.okrClass]}</Tag>
              )}
              <HealthTag health={okr.health} />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-6 px-6 py-5">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-beige-20 bg-beige-5 p-4">
              <Prop icon={Users} label="Team">
                {team?.name ?? "—"}
              </Prop>
              <Prop icon={Building2} label="Business unit">
                {businessUnit?.name ?? "—"}
              </Prop>
              <Prop icon={CalendarRange} label="Year / quarter">
                Q{okr.quarter} {okr.year}
              </Prop>
              <Prop icon={Flag} label="Target date">
                {okr.targetDate ?? "—"}
              </Prop>
            </div>

            {okr.deliverableDetail && <Section label="Deliverable detail">{okr.deliverableDetail}</Section>}

            {/* Achievement */}
            <div className="rounded-xl border border-beige-20 bg-beige-5 p-4">
              <div className="mb-1 flex items-center justify-between">
                <Eyebrow>Achievement</Eyebrow>
                <span
                  className={cn(
                    "font-display text-lg font-semibold",
                    okr.achievement === null ? "text-beige-60" : "text-green-90"
                  )}
                >
                  {formatAchievement(okr.achievement)}
                </span>
              </div>
              {okr.achievement === null && (
                <p className="text-sm text-beige-60">Not assessed yet.</p>
              )}
            </div>

            {okr.notes && <Section label="Notes">{okr.notes}</Section>}

            {/* Owners */}
            <div>
              <Eyebrow className="mb-2">Owners</Eyebrow>
              {linkedOwners.length ? (
                <ul className="space-y-1.5">
                  {linkedOwners.map((lo) => {
                    const owner = owners.find((o) => o.id === lo.ownerId);
                    const name = ownerName(owner) || lo.ownerId;
                    return (
                      <li key={`${lo.okrId}-${lo.ownerId}`} className="flex items-center gap-2">
                        <Avatar name={name} className="h-6 w-6 text-[10px]" neutral />
                        <span className="text-sm text-green-90">{name}</span>
                        <Tag className="ml-auto bg-beige-10 text-beige-60">{lo.role}</Tag>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-beige-60">No owners assigned yet.</p>
              )}
            </div>

            {/* Linked initiatives */}
            <div>
              <Eyebrow className="mb-2">Linked initiatives</Eyebrow>
              {linkedInitiatives.length ? (
                <ul className="space-y-1.5">
                  {linkedInitiatives.map((i) => (
                    <li key={i.id}>
                      <button
                        onClick={() => { onClose(); select(i.id); }}
                        className="flex w-full items-center gap-2 rounded-lg border border-beige-20 bg-white px-3 py-2 text-left text-sm text-green-90 hover:border-green-40 hover:bg-beige-5"
                      >
                        <Target size={15} className="shrink-0 text-beige-60" />
                        <span className="truncate">{i.title}</span>
                        <StatusTag status={i.status} />
                        <ArrowUpRight size={14} className="ml-auto shrink-0 text-beige-60" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-beige-60">No linked initiatives yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
