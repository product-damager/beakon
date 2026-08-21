"use client";

import { useRoadmap } from "@/lib/store";
import { List } from "@/components/List";
import { Board } from "@/components/Board";
import { Timeline } from "@/components/Timeline";

/**
 * Unified Roadmap route (Sprint Heron Week 2) — renders List/Board/Timeline
 * based on the active Roadmap's `viewMode`, replacing the old separate
 * `/list`, `/board`, `/timeline` routes (now permanent redirects here).
 */
export default function RoadmapPage() {
  const { activeRoadmap } = useRoadmap();

  switch (activeRoadmap.viewMode) {
    case "board":
      return <Board />;
    case "timeline":
      return <Timeline />;
    case "list":
    default:
      return <List />;
  }
}
