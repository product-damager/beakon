"use client";

import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { applyFilters } from "@/lib/filters";
import { quarterLabelFromISO } from "@/lib/dates";
import { riceScore, STATUS_META, STATUSES, THEME_COLOR_META, type Initiative, type Status } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, Eyebrow } from "./ui";
import { FilterBar } from "./FilterBar";

/**
 * Order a column so an initiative's in-column prerequisites always sit above it.
 * This is what makes dependent cards visibly reflow when a prerequisite is moved.
 */
function orderWithDeps(items: Initiative[]): Initiative[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const placed = new Set<string>();
  const out: Initiative[] = [];
  const place = (i: Initiative) => {
    if (placed.has(i.id)) return;
    placed.add(i.id); // mark before recursing so dependency cycles can't loop
    for (const depId of i.dependsOn) {
      const dep = byId.get(depId);
      if (dep) place(dep);
    }
    out.push(i);
  };
  for (const i of items) place(i);
  return out;
}

function Card({
  initiative,
  related,
  dragging,
}: {
  initiative: Initiative;
  related?: boolean;
  dragging?: boolean;
}) {
  const { getOwner, getTheme, select, saveInitiative, owners } = useRoadmap();
  const owner = getOwner(initiative.ownerId);
  const theme = getTheme(initiative.themeId);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white p-3 shadow-sm transition-all",
        related
          ? "border-lime-50 ring-2 ring-lime-40"
          : dragging
            ? "border-green-40 shadow-md"
            : "border-beige-20 hover:border-green-40"
      )}
    >
      <GripVertical
        size={14}
        className="pointer-events-none absolute right-2 top-2.5 text-beige-40 opacity-0 transition-opacity group-hover:opacity-100"
      />
      <button onClick={() => select(initiative.id)} className="block w-full pr-4 text-left">
        <div className="mb-2 flex items-center gap-1.5">
          {theme && <span className={cn("h-2 w-2 rounded-full", THEME_COLOR_META[theme.color].dot)} />}
          <span className="mono-label-sm truncate text-beige-60">{theme?.name}</span>
        </div>
        <div className="text-sm font-medium leading-snug text-green-90 group-hover:text-green-60">
          {initiative.title}
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <span className="mono-label-sm text-beige-60">{quarterLabelFromISO(initiative.targetStart)}</span>
        <span className="flex items-center gap-1 text-xs text-beige-60">
          RICE
          <span className="font-display text-sm font-semibold text-green-90">
            {riceScore(initiative.scores)}
          </span>
        </span>
      </div>
      {/* Quick edit */}
      <div className="mt-3 flex items-center gap-2 border-t border-beige-10 pt-2.5">
        {owner && <Avatar name={owner.name} className="h-6 w-6 text-[10px]" />}
        <select
          value={initiative.ownerId}
          onChange={(e) => saveInitiative({ ...initiative, ownerId: e.target.value })}
          className="min-w-0 flex-1 truncate rounded-md border border-beige-20 bg-beige-5 px-2 py-1 text-xs text-green-90 focus:outline-none focus:ring-1 focus:ring-green-90"
          aria-label="Owner"
        >
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="pointer-events-none h-[104px] rounded-xl border-2 border-dashed border-green-50 bg-green-10/60" />
  );
}

export function Board() {
  const { initiatives, filters, themes, owners, moveInitiative } = useRoadmap();
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ status: Status; beforeId: string | null } | null>(null);

  const filtered = useMemo(
    () => applyFilters(initiatives, filters, themes, owners),
    [initiatives, filters, themes, owners]
  );

  const columns = useMemo(() => {
    const map = {} as Record<Status, Initiative[]>;
    for (const s of STATUSES) map[s] = orderWithDeps(filtered.filter((i) => i.status === s));
    return map;
  }, [filtered]);

  // Cards linked to the one being dragged (its prerequisites and its dependents).
  const dragged = dragId ? initiatives.find((i) => i.id === dragId) : undefined;
  const relatedIds = useMemo(() => {
    if (!dragged) return new Set<string>();
    const rel = new Set<string>(dragged.dependsOn);
    for (const i of initiatives) if (i.dependsOn.includes(dragged.id)) rel.add(i.id);
    rel.delete(dragged.id);
    return rel;
  }, [dragged, initiatives]);

  const endDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  const commitDrop = (status: Status) => {
    if (dragId) {
      const beforeId = drop && drop.status === status ? drop.beforeId : null;
      moveInitiative(dragId, status, beforeId);
    }
    endDrag();
  };

  return (
    <div className="flex h-full flex-col">
      <FilterBar />
      <div className="calm-scroll flex-1 overflow-auto p-6">
        <div className="flex min-w-max gap-4">
          {STATUSES.map((s) => {
            const items = columns[s];
            const isTarget = Boolean(dragId) && drop?.status === s;
            return (
              <section
                key={s}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  const cardEls = Array.from(
                    e.currentTarget.querySelectorAll("[data-card-id]")
                  );
                  let beforeId: string | null = null;
                  for (const el of cardEls) {
                    const id = el.getAttribute("data-card-id");
                    if (!id || id === dragId) continue;
                    const r = el.getBoundingClientRect();
                    if (e.clientY < r.top + r.height / 2) {
                      beforeId = id;
                      break;
                    }
                  }
                  setDrop((prev) =>
                    prev && prev.status === s && prev.beforeId === beforeId
                      ? prev
                      : { status: s, beforeId }
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  commitDrop(s);
                }}
                className={cn(
                  "flex w-56 shrink-0 flex-col rounded-xl p-3 transition-colors",
                  isTarget ? "bg-green-10/70 ring-1 ring-green-40" : "bg-beige-5/60"
                )}
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", STATUS_META[s].dot)} />
                  <span className="text-sm font-semibold text-green-90">{STATUS_META[s].label}</span>
                  <span className="mono-label-sm text-beige-60">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((i) => (
                    <div key={i.id}>
                      {dragId && dragId !== i.id && drop?.status === s && drop.beforeId === i.id && (
                        <div className="mb-2.5">
                          <Placeholder />
                        </div>
                      )}
                      <div
                        draggable
                        data-card-id={i.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", i.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(i.id);
                        }}
                        onDragEnd={endDrag}
                        className={cn(
                          "cursor-grab active:cursor-grabbing",
                          dragId === i.id && "opacity-40"
                        )}
                      >
                        <Card
                          initiative={i}
                          related={Boolean(dragId) && relatedIds.has(i.id)}
                          dragging={dragId === i.id}
                        />
                      </div>
                    </div>
                  ))}
                  {/* Placeholder / hint at the end of the column */}
                  {dragId && drop?.status === s && drop.beforeId === null && <Placeholder />}
                  {items.length === 0 && !isTarget && (
                    <div className="rounded-lg border border-dashed border-beige-30 py-6 text-center text-xs text-beige-60">
                      Drop here to mark {STATUS_META[s].label.toLowerCase()}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        <Eyebrow className="mt-4 text-center">
          Drag to reorder or change status — dependent initiatives reflow to stay below their prerequisites
        </Eyebrow>
      </div>
    </div>
  );
}
