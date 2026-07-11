// ── Core domain types for Beakon ──

export type Status =
  | "planned"
  | "opportunity_framing"
  | "solution_framing"
  | "in_development"
  | "released";
export type Visibility = "internal" | "external";
export type Health = "on_track" | "at_risk" | "blocked";
export type GroupBy = "theme" | "team" | "owner";
export type Zoom = "month" | "quarter" | "half";
export type ViewKey = "timeline" | "board" | "list";

/** Product friendly palette family used to color a theme. */
export type ThemeColor = "green" | "blue" | "lime" | "pink" | "orange" | "beige";

export type DeliveryLinkType = "redmine" | "figma" | "spec" | "notion" | "other";

export interface Owner {
  id: string;
  name: string;
  /** Family name; optional. Combined with `name` for display — see ownerName(). */
  surname?: string;
  role: string;
  /** Product team sign-in email; used to auto-identify the signed-in user as owner. */
  email?: string;
  /** The person's team (one of TEAMS); set from profile settings. */
  team?: string;
}

/**
 * Human label for an owner: "Name Surname" when both exist, whichever single one
 * is present, else the email. Trims so stray/whitespace-only fields don't show.
 */
export function ownerName(o: Owner | undefined): string {
  if (!o) return "";
  const full = [o.name, o.surname].map((s) => s?.trim()).filter(Boolean).join(" ");
  return full || o.email?.trim() || "";
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  color: ThemeColor;
}

export interface DeliveryLink {
  id: string;
  label: string;
  url: string;
  type: DeliveryLinkType;
}

/**
 * DIVE inputs — see diveScore(). DIVE is a log-calibrated take on RICE: because
 * product value is heavy-tailed, each factor is scored on its real order of
 * magnitude so the multiply (which is addition in log-space) rewards the rare
 * transformative bet instead of flattening it.
 *   D — Demand    (was Reach)      : accounts reached / month, log bands
 *   I — Impact    (was Impact)     : size of the outcome, stretched log
 *   V — Viability (was Confidence) : how sure we are
 *   E — Effort    (was Effort)     : person-months
 */
export interface Scores {
  demand: number; // 3 | 15 | 50 | 250 | 1000  (band midpoints, accounts/month)
  impact: number; // 0.25 | 0.5 | 1 | 3 | 10
  viability: number; // 0.5 | 0.8 | 1  (hopeful / evidence / proven)
  effort: number; // person-months
}

export interface Initiative {
  id: string;
  title: string;
  summary: string;
  problem: string;
  expectedOutcome: string;
  status: Status;
  ownerId: string;
  team: string;
  themeId: string;
  strategicGoal: string;
  scores: Scores;
  health: Health;
  targetStart: string; // ISO date
  targetEnd: string; // ISO date
  deliveryLinks: DeliveryLink[];
  dependsOn: string[]; // initiative ids
  visibility: Visibility;
  notes: string; // internal-only, excluded from external share
  updatedAt: string; // ISO datetime
  archived: boolean;
  /**
   * Global sort order (board drag, list/timeline order). Optional at construction:
   * the store assigns it on load (from Supabase, or by index in seed mode) and on
   * save, so every initiative held in state has a defined position.
   */
  position?: number;
}

// ── Derived helpers ──

/** DIVE score = (Demand × Impact × Viability) ÷ Effort. Rounded; 0 when effort is 0. */
export function diveScore(s: Scores): number {
  if (!s.effort) return 0;
  return Math.round((s.demand * s.impact * s.viability) / s.effort);
}

/**
 * Score tier — a puffin dives for the biggest fish, not surface nibbles.
 * Kills false precision: rank by tier, not by 1247-vs-1183.
 */
export interface ScoreTier {
  label: string;
  emoji: string;
  tag: string; // badge classes
}
export function scoreTier(score: number): ScoreTier {
  if (score >= 500) return { label: "Big catch", emoji: "🐟", tag: "bg-green-30 text-green-70" };
  if (score >= 50) return { label: "Worth a dive", emoji: "🌊", tag: "bg-blue-30 text-blue-70" };
  return { label: "Surface nibble", emoji: "💧", tag: "bg-beige-30 text-beige-60" };
}

/**
 * Demand — accounts reached per month, scored as the geometric midpoint of each
 * band so the score reflects real order of magnitude (~333× top to bottom).
 * 1–5 → 3 | 6–25 → 15 | 26–100 → 50 | 101–500 → 250 | 501+ → 1000
 */
