"use client";

import { useRoadmap } from "@/lib/store";
import { List } from "@/components/List";
import { Board } from "@/components/Board";
import { Timeline } from "@/components/Timeline";

/**
 * Unified Roadmap route (Sprint Heron Week 2) — renders List/Board/Timeline
 * based on the *live* `viewMode` (Sprint Heron Week 3, ADR 010: `viewMode`
 * is now a local-only, explicit-save field like filters/groupBy/
 * timelineSort, not read directly off `activeRoadmap.viewMode` — that's
 * only the last-*persisted* value), replacing the old separate `/list`,
 * `/board`, `/timeline` routes (now permanent redirects here).
 */
export default function RoadmapPage() {
  const { viewMode } = useRoadmap();

  switch (viewMode) {
    case "board":
      return <Board />;
    case "timeline":
      return <Timeline />;
    case "list":
    default:
      return <List />;
  }
}
