"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CalendarRange, ChevronRight, Minimize2, Plus } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { activeFilterCount, applyFilters, groupInitiatives, sortInitiatives } from "@/lib/filters";
import { barPosition, buildColumns, buildWindow, todayMarker } from "@/lib/dates";
import {
  ownerName,
  STATUS_META,
  STATUSES,
  THEME_COLOR_META,
  ZOOM_SCALE_MAX,
  ZOOM_SCALE_MIN,
  type Zoom,
} from "@/lib/types";
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
    zoomScale,
    setZoomScale,
    density,
    timelineSort,
    presentation,
    selectedId,
    select,
    getInitiative,
    setPresentation,
  } = useRoadmap();
  const dense = density === "compact";

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
  // Sort the flat list before grouping so each group inherits the chosen order.
  const sorted = useMemo(() => sortInitiatives(filtered, timelineSort), [filtered, timelineSort]);
  const groups = useMemo(
    () => groupInitiatives(sorted, groupBy, themes, owners),
    [sorted, groupBy, themes, owners]
  );

  const canvasWidth = Math.max(720, columns.length * UNIT[zoom] * zoomScale);

  // ── Cursor-anchored zoom (⌘/Ctrl + wheel) ──────────────────────────────────
  // Bars/gridlines are all %-positioned, so scaling canvasWidth zooms everything.
  // We keep the point under the cursor fixed by adjusting scrollLeft once the new
  // width is committed. Refs hold the latest values so the wheel listener binds once.
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomScaleRef = useRef(zoomScale);
  const canvasWidthRef = useRef(canvasWidth);
  const zoomAnchor = useRef<{ fraction: number; viewportX: number; nextScale: number } | null>(null);
  useEffect(() => {
    zoomScaleRef.current = zoomScale;
    canvasWidthRef.current = canvasWidth;
  });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return; // plain scroll passes through untouched
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const viewportX = e.clientX - rect.left;
      const contentX = el.scrollLeft + viewportX;
      const fraction = Math.min(1, Math.max(0, (contentX - LABEL_W) / canvasWidthRef.current));
      // Chain successive events within a burst via the pending anchor scale.
      const base = zoomAnchor.current?.nextScale ?? zoomScaleRef.current;
      const nextScale = Math.min(
        ZOOM_SCALE_MAX,
        Math.max(ZOOM_SCALE_MIN, base * Math.exp(-e.deltaY * 0.0015))
      );
      zoomAnchor.current = { fraction, viewportX, nextScale };
      setZoomScale(nextScale);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoomScale]);
  // After the width recomputes, restore the anchored point under the cursor.
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const el = scrollRef.current;
    if (!anchor || !el) return;
    el.scrollLeft = LABEL_W + anchor.fraction * canvasWidth - anchor.viewportX;
    zoomAnchor.current = null;
  }, [canvasWidth]);

  // "Today" is derived from the current clock, which differs between the server
  // render and client hydration. Gate it on the client so both renders match.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const today = mounted ? todayMarker(window) : null;
  const selected = selectedId ? getInitiative(selectedId) : undefined;
  const prereqs = new Set(selected?.dependsOn ?? []);

  // Per-group collapse (Timeline-local; keyed by group key so it resets naturally
  // when the grouping dimension changes). Lets you fold away groups you are not
  // focused on to declutter the timeline.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
        <div ref={scrollRef} className="calm-scroll h-full overflow-auto">
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

              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.key);
                return (
                <div key={g.key}>
                  {/* Group header — a toggle button that reads as a section band via
                      weight, height and rules; the chevron folds the group's rows away. */}
                  <div className="flex border-y border-beige-40 bg-beige-20/70">
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.key)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${g.label}`}
                      className="sticky left-0 z-10 flex w-[268px] shrink-0 items-center gap-2 bg-beige-20 px-6 py-3 text-left transition-colors hover:bg-beige-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-90"
                    >
                      <ChevronRight
                        size={15}
                        className={cn(
                          "shrink-0 text-beige-60 transition-transform",
                          !isCollapsed && "rotate-90"
                        )}
                      />
                      {g.color && (
                        <span
                          className={cn(
                            "h-3 w-3 rounded-full ring-1 ring-inset ring-black/20",
                            THEME_COLOR_META[g.color].dot
                          )}
                        />
                      )}
                      <span className="truncate text-sm font-semibold text-green-90">
                        {g.label}
                      </span>
                      <span className="mono-label-sm text-green-70">{g.items.length}</span>
                    </button>
                    <div className="relative" style={{ width: canvasWidth }} />
                  </div>

                  {/* Initiative rows */}
                  {!isCollapsed &&
                    g.items.map((i) => {
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
                          <div
                            className={cn(
                              "sticky left-0 z-10 flex w-[268px] shrink-0 items-center gap-2.5 bg-background px-6 group-hover:bg-beige-5",
                              dense ? "py-1" : "py-2.5"
                            )}
                          >
                            {owner && (
                              <Avatar
                                name={ownerName(owner)}
                                className={cn(dense ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]")}
                                neutral
                              />
                            )}
                            <button
                              onClick={() => select(i.id)}
                              className="truncate text-left text-[13px] font-medium text-green-90 hover:text-green-60"
                              title={i.title}
                            >
                              {i.title}
                            </button>
                          </div>
                          <div className={cn("relative", dense ? "py-1" : "py-2.5")} style={{ width: canvasWidth }}>
                            <button
                              onClick={() => select(i.id)}
                              title={`${i.title} · ${meta.label}`}
                              className={cn(
                                "absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-md px-2.5 text-left text-xs font-medium shadow-sm transition-all hover:brightness-105",
                                dense ? "h-5" : "h-7",
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
                );
              })}
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
