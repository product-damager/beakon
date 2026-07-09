"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Group,
  Maximize2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useRoadmap } from "@/lib/store";
import { activeFilterCount } from "@/lib/filters";
import { STATUS_META, STATUSES, TEAMS, type GroupBy, type Status, type Visibility, type Zoom } from "@/lib/types";
import { Button } from "./ui";

interface Option {
  value: string;
  label: string;
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
          selected.length
            ? "border-green-90 bg-green-90 text-white"
            : "border-beige-30 bg-white text-green-90 hover:bg-beige-10"
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-lime-40 px-1.5 text-[11px] font-semibold text-green-90">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-56 overflow-auto rounded-xl border border-beige-20 bg-white p-1 shadow-lg">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => onToggle(o.value)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-green-90 hover:bg-beige-10"
              >
                <span className="truncate">{o.label}</span>
                {on && <Check size={15} strokeWidth={2.5} className="text-green-60" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-beige-30 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-green-90 text-white" : "text-green-70 hover:bg-beige-10"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  showGrouping = false,
  showZoom = false,
  showPresentation = false,
}: {
  showGrouping?: boolean;
  showZoom?: boolean;
  showPresentation?: boolean;
}) {
  const {
    filters,
    patchFilters,
    resetFilters,
    owners,
    themes,
    groupBy,
    setGroupBy,
    zoom,
    setZoom,
    setPresentation,
  } = useRoadmap();

  const toggle = <K extends "owners" | "teams" | "themes" | "statuses" | "visibility">(
    key: K,
    value: string
  ) => {
    const cur = filters[key] as string[];
    patchFilters({
      [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
    } as Partial<typeof filters>);
  };

  const count = activeFilterCount(filters);

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b border-beige-20 bg-background/90 px-6 py-3 backdrop-blur">
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-beige-60" />
        <input
          value={filters.search}
          onChange={(e) => patchFilters({ search: e.target.value })}
          placeholder="Search initiatives"
          className="h-9 w-56 rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
        />
      </div>

      <span className="mx-1 hidden h-6 w-px bg-beige-20 sm:block" />

      {showGrouping && (
        <div className="flex items-center gap-1.5">
          <Group size={15} className="text-beige-60" />
          <Segmented<GroupBy>
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "theme", label: "Theme" },
              { value: "team", label: "Team" },
              { value: "owner", label: "Owner" },
            ]}
          />
        </div>
      )}

      <MultiSelect
        label="Status"
        selected={filters.statuses}
        onToggle={(v) => toggle("statuses", v)}
        options={STATUSES.map((s: Status) => ({ value: s, label: STATUS_META[s].label }))}
      />
      <MultiSelect
        label="Owner"
        selected={filters.owners}
        onToggle={(v) => toggle("owners", v)}
        options={owners.map((o) => ({ value: o.id, label: o.name }))}
      />
      <MultiSelect
        label="Team"
        selected={filters.teams}
        onToggle={(v) => toggle("teams", v)}
        options={TEAMS.map((t) => ({ value: t, label: t }))}
      />
      <MultiSelect
        label="Theme"
        selected={filters.themes}
        onToggle={(v) => toggle("themes", v)}
        options={themes.map((t) => ({ value: t.id, label: t.name }))}
      />
      <MultiSelect
        label="Visibility"
        selected={filters.visibility}
        onToggle={(v) => toggle("visibility", v)}
        options={[
          { value: "internal", label: "Internal" },
          { value: "external", label: "External" },
        ]}
      />

      {count > 0 && (
        <button
          onClick={resetFilters}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-beige-60 hover:bg-beige-10 hover:text-green-90"
        >
          <RotateCcw size={14} /> Reset
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {showZoom && (
          <Segmented<Zoom>
            value={zoom}
            onChange={setZoom}
            options={[
              { value: "month", label: "Month" },
              { value: "quarter", label: "Quarter" },
              { value: "half", label: "Half-year" },
            ]}
          />
        )}
        {showPresentation && (
          <Button variant="outline" size="sm" onClick={() => setPresentation(true)}>
            <Maximize2 size={15} /> Present
          </Button>
        )}
      </div>
    </div>
  );
}

// Small helper re-exported for callers that want the icon in headings.
export { SlidersHorizontal, X };
