"use client";

import { useRoadmap } from "@/lib/store";
import type { OkrView } from "@/lib/types";
import { SharePanel } from "./SharePanel";

/**
 * OkrView's thin wrapper over the generic `SharePanel` (Sprint Heron Week
 * 3), mirroring `RoadmapSharePanel`. Its own copy pair, not a reuse of
 * Roadmap's: an OkrView has no sort/view mode, so its editable-non-owner
 * scope is `filters`/`name` only (`persist_okr_view()`) — see plan §3.4 /
 * the design review's correctness-adjacent finding for why this can't share
 * Roadmap's copy string.
 *
 * Owner-only by construction: callers must not render this for a non-owner
 * — matches persist_okr_view()'s own refusal to let a non-owner touch these
 * fields (ADR 009), so UI and RPC agree.
 */
export function OkrViewShareMenu({ view, onClose }: { view: OkrView; onClose: () => void }) {
  const { setOkrViewVisibility } = useRoadmap();

  return (
    <SharePanel
      title={`Share "${view.name}"`}
      groupName={`okr-view-visibility-${view.id}`}
      visibility={view.visibility}
      editable={view.editable}
      onChange={(v) => setOkrViewVisibility(view.id, v)}
      editableDescription="Others with access can change this view's filters and name."
      viewOnlyDescription="Others with access can view this filter view but not change it."
      onClose={onClose}
    />
  );
}