export const DEMAND_OPTIONS = [
  { value: 1000, label: "501+", range: "501+ accounts / month" },
  { value: 250, label: "101–500", range: "101–500 accounts / month" },
  { value: 50, label: "26–100", range: "26–100 accounts / month" },
  { value: 15, label: "6–25", range: "6–25 accounts / month" },
  { value: 3, label: "1–5", range: "1–5 accounts / month" },
] as const;

/** Impact — stretched log multiplier so a transformative bet outweighs a tweak. */
export const IMPACT_OPTIONS = [
  { value: 10, label: "Massive" },
  { value: 3, label: "High" },
  { value: 1, label: "Medium" },
  { value: 0.5, label: "Low" },
  { value: 0.25, label: "Minimal" },
] as const;

/** Viability — how sure we are the bet pays off. */
export const VIABILITY_OPTIONS = [
  { value: 1, label: "Proven", pct: "100%" },
  { value: 0.8, label: "Evidence", pct: "80%" },
  { value: 0.5, label: "Hopeful", pct: "50%" },
] as const;

export const TEAMS = [
  "App System",
  "Tech & Perso Builders",
  "Visual Builders",
] as const;

/** Delivery funnel order: discovery → shaping → build → ship. */
export const STATUSES: Status[] = [
  "planned",
  "opportunity_framing",
  "solution_framing",
  "in_development",
  "released",
];

export interface StatusMeta {
  label: string;
  bar: string; // bar fill (bg + text) classes
  dot: string; // small indicator bg
  tag: string; // badge classes
}

/** Status is the meaning-bearing color on the timeline. Lime is reserved for UI accents. */
export const STATUS_META: Record<Status, StatusMeta> = {
  planned: {
    label: "Planned",
    bar: "bg-blue-40 text-blue-80",
    dot: "bg-blue-50",
    tag: "bg-blue-30 text-blue-70",
  },
  opportunity_framing: {
    label: "Opportunity Framing",
    bar: "bg-pink-60 text-white",
    dot: "bg-pink-60",
    tag: "bg-pink-30 text-pink-60",
  },
  solution_framing: {
    label: "Solution Framing",
    bar: "bg-orange-60 text-white",
    dot: "bg-orange-60",
    tag: "bg-orange-30 text-orange-70",
  },
  in_development: {
    label: "In Development",
    bar: "bg-green-60 text-white",
    dot: "bg-green-60",
    tag: "bg-green-30 text-green-70",
  },
  released: {
    label: "Released",
    bar: "bg-green-90 text-white",
    dot: "bg-green-90",
    tag: "bg-green-90 text-white",
  },
};

/** Delivery health — a live signal, distinct from the RICE estimate. */
export const HEALTH_META: Record<Health, { label: string; tag: string; dot: string }> = {
  on_track: { label: "On track", tag: "bg-green-30 text-green-70", dot: "bg-green-60" },
  at_risk: { label: "At risk", tag: "bg-orange-30 text-orange-70", dot: "bg-orange-60" },
  blocked: { label: "Blocked", tag: "bg-red-30 text-red-70", dot: "bg-red-60" },
};

export const THEME_COLOR_META: Record<ThemeColor, { dot: string; soft: string; text: string }> = {
  green: { dot: "bg-green-60", soft: "bg-green-10", text: "text-green-70" },
  blue: { dot: "bg-blue-50", soft: "bg-blue-10", text: "text-blue-70" },
  lime: { dot: "bg-lime-50", soft: "bg-lime-10", text: "text-lime-70" },
  pink: { dot: "bg-pink-60", soft: "bg-pink-30", text: "text-pink-60" },
  orange: { dot: "bg-orange-60", soft: "bg-orange-30", text: "text-orange-70" },
  beige: { dot: "bg-beige-50", soft: "bg-beige-20", text: "text-beige-60" },
};

/**
 * Coerce an arbitrary color string (e.g. a DB value) into a known ThemeColor.
 * The `themes.color` column is free `text`, so a hand-edited or legacy row can
 * hold a value outside the six keys — indexing THEME_COLOR_META with it yields
 * `undefined` and any downstream `.dot`/`.tag` deref would white-screen a view.
 * Matching is trimmed and case-insensitive; anything unknown falls back to the
 * schema default, "green".
 */
export function normalizeThemeColor(color: string | null | undefined): ThemeColor {
  const key = (color ?? "").trim().toLowerCase();
  return key in THEME_COLOR_META ? (key as ThemeColor) : "green";
}

export const DELIVERY_TYPE_LABEL: Record<DeliveryLinkType, string> = {
  redmine: "Redmine",
  figma: "Figma",
  spec: "Spec",
  notion: "Notion",
  other: "Other",
};
