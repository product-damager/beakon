// ── Shared OKR list constants/helpers ──
// The flat, sortable OkrList() table component that used to live here was
// removed in Sprint Vireo (docs/plans/vireo-grouped-okr-view-and-drawer-
// detail-rework.md, Initiative 1) — /okrs now renders components/
// OkrGroupedList.tsx unconditionally instead. This file stays for the
// constants/helpers other, unrelated call sites still depend on:
// OkrDrawer.tsx (governance tag rendering, achievement formatting),
// ArchivedOkrs.tsx (governance tag rendering on its own independent flat
// table), and OkrGroupedList.tsx (everything below, since its row markup
// was moved — not duplicated — out of the deleted OkrList()).
import { HEALTH_META, type Health, type OkrGovernanceStatus } from "@/lib/types";

/** Health values in severity order — Delayed sorts last (PM decision, see
 * lib/types.ts's HEALTH_META doc comment). Used by OkrGroupedList for its
 * (non-interactive) health rollup and by anything sorting on health. */
export const HEALTH_ORDER: Record<Health, number> = { on_track: 0, at_risk: 1, blocked: 2, delayed: 3 };
/** Health values in severity order, for the inline picker options. */
export const HEALTH_KEYS = Object.keys(HEALTH_META) as Health[];

/**
 * Governance workflow state — its own meaning-bearing palette (distinct from
 * STATUS_META's delivery-funnel colors), following the same tag-class shape.
 */
export const OKR_GOVERNANCE_META: Record<OkrGovernanceStatus, { label: string; tag: string; order: number }> = {
  // bg-beige-20/text-beige-60 measured ~2.98:1 on white — fails WCAG AA
  // (4.5:1). text-beige-70 (~5.4:1 on white, ~4.7:1 on this bg) keeps Draft
  // the visually quietest of the six governance states without the fail.
  draft: { label: "Draft", tag: "bg-beige-20 text-beige-70", order: 0 },
  to_validate: { label: "To validate", tag: "bg-blue-30 text-blue-70", order: 1 },
  // Moved off orange (Sprint Vireo, Initiative 2) — orange collided with
  // HEALTH_META.at_risk's own bg-orange-30/text-orange-70, two unrelated
  // domains (governance workflow vs. delivery health) sharing one hue.
  // See tailwind.config.ts's violet comment for the WCAG contrast figures.
  being_reviewed: { label: "Being reviewed", tag: "bg-violet-30 text-violet-70", order: 2 },
  to_refine: { label: "To refine", tag: "bg-pink-30 text-pink-60", order: 3 },
  validated: { label: "Validated", tag: "bg-green-30 text-green-70", order: 4 },
  rejected: { label: "Rejected", tag: "bg-red-30 text-red-70", order: 5 },
};
/** Governance values in workflow order, for the inline picker options. */
export const GOVERNANCE_KEYS = Object.keys(OKR_GOVERNANCE_META) as OkrGovernanceStatus[];

/** Short column alias per strategic objective, so the list column doesn't
 * have to carry each objective's full name ("Core: Strengthening our
 * foundations", etc.) — the full name is still available via a `title`
 * tooltip at the call site. Keyed by id, not parsed from the name string,
 * so it doesn't silently break if naming conventions change. Falls back to
 * the full name for any future objective not yet given a short alias. */
export const STRATEGIC_OBJECTIVE_ALIAS: Record<string, string> = {
  "so-core": "Core",
  "so-ai": "AI",
  "so-data": "Data",
  "so-internal": "Internal",
};

/** Achievement is null when the OKR hasn't been assessed yet — mirrors the
 * DIVE "Not cast yet" convention (see lib/types.ts's scoreTier()). Rendered
 * as the shorter "N/A" to keep the list column compact; a `title` tooltip
 * at the call site spells out "Not assessed yet" for anyone who hovers. */
export function formatAchievement(a: number | null): string {
  return a === null ? "N/A" : `${Math.round(a * 100)}%`;
}

export type OkrColumnKey =
  | "title"
  | "team"
  | "objective"
  | "quarter"
  | "governance"
  | "health"
  | "achievement"
  | "updated";

export interface OkrColumn {
  k: OkrColumnKey;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
}

/** Column set for the OKR table — shared by OkrGroupedList's static
 * (non-sortable) thead. Sort-per-column was cut from the grouped view's
 * scope (PM decision — see the Vireo plan's "Data shape" section); these
 * are display labels only now, no SortKey/Th coupling. */
export const OKR_COLUMNS: OkrColumn[] = [
  { k: "title", label: "Title", className: "w-80" },
  { k: "objective", label: "Objective", className: "w-20" },
  { k: "quarter", label: "Quarter" },
  { k: "governance", label: "Governance", className: "w-44" },
  { k: "health", label: "Health", className: "w-32" },
  { k: "team", label: "Team", className: "w-28" },
  { k: "achievement", label: "Achievement", align: "right", className: "w-28" },
  { k: "updated", label: "Updated", align: "right" },
];
