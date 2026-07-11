"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Group,
  Maximize2,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useRoadmap } from "@/lib/store";
import { activeFilterCount, type FilterMode, type Filters } from "@/lib/filters";
import {
  ownerName,
  STATUS_META,
  STATUSES,
  TEAMS,
  THEME_COLOR_META,
  type GroupBy,
  type Zoom,
} from "@/lib/types";
import { Button } from "./ui";

// ── Field configuration ──────────────────────────────────────────────────
type FieldKey = "statuses" | "owners" | "teams" | "themes" | "visibility";
type ModeKey =
  | "statusesMode"
  | "ownersMode"
  | "teamsMode"
  | "themesMode"
  | "visibilityMode";

interface Option {
  value: string;
  label: string;
  dot?: string;
}
interface FieldDef {
  key: FieldKey;
  modeKey: ModeKey;
  label: string;
  options: Option[];
  searchable: boolean;
}

/** Close a popover when the user clicks/taps outside of `ref`. */
function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, ref, close]);
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

// ── Field editor (checkbox list + is/is-not + select all) ──────────────────
function FieldEditor({ field }: { field: FieldDef }) {
  const { filters, patchFilters } = useRoadmap();
  const [query, setQuery] = useState("");
  const values = filters[field.key] as string[];
  const mode = filters[field.modeKey] as FilterMode;

  const toggle = (v: string) =>
    patchFilters({
      [field.key]: values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
    } as Partial<Filters>);

  const allValues = field.options.map((o) => o.value);
  const allSelected = allValues.length > 0 && allValues.every((v) => values.includes(v));
  const setMode = (m: FilterMode) => patchFilters({ [field.modeKey]: m } as Partial<Filters>);

  const q = query.trim().toLowerCase();
  const shown = q ? field.options.filter((o) => o.label.toLowerCase().includes(q)) : field.options;

  return (
    <div className="w-72">
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="mono-label-sm text-beige-60">{field.label}</span>
        <Segmented<FilterMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "is", label: "is" },
            { value: "is_not", label: "is not" },
          ]}
        />
      </div>

      {field.searchable && (
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-beige-60" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${field.label.toLowerCase()}`}
            className="h-8 w-full rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
          />
        </div>
      )}

      <button
        onClick={() =>
          patchFilters({ [field.key]: allSelected ? [] : allValues } as Partial<Filters>)
        }
        className="mb-1 w-full rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-green-70 hover:bg-beige-10"
      >
        {allSelected ? "Clear all" : "Select all"}
      </button>

      <div className="max-h-64 space-y-0.5 overflow-auto">
        {shown.map((o) => {
          const on = values.includes(o.value);
          return (
            <button
              key={o.value}
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-beige-10"
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  on ? "border-green-90 bg-green-90 text-white" : "border-beige-40 bg-white"
                )}
              >
                {on && <Check size={12} strokeWidth={3} />}
              </span>
              {o.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", o.dot)} />}
              <span className="truncate text-green-90">{o.label}</span>
            </button>
          );
        })}
        {shown.length === 0 && (
          <div className="px-2.5 py-2 text-sm text-beige-60">No matches</div>
        )}
      </div>
    </div>
  );
}

// ── Applied-filter pill ────────────────────────────────────────────────────
function FilterPill({ field }: { field: FieldDef }) {
  const { filters, patchFilters } = useRoadmap();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, open, () => setOpen(false));

  const values = filters[field.key] as string[];
  const mode = filters[field.modeKey] as FilterMode;
  if (!values.length) return null;

  const optLabel = (v: string) => field.options.find((o) => o.value === v)?.label ?? v;
  const summary = values.length === 1 ? optLabel(values[0]) : `${values.length} selected`;
  const remove = () =>
    patchFilters({ [field.key]: [], [field.modeKey]: "is" } as Partial<Filters>);

  return (
    <div className="relative" ref={ref}>
      <div
        className={cn(
          "flex h-9 items-center rounded-lg border bg-white transition-colors",
          open ? "border-green-90" : "border-beige-30"
        )}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-full items-center gap-1.5 rounded-l-lg pl-2.5 pr-2 text-[13px] hover:bg-beige-10"
        >
          <span className="font-medium text-green-90">{field.label}</span>
          <span className="text-beige-60">{mode === "is_not" ? "is not" : "is"}</span>
          <span className="font-medium text-green-70">{summary}</span>
        </button>
        <button
          onClick={remove}
          aria-label={`Remove ${field.label} filter`}
          className="flex h-full items-center rounded-r-lg pl-1 pr-2 text-beige-60 hover:text-green-90"
        >
          <X size={14} />
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-beige-20 bg-white p-3 shadow-lg">
          <FieldEditor field={field} />
        </div>
      )}
    </div>
  );
}

