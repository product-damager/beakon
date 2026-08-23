import { permanentRedirect } from "next/navigation";

/**
 * `/list` collapsed into the unified `/roadmap` route (Sprint Heron Week 2 —
 * List/Board/Timeline are now `viewMode` on a Roadmap, not separate routes).
 * Kept as a permanent redirect, not deleted, so old bookmarks/links still
 * land somewhere sensible.
 */
export default function ListPage() {
  permanentRedirect("/roadmap");
}
