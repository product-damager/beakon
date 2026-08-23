"use client";

import { useRoadmap } from "@/lib/store";
import type { Roadmap } from "@/lib/types";
import { SharePanel } from "./SharePanel";

/**
 * Roadmap's thin wrapper over the generic `SharePanel` (Sprint Heron Week 3
 * — genericized from this file's own original implementation, Sprint Heron
 * Week 2). Supplies Roadmap-specific copy/title/setter; `SharePanel` owns
 * the actual Private/Shared/Can-edit-or-View-only UI.
 *
 * Owner-only by construction: callers must not render this for a non-owner
 * — matches persist_roadmap()'s own refusal to let a non-owner touch these
 * fields (ADR 008 decision 1), so UI and RPC agree.
 */
export function RoadmapSharePanel({ roadmap, onClose }: { roadmap: Roadmap; onClose: () => void }) {
  const { setRoadmapVisibility } = useRoadmap();

  return (
    <SharePanel
      title={`Share "${roadmap.name}"`}
      groupName={`roadmap-visibility-${roadmap.id}`}
      visibility={roadmap.visibility}
      editable={roadmap.editable}
      onChange={(v) => setRoadmapVisibility(roadmap.id, v)}
      editableDescription="Others with access can change filters, sort, and view mode."
      viewOnlyDescription="Others with access can view this roadmap but not change it."
      onClose={onClose}
    />
  );
}