// ── "+ Filter" button (field menu → field editor) ──────────────────────────
function AddFilterButton({ fields }: { fields: FieldDef[] }) {
  const { filters } = useRoadmap();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<FieldDef | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setChosen(null);
  };
  useOutsideClose(ref, open, close);

  // Only offer fields that aren't already applied (those show as editable pills).
  const available = fields.filter((f) => (filters[f.key] as string[]).length === 0);
  if (available.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          setChosen(null);
        }}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-beige-40 px-3 text-[13px] font-medium text-green-70 hover:bg-beige-10"
      >
        <Plus size={15} /> Filter
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-beige-20 bg-white p-1.5 shadow-lg">
          {chosen ? (
            <div className="p-1.5">
              <FieldEditor field={chosen} />
            </div>
          ) : (
            <div className="w-44">
              {available.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setChosen(f)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-green-90 hover:bg-beige-10"
                >
                  {f.label}
                  <ChevronRight size={14} className="text-beige-60" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────
export function FilterBar({
  showGrouping = false,
  showZoom = false,
  showPresentation = false,
  flush = false,
}: {
  showGrouping?: boolean;
  showZoom?: boolean;
  showPresentation?: boolean;
  /** Drop this bar's own border/blur so it merges with the strip below it. */
  flush?: boolean;
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

  const fields = useMemo<FieldDef[]>(
    () => [
      {
        key: "statuses",
        modeKey: "statusesMode",
        label: "Status",
        searchable: false,
        options: STATUSES.map((s) => ({
          value: s,
          label: STATUS_META[s].label,
          dot: STATUS_META[s].dot,
        })),
      },
      {
        key: "owners",
        modeKey: "ownersMode",
        label: "Owner",
        searchable: true,
        options: owners.map((o) => ({ value: o.id, label: ownerName(o) })),
      },
      {
        key: "teams",
        modeKey: "teamsMode",
        label: "Team",
        searchable: false,
        options: TEAMS.map((t) => ({ value: t, label: t })),
      },
      {
        key: "themes",
        modeKey: "themesMode",
        label: "Theme",
        searchable: true,
        options: themes.map((t) => ({
          value: t.id,
          label: t.name,
          dot: THEME_COLOR_META[t.color]?.dot,
        })),
      },
      {
        key: "visibility",
        modeKey: "visibilityMode",
        label: "Visibility",
        searchable: false,
        options: [
          { value: "internal", label: "Internal" },
          { value: "external", label: "External" },
        ],
      },
    ],
    [owners, themes]
  );

  const activeCount = activeFilterCount(filters);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-6 py-3",
        flush
          ? "bg-background"
          : "sticky top-0 z-40 border-b border-beige-20 bg-background/90 backdrop-blur"
      )}
    >
      {/* ── Which initiatives (search + filters) ── */}
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-beige-60" />
        <input
          value={filters.search}
          onChange={(e) => patchFilters({ search: e.target.value })}
          placeholder="Search initiatives"
          className="h-9 w-56 rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
        />
      </div>

      {fields.map((f) => (
        <FilterPill key={f.key} field={f} />
      ))}
      <AddFilterButton fields={fields} />

      {activeCount > 0 && (
        <button
          onClick={resetFilters}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-beige-60 hover:bg-beige-10 hover:text-green-90"
        >
          <RotateCcw size={14} /> Clear all
        </button>
      )}

      {/* ── How it's displayed (group + zoom + present) ── */}
      <div className="ml-auto flex items-center gap-2">
        {showGrouping && (
          <div className="flex items-center gap-1.5">
            <Group size={15} className="text-beige-60" />
            <span className="mono-label-sm hidden text-beige-60 sm:block">Group</span>
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
