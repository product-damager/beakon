"use client";

import { X } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import type { Roadmap } from "@/lib/types";

/**
 * Sharing popover content (Sprint Heron Week 2) — Private/Shared radios,
 * plus a Can-edit/View-only sub-choice that only appears once Shared is
 * picked. Per docs/design/roadmap-sidebar-header-sharing.md §3.2: this is a
 * small anchored popover (mirroring SortControl's pattern in FilterBar.tsx),
 * not a ConfirmDialog-style modal — sharing is a quick settings tweak, not a
 * destructive confirmation. Radio rows (not `Segmented`) since this reads as
 * a form choice with a real consequence, not a toolbar display toggle.
 *
 * Content-only: the caller owns the trigger, the open/close state, and the
 * `relative`/`absolute` anchoring (header icon vs. sidebar row menu anchor
 * differently, per §3.1's "two entry points, one popover" design) — this
 * component only renders once `open`, wrapped by the caller.
 *
 * Owner-only by construction: callers must not render this for a non-owner —
 * matches persist_roadmap()'s own refusal to let a non-owner touch these
 * fields (ADR 008 decision 1), so UI and RPC agree.
 */
export function RoadmapSharePanel({ roadmap, onClose }: { roadmap: Roadmap; onClose: () => void }) {
  const { setRoadmapVisibility } = useRoadmap();
  const shared = roadmap.visibility === "shared";
  const groupName = `roadmap-visibility-${roadmap.id}`;

  return (
    <div className="w-72 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-green-90" title={roadmap.name}>
          Share &quot;{roadmap.name}&quot;
        </h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-0.5 text-beige-60 hover:bg-beige-10 hover:text-green-90"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-0.5">
        <label className="flex items-center gap-2 py-1.5 text-sm text-green-90">
          <input
            type="radio"
            name={groupName}
            checked={!shared}
            onChange={() =>
              setRoadmapVisibility(roadmap.id, { visibility: "private", editable: false })
            }
            className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
          />
          Private
        </label>
        <label className="flex items-center gap-2 py-1.5 text-sm text-green-90">
          <input
            type="radio"
            name={groupName}
            checked={shared}
            onChange={() =>
              setRoadmapVisibility(roadmap.id, { visibility: "shared", editable: roadmap.editable })
            }
            className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
          />
          Shared
        </label>
      </div>

      {shared && (
        <div className="mt-1.5 rounded-lg bg-beige-5 p-2">
          <label className="flex items-center gap-2 py-1 text-sm text-green-90">
            <input
              type="radio"
              name={`roadmap-editable-${roadmap.id}`}
              checked={roadmap.editable}
              onChange={() => setRoadmapVisibility(roadmap.id, { visibility: "shared", editable: true })}
              className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
            />
            Can edit
          </label>
          <label className="flex items-center gap-2 py-1 text-sm text-green-90">
            <input
              type="radio"
              name={`roadmap-editable-${roadmap.id}`}
              checked={!roadmap.editable}
              onChange={() => setRoadmapVisibility(roadmap.id, { visibility: "shared", editable: false })}
              className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
            />
            View only
          </label>
        </div>
      )}

      {shared && (
        <p className="mt-3 text-xs text-beige-60">
          {roadmap.editable
            ? "Others with access can change filters, sort, and view mode."
            : "Others with access can view this roadmap but not change it."}
        </p>
      )}
    </div>
  );
}
