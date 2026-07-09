// ── Core domain types for Beakon ──

export type Status =
  | "planned"
  | "opportunity_framing"
  | "solution_framing"
  | "in_development"
  | "released";
export type Visibility = "internal" | "external";
export type Confidence = "low" | "medium" | "high";
export type GroupBy = "theme" | "team" | "owner";
export type Zoom = "month" | "quarter" | "half";
export type ViewKey = "timeline" | "board" | "list";

/** Kameleoon palette family used to color a theme. */
export type ThemeColor = "green" | "blue" | "lime" | "pink" | "orange" | "beige";

export type DeliveryLinkType = "redmine" | "figma" | "spec" | "notion" | "other";

export interface Owner {
  id: string;
  name: string;
  role: string;
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

export interface Scores {
  impact: number; // 1..5
  effort: number; // 1..5
  strategicFit: number; // 1..5
  urgency: number; // 1..5
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
  confidence: Confidence;
  targetStart: string; // ISO date
  targetEnd: string; // ISO date
  deliveryLinks: DeliveryLink[];
  dependsOn: string[]; // initiative ids
  visibility: Visibility;
  notes: string; // internal-only, excluded from external share
  updatedAt: string; // ISO datetime
  archived: boolean;
}

// ── Derived helpers ──

/** priority score = impact + strategic fit + urgency - effort (fixed in v1, spec §Scoring). */
export function priorityScore(s: Scores): number {
  return s.impact + s.strategicFit + s.urgency - s.effort;
}

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

export const CONFIDENCE_META: Record<Confidence, { label: string; tag: string }> = {
  low: { label: "Low", tag: "bg-red-30 text-red-70" },
  medium: { label: "Medium", tag: "bg-orange-30 text-orange-70" },
  high: { label: "High", tag: "bg-green-30 text-green-70" },
};

export const THEME_COLOR_META: Record<ThemeColor, { dot: string; soft: string; text: string }> = {
  green: { dot: "bg-green-60", soft: "bg-green-10", text: "text-green-70" },
  blue: { dot: "bg-blue-50", soft: "bg-blue-10", text: "text-blue-70" },
  lime: { dot: "bg-lime-50", soft: "bg-lime-10", text: "text-lime-70" },
  pink: { dot: "bg-pink-60", soft: "bg-pink-30", text: "text-pink-60" },
  orange: { dot: "bg-orange-60", soft: "bg-orange-30", text: "text-orange-70" },
  beige: { dot: "bg-beige-50", soft: "bg-beige-20", text: "text-beige-60" },
};

export const DELIVERY_TYPE_LABEL: Record<DeliveryLinkType, string> = {
  redmine: "Redmine",
  figma: "Figma",
  spec: "Spec",
  notion: "Notion",
  other: "Other",
};
