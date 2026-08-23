import { redirect } from "next/navigation";

// Beakon opens on the unified Roadmap route by default (Sprint Heron Week 2
// merged /timeline, /board, /list into /roadmap — see docs/plans/heron-
// week-2-unified-roadmap-view.md). The active Roadmap's viewMode (defaults
// to List, on the System Roadmap) decides what actually renders there.
export default function Home() {
  redirect("/roadmap");
}
