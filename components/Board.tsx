"use client";

import { useMemo } from "react";
import { useRoadmap } from "@/lib/store";
import { applyFilters } from "@/lib/filters";
import { quarterLabelFromISO } from "@/lib/dates";
import { priorityScore, STATUS_META, STATUSES, THEME_COLOR_META, type Initiative, type Status } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, Eyebrow } from "./ui";
import { FilterBar } from "./FilterBar";

function Card({ initiative }: { initiative: Initiative }) {
  const { getOwner, getTheme, select, saveInitiative, owners } = useRoadmap();
  const owner = getOwner(initiative.ownerId);
  const theme = getTheme(initiative.themeId);

  return (
    <div className="group rounded-xl border border-beige-20 bg-white p-3 shadow-sm transition-colors hover:border-green-40">
      <button onClick={() => select(initiative.id)} className="block w-full text-left">
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
          Score
          <span className="font-display text-sm font-semibold text-green-90">
            {priorityScore(initiative.scores)}
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

export function Board() {
  const { initiatives, filters, themes, owners, saveInitiative } = useRoadmap();
  const filtered = useMemo(
    () => applyFilters(initiatives, filters, themes, owners),
    [initiatives, filters, themes, owners]
  );

  const byStatus = (s: Status) => filtered.filter((i) => i.status === s);

  return (
    <div className="flex h-full flex-col">
      <FilterBar />
      <div className="calm-scroll flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => {
            const items = byStatus(s);
            return (
              <section key={s} className="flex min-h-0 flex-col rounded-xl bg-beige-5/60 p-3">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", STATUS_META[s].dot)} />
                  <span className="text-sm font-semibold text-green-90">{STATUS_META[s].label}</span>
                  <span className="mono-label-sm text-beige-60">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((i) => (
                    <div
                      key={i.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        const dragged = initiatives.find((x) => x.id === id);
                        if (dragged && dragged.status !== s) saveInitiative({ ...dragged, status: s });
                      }}
                    >
                      <div
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <Card initiative={i} />
                      </div>
                    </div>
                  ))}
                  {/* Drop zone at the end of the column */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      const dragged = initiatives.find((x) => x.id === id);
                      if (dragged && dragged.status !== s) saveInitiative({ ...dragged, status: s });
                    }}
                    className={cn(
                      "rounded-lg border border-dashed border-beige-30 py-3 text-center text-xs text-beige-60",
                      items.length ? "opacity-0 transition-opacity hover:opacity-100" : ""
                    )}
                  >
                    Drop here to mark {STATUS_META[s].label.toLowerCase()}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        <Eyebrow className="mt-4 text-center">Drag a card between columns to change status</Eyebrow>
      </div>
    </div>
  );
}
