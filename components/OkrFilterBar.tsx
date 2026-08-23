"use client";

import { useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { BusinessUnit, Okr, StrategicObjective, Team } from "@/lib/types";
import { EMPTY_OKR_FILTERS, normalizeOkrFilters, type OkrFilters } from "@/lib/okrFilters";
import { isOkrViewOwner, okrFiltersEqual, useRoadmap } from "@/lib/store";
import { useOutsideClose } from "./hooks";
import { MultiSelect, TextInput } from "./form";
import { Button, Tag } from "./ui";

/** Count of active *narrowing* filters. All five narrowing fields are arrays
 * now (docs/plans/okr-filters-archive-parity-and-delayed-health.md T8) — a
 * field counts if it has any selection. */
export function okrFilterCount(f: OkrFilters): number {
  return Object.values(f).filter((v) => Array.isArray(v) && v.length > 0).length;
}

/** Apply the current OkrFilters to a list of OKRs. Archived OKRs are always
 * excluded here — the dedicated `/archived_okrs` page is the only place they
 * surface (docs/plans/roadmap-dialog-viewmode-and-archive-reversal.md T26).
 * BU filter matches either a direct business-unit OKR or a team OKR whose
 * team belongs to that BU. Every field is a multi-select array — an empty
 * array means "no filter applied" on that field, membership (`.includes()`)
 * replaces the old scalar `!==` comparison. */
export function applyOkrFilters(okrs: Okr[], filters: OkrFilters, teams: Team[]): Okr[] {
  return okrs.filter((o) => {
    if (o.archived) return false;
    if (filters.quarters.length > 0 && !filters.quarters.includes(o.quarter)) return false;
    if (
      filters.strategicObjectiveIds.length > 0 &&
      !filters.strategicObjectiveIds.includes(o.strategicObjectiveId)
    )
      return false;
    if (filters.teamIds.length > 0 && (!o.teamId || !filters.teamIds.includes(o.teamId))) return false;
    if (filters.businessUnitIds.length > 0) {
      const team = o.teamId ? teams.find((t) => t.id === o.teamId) : undefined;
      const bu = o.businessUnitId ?? team?.businessUnitId;
      if (!bu || !filters.businessUnitIds.includes(bu)) return false;
    }
    return true;
  });
}

// ── "Save as view…"/"Save as new…" naming popover (Sprint Heron Week 3, ADR
// 009) — mirrors NewRoadmapRow's TextInput + Cancel/Create pattern
// (RoadmapNav.tsx), reusing that visual language rather than inventing a
// second one, per the design review. A small local duplicate of
// FilterBar.tsx's own equivalent popover (Save as new Roadmap…) rather than
// a shared extraction — two near-identical call sites doesn't yet justify
// one (see SharePanel's own "third near-identical X" framing). ────────────
function SaveOkrViewButton({
  label,
  buttonVariant = "secondary",
  onSave,
}: {
  label: string;
  buttonVariant?: "default" | "secondary";
  onSave: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, open, () => setOpen(false));

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant={buttonVariant} size="sm" onClick={() => setOpen((o) => !o)}>
        {label}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-beige-20 bg-white p-3 shadow-lg">
          <div className="mb-2 text-sm font-medium text-green-90">Name this view</div>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q3 leadership OKRs"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            className="mb-2"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!name.trim()} onClick={submit}>
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OkrView save cluster (Sprint Heron Week 3, ADR 009) — the three states
// from the design review's "Question 1": no view active → "Save as view…";
// view active + clean → passive name Tag + "×" to clear; view active +
// dirty → "Update '<name>'" (primary) + "Save as new…" (secondary). A
// Shared+View-only visitor sees only the "View only" tag (§3.5), nothing
// that would just error server-side. ───────────────────────────────────────
function OkrViewSaveCluster({ filters }: { filters: OkrFilters }) {
  const { activeOkrView, currentOwner, canPersistOkrView, createOkrView, updateOkrView, applyOkrView } =
    useRoadmap();

  if (!activeOkrView) {
    if (!currentOwner) return null; // nobody to attribute a new view to
    return <SaveOkrViewButton label="Save as view…" onSave={(name) => createOkrView(name, filters)} />;
  }

  const isOwner = isOkrViewOwner(activeOkrView, currentOwner);
  const viewOnly = !isOwner && activeOkrView.visibility === "shared" && !activeOkrView.editable;
  const canPersist = canPersistOkrView(activeOkrView);
  const dirty = !okrFiltersEqual(filters, normalizeOkrFilters(activeOkrView.filters));

  if (canPersist && dirty) {
    return (
      <>
        <Button size="sm" onClick={() => updateOkrView(filters)}>
          Update &quot;{activeOkrView.name}&quot;
        </Button>
        <SaveOkrViewButton label="Save as new…" onSave={(name) => createOkrView(name, filters)} />
      </>
    );
  }

  if (viewOnly) {
    return <Tag className="bg-beige-20 text-beige-70">View only</Tag>;
  }

  if (canPersist) {
    return (
      <Tag className="bg-beige-20 text-green-70">
        {activeOkrView.name}
        <button
          onClick={() => applyOkrView(null)}
          aria-label="Clear active view"
          className="ml-1 rounded p-0.5 hover:bg-beige-30"
        >
          <X size={11} />
        </button>
      </Tag>
    );
  }

  return null;
}

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
    <div className="sticky top-0 z-40 flex flex-nowrap items-center gap-2 border-b border-beige-20 bg-background/90 px-6 py-3 backdrop-blur">
      <MultiSelect
        ariaLabel="Quarter"
        placeholder="All quarters"
        className="w-28"
        values={filters.quarters.map(String)}
        onChange={(vs) => onChange({ quarters: vs.map(Number) })}
        options={[1, 2, 3, 4].map((q) => ({ value: String(q), label: `Q${q}` }))}
      />

      <MultiSelect
        ariaLabel="Team"
        placeholder="All teams"
        className="w-36"
        searchable
        values={filters.teamIds}
        onChange={(vs) => onChange({ teamIds: vs })}
        options={teams.map((t) => ({ value: t.id, label: t.name }))}
      />

      <MultiSelect
        ariaLabel="Business unit"
        placeholder="All BUs"
        className="w-36"
        values={filters.businessUnitIds}
        onChange={(vs) => onChange({ businessUnitIds: vs })}
        options={businessUnits.map((bu) => ({ value: bu.id, label: bu.name }))}
      />

      <MultiSelect
        ariaLabel="Strategic objective"
        placeholder="All strategic objectives"
        className="w-40"
        values={filters.strategicObjectiveIds}
        onChange={(vs) => onChange({ strategicObjectiveIds: vs })}
        options={strategicObjectives.map((so) => ({ value: so.id, label: so.name }))}
      />

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange(EMPTY_OKR_FILTERS)}>
          <RotateCcw size={14} /> Clear all
        </Button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <OkrViewSaveCluster filters={filters} />
      </div>
    </div>
  );
}
