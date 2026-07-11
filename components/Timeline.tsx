"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CalendarRange, Minimize2, Plus } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { activeFilterCount, applyFilters, groupInitiatives } from "@/lib/filters";
import { barPosition, buildColumns, buildWindow, todayMarker } from "@/lib/dates";
import { ownerName, STATUS_META, STATUSES, THEME_COLOR_META, type Zoom } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, Button, Eyebrow } from "./ui";
import { FilterBar } from "./FilterBar";
import { Logo } from "./Logo";

const LABEL_W = 268;
// Hydration-safe "is this the client?" flag. useSyncExternalStore uses the server
// snapshot (false) during SSR + hydration so both renders match, then flips to true.
const emptySubscribe = () => () => {};
const UNIT: Record<Zoom, number> = { month: 116, quarter: 220, half: 320 };

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {STATUSES.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-xs text-beige-60">
          <span className={cn("h-2.5 w-2.5 rounded-sm", STATUS_META[s].dot)} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}

export function Timeline() {
  const {
    initiatives,
    filters,
    themes,
    owners,
    groupBy,
    zoom,
    presentation,
    selectedId,
    select,
    getInitiative,
    setPresentation,
  } = useRoadmap();

  const filtered = useMemo(
    () => applyFilters(initiatives, filters, themes, owners),
    [initiatives, filters, themes, owners]
  );
  const window = useMemo(
    () => buildWindow(filtered.map((i) => ({ start: i.targetStart, end: i.targetEnd }))),
    [filtered]
  );
  const columns = useMemo(() => buildColumns(window, zoom), [window, zoom]);
  const quarterCols = useMemo(() => buildColumns(window, "quarter"), [window]);
  const groups = useMemo(
    () => groupInitiatives(filtered, groupBy, themes, owners),
    [filtered, groupBy, themes, owners]
  );

  const canvasWidth = Math.max(720, columns.length * UNIT[zoom]);
  // "Today" is derived from the current clock, which differs between the server
  // render and client hydration. Gate it on the client so both renders match.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const today = mounted ? todayMarker(window) : null;
  const selected = selectedId ? getInitiative(selectedId) : undefined;
  const prereqs = new Set(selected?.dependsOn ?? []);

  return (
    <div className="flex h-full flex-col">
      {presentation ? (
        <div className="flex items-center justify-between border-b border-beige-20 bg-white px-8 py-4">
          <div className="flex items-center gap-3">
            <Logo size={26} />
            <div>
              <div className="font-display text-lg font-semibold text-green-90">
                Product roadmap
              </div>
              <Eyebrow>Grouped by {groupBy}</Eyebrow>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <StatusLegend />
            <Button variant="outline" size="sm" onClick={() => setPresentation(false)}>
              <Minimize2 size={15} /> Exit
            </Button>
          </div>
        </div>
      ) : (
        <>
          <FilterBar showGrouping showZoom showPresentation flush />
          <div className="flex items-center justify-between border-b border-beige-20 bg-background px-6 py-2">
            <Eyebrow>
              {filtered.length} initiative{filtered.length === 1 ? "" : "s"}
            </Eyebrow>
            <StatusLegend />
          </div>
        </>
      )}

      {/* Single scroll container — scrolls on BOTH axes. Sticky panes keep the time-axis
          header frozen while scrolling down and the label column frozen while scrolling
          right, so row labels never disappear. The grid stays rendered even when empty. */}
      <div className="relative min-h-0 flex-1">
        <div className="calm-scroll h-full overflow-auto">
          <div className="flex min-h-full flex-col" style={{ minWidth: LABEL_W + canvasWidth }}>
            {/* Time-axis header — sticky to the top, scrolls horizontally with the canvas */}
            <div className="sticky top-0 z-20 flex shrink-0 border-b border-beige-20 bg-background">
              {/* Corner cell — frozen on both axes */}
              <div className="sticky left-0 z-10 flex w-[268px] shrink-0 items-end bg-background px-6 pb-2 pt-3">
                <span className="mono-label text-beige-60">{groupBy}</span>
              </div>
              <div className="relative h-12" style={{ width: canvasWidth }}>
                {columns.map((c) => (
                  <div
                    key={c.key}
                    className="absolute bottom-1 flex flex-col"
                    style={{ left: `${c.leftPct}%` }}
                  >
                    {c.sublabel && (
                      <span className="mono-label-sm whitespace-nowrap text-beige-60">
                        {c.sublabel}
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-green-70">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Body — grid + grouped rows. flex-1 makes the grid span the viewport when sparse.
                `isolate` traps all rows/bars in one stacking context below the sticky header
                (z-20), so cards can't paint over the header — some browsers (Safari) otherwise
                let a card's transform-induced layer bleed above it while scrolling. */}
            <div className="relative isolate flex-1">
              {/* Gridlines + today marker */}
              <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{ marginLeft: LABEL_W }}
              >
                <div className="relative h-full" style={{ width: canvasWidth }}>
                  {quarterCols.map((c) => (
                    <div
                      key={c.key}
                      className="absolute bottom-0 top-0 border-l border-beige-20"
                      style={{ left: `${c.leftPct}%` }}
                    />
                  ))}
                  {today !== null && (
                    <div
                      className="absolute bottom-0 top-0 border-l-2 border-dashed border-lime-50"
                      style={{ left: `${today}%` }}
                    >
                      <span className="mono-label-sm absolute left-1 top-1 rounded bg-background/90 px-1 py-0.5 text-lime-70">
                        Today
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {groups.map((g) => (
                <div key={g.key}>
                  {/* Group header */}
                  <div className="flex border-b border-beige-20 bg-beige-5/70">
                    <div className="sticky left-0 z-10 flex w-[268px] shrink-0 items-center gap-2 bg-beige-5 px-6 py-2">
                      {g.color && (
                        <span className={cn("h-2.5 w-2.5 rounded-full", THEME_COLOR_META[g.color].dot)} />
                      )}
                      <span className="truncate text-[13px] font-semibold text-green-90">
                        {g.label}
                      </span>
                      <span className="mono-label-sm text-beige-60">{g.items.length}</span>
                    </div>
                    <div className="relative" style={{ width: canvasWidth }} />
                  </div>

                  {/* Initiative rows */}
                  {g.items.map((i) => {
                      const pos = barPosition(i.targetStart, i.targetEnd, window);
                      const meta = STATUS_META[i.status];
                      const isSelected = selectedId === i.id;
                      const isPrereq = prereqs.has(i.id);
                      const owner = owners.find((o) => o.id === i.ownerId);
                      // Bars too narrow for their title get the label rendered beside them
                      // instead of clipping it to an unreadable stub.
                      const barPx = Math.max(28, (pos.widthPct / 100) * canvasWidth);
                      const labelOutside = barPx < 76;
                      return (
                        <div
                          key={i.id}
                          className="group flex items-stretch border-b border-beige-10 hover:bg-beige-5/60"
                        >
                          <div className="sticky left-0 z-10 flex w-[268px] shrink-0 items-center gap-2.5 bg-background px-6 py-2.5 group-hover:bg-beige-5">
                            {owner && <Avatar name={ownerName(owner)} className="h-6 w-6 text-[10px]" />}
                            <button
                              onClick={() => select(i.id)}
                              className="truncate text-left text-[13px] font-medium text-green-90 hover:text-green-60"
                              title={i.title}
                            >
                              {i.title}
                            </button>
                          </div>
                          <div className="relative py-2.5" style={{ width: canvasWidth }}>
                            <button
                              onClick={() => select(i.id)}
                              title={`${i.title} · ${meta.label}`}
                              className={cn(
                                "absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md px-2.5 text-left text-xs font-medium shadow-sm transition-all hover:brightness-105",
                                meta.bar,
                                isSelected && "ring-2 ring-green-90 ring-offset-1",
                                isPrereq && "outline-dashed outline-2 outline-offset-1 outline-lime-60"
                              )}
                              style={{
                                left: `${pos.leftPct}%`,
                                width: `max(28px, ${pos.widthPct}%)`,
                              }}
                            >
                              {!labelOutside && <span className="truncate">{i.title}</span>}
                            </button>
                            {labelOutside && (
                              <button
                                onClick={() => select(i.id)}
                                title={`${i.title} · ${meta.label}`}
                                className="absolute top-1/2 -translate-y-1/2 truncate text-left text-[13px] font-medium text-green-90 hover:text-green-60"
                                style={{
                                  left: `calc(${pos.leftPct}% + max(28px, ${pos.widthPct}%) + 8px)`,
                                  maxWidth: 200,
                                }}
                              >
                                {i.title}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>
        </div>
        {filtered.length === 0 && <EmptyState />}
      </div>
    </div>
  );
}

/**
 * Centered overlay shown when no rows are visible. It floats above the time grid
 * (which stays rendered) and adapts its message + action: an active filter set
 * offers a reset, while a genuinely empty workspace invites creating the first one.
 */
function EmptyState() {
  const { filters, resetFilters, openCreate } = useRoadmap();
  const filtering = activeFilterCount(filters) > 0 || filters.search.trim() !== "";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-background/80 px-8 py-7 text-center backdrop-blur-sm">
        <CalendarRange size={40} strokeWidth={1.2} className="text-beige-40" />
        <div className="font-display text-lg font-semibold text-green-90">
          {filtering ? "No initiatives match" : "No initiatives yet"}
        </div>
        <p className="max-w-xs text-sm text-beige-60">
          {filtering
            ? "Nothing fits the current filters. Try widening them or resetting."
            : "Your roadmap is empty. Create the first initiative to place it on the timeline."}
        </p>
        {filtering ? (
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>
        ) : (
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} strokeWidth={2} /> New initiative
          </Button>
        )}
      </div>
    </div>
  );
}
