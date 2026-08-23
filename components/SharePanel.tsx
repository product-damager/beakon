"use client";

import { X } from "lucide-react";

/**
 * Generic sharing popover content (Sprint Heron Week 3) — genericized from
 * `RoadmapSharePanel` (Sprint Heron Week 2) so `OkrViewShareMenu` can reuse
 * the same Private/Shared + Can-edit/View-only UI shape. Both entities share
 * the exact same `{visibility, editable}` shape and the exact same
 * three-state UI (Private / Shared / Shared+Can-edit-or-View-only), so no
 * conditional branching is needed here — just different prop values from
 * two thin wrappers (`RoadmapSharePanel`, `OkrViewShareMenu`).
 *
 * **Two description strings, not one** (design review finding, plan §3.4):
 * a single generic default copied from Roadmap's own copy ("can change
 * filters, sort, and view mode") would ship factually wrong for OkrView,
 * which has neither sort nor view mode — its editable-non-owner scope is
 * `filters`/`name` only (`persist_okr_view()`). Each wrapper supplies its
 * own pair of strings.
 *
 * Content-only: the caller owns the trigger, the open/close state, and the
 * `relative`/`absolute` anchoring (mirrors `RoadmapSharePanel`'s own doc
 * comment) — this component only renders once `open`, wrapped by the
 * caller. Owner-only by construction: callers must not render this for a
 * non-owner — matches persist_roadmap()'s/persist_okr_view()'s own refusal
 * to let a non-owner touch these fields, so UI and RPC agree.
 */
export function SharePanel({
  title,
  groupName,
  visibility,
  editable,
  onChange,
  editableDescription,
  viewOnlyDescription,
  onClose,
}: {
  /** Full heading, e.g. `Share "Q3 planning"` — caller composes the quoted name. */
  title: string;
  /** Unique per-instance radio-group name (e.g. `roadmap-visibility-${id}`) so
   * multiple panels on the same page don't cross-wire their native radios. */
  groupName: string;
  visibility: "private" | "shared";
  editable: boolean;
  onChange: (v: { visibility: "private" | "shared"; editable: boolean }) => void;
  /** Shown when `visibility === "shared" && editable`. */
  editableDescription: string;
  /** Shown when `visibility === "shared" && !editable`. */
  viewOnlyDescription: string;
  onClose: () => void;
}) {
  const shared = visibility === "shared";

  return (
    <div className="w-72 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-green-90" title={title}>
          {title}
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
            onChange={() => onChange({ visibility: "private", editable: false })}
            className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
          />
          Private
        </label>
        <label className="flex items-center gap-2 py-1.5 text-sm text-green-90">
          <input
            type="radio"
            name={groupName}
            checked={shared}
            onChange={() => onChange({ visibility: "shared", editable })}
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
              name={`${groupName}-editable`}
              checked={editable}
              onChange={() => onChange({ visibility: "shared", editable: true })}
              className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
            />
            Can edit
          </label>
          <label className="flex items-center gap-2 py-1 text-sm text-green-90">
            <input
              type="radio"
              name={`${groupName}-editable`}
              checked={!editable}
              onChange={() => onChange({ visibility: "shared", editable: false })}
              className="h-3.5 w-3.5 border-beige-30 text-green-90 focus:ring-2 focus:ring-green-90"
            />
            View only
          </label>
        </div>
      )}

      {shared && (
        <p className="mt-3 text-xs text-beige-70">
          {editable ? editableDescription : viewOnlyDescription}
        </p>
      )}
    </div>
  );
}
