"use client";

import { type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn, initials } from "@/lib/cn";
import {
  HEALTH_META,
  scoreTier,
  STATUS_META,
  THEME_COLOR_META,
  type Health,
  type Status,
  type ThemeColor,
} from "@/lib/types";

// ── Button (ShadCN variant mapping, Product colors, Inter sentence case) ──
type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  default: "bg-green-90 text-white hover:bg-green-80",
  secondary: "bg-beige-10 text-green-90 hover:bg-beige-20",
  outline: "border border-beige-30 text-green-90 bg-white hover:bg-beige-10",
  ghost: "text-green-90 hover:bg-beige-10",
  destructive: "bg-red-60 text-white hover:bg-red-70",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  default: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
  icon: "h-9 w-9",
};

export function Button({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-90 focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Tags / badges — Noto Sans Mono, 12px uppercase ──
/**
 * `shape` defaults to "round" (today's `rounded-md` corners, unchanged
 * everywhere it isn't explicitly overridden). "square" is a sharper-cornered
 * variant reserved for the OKR domain (governance/health badges), to read as
 * visually distinct from initiative status/health, which stay round
 * everywhere (List/Board/Timeline) — see Chickadee Week 2 plan §2 finding 4.
 */
export function Tag({
  className,
  children,
  shape = "round",
}: {
  className?: string;
  children: ReactNode;
  shape?: "round" | "square";
}) {
  return (
    <span
      className={cn(
        "mono-label inline-flex items-center gap-1 whitespace-nowrap px-2 py-1 leading-none",
        shape === "square" ? "rounded-sm" : "rounded-md",
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Collapsible group-header content (Sprint Vireo, Initiative 1) ──
/**
 * Shared visual content for a collapsible group-header band — chevron,
 * optional theme-color dot, label, count badge, depth-based weight/indent.
 * Extracted from `Timeline.tsx`'s group band (`:454-489`) so both `Timeline`
 * (a sticky-flex row) and `OkrGroupedList` (a `<table>` spanning row) render
 * identical group-header language while each still owns its own outer
 * wrapper — a flex row and a `<td colSpan>` aren't shareable at that level,
 * only the content inside them is. See the Vireo plan's "Component
 * structure" section for the full reasoning.
 *
 * Deliberately excludes the `<button>` itself: `aria-expanded`/`aria-label`
 * and the `focus-visible:ring-2 focus-visible:ring-inset
 * focus-visible:ring-green-90` focus style stay on each caller's own button
 * wrapper (copied over verbatim, not dropped) since the `collapsible={false}`
 * case below has no button at all.
 */
export function GroupHeaderContent({
  depth,
  label,
  count,
  color,
  collapsible = true,
  isCollapsed = false,
}: {
  /** 0 = top-level band (e.g. a Business Unit); 1 = nested band (a Team, or
   * the non-collapsible "Direct to <BU>" caption row). */
  depth: 0 | 1;
  label: string;
  /** Omit for the non-collapsible caption row, which has no count to show. */
  count?: number;
  color?: ThemeColor;
  /** `false` renders a quiet, non-toggleable caption row (the direct-to-BU
   * case) — no chevron, no count badge, no bold weight, just muted label
   * text — instead of the normal chevron/label/count band. */
  collapsible?: boolean;
  isCollapsed?: boolean;
}) {
  if (!collapsible) {
    return (
      <span className={cn("flex min-w-0 items-center gap-2", depth === 1 && "pl-5")}>
        <span className="truncate text-xs text-beige-60">{label}</span>
      </span>
    );
  }
  return (
    <span className={cn("flex min-w-0 items-center gap-2", depth === 1 && "pl-5")}>
      <ChevronRight
        size={15}
        className={cn("shrink-0 text-beige-60 transition-transform", !isCollapsed && "rotate-90")}
      />
      {color && <span className={cn("h-3.5 w-1 shrink-0 rounded-[2px]", THEME_COLOR_META[color].dot)} />}
      <span
        className={cn(
          "truncate text-sm text-green-90",
          depth === 0 ? "font-semibold" : "font-medium"
        )}
      >
        {label}
      </span>
      {count !== undefined && <span className="mono-label-sm text-green-70">{count}</span>}
    </span>
  );
}

export function StatusTag({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <Tag className={m.tag}>
      {/* Round marker — status is a dot; theme uses the bar; health carries none. */}
      <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </Tag>
  );
}

export function HealthTag({ health, shape }: { health: Health; shape?: "round" | "square" }) {
  const m = HEALTH_META[health];
  // No marker — the pill background already carries the health colour; a dot
  // would just repeat it (and collide with the status/theme markers).
  return (
    <Tag className={m.tag} shape={shape}>
      {m.label}
    </Tag>
  );
}

/**
 * DIVE tier badge (🐟 Big catch / 🌊 Worth a dive / 💧 Surface nibble). Leads
 * with the tier, not the raw score, so the UI ranks by bucket instead of false
 * precision. `score` is a computed diveScore(); callers pass diveScore(scores).
 */
export function ScoreTierTag({ score, className }: { score: number | null; className?: string }) {
  const t = scoreTier(score);
  return (
    <Tag className={cn("whitespace-nowrap", t.tag, className)}>
      <span aria-hidden>{t.emoji}</span>
      {t.label}
    </Tag>
  );
}

/** Theme marker — a vertical rounded bar, so it never reads as the round status dot. */
export function ThemeDot({ color, className }: { color: ThemeColor; className?: string }) {
  return (
    <span
      className={cn("h-3 w-1 shrink-0 rounded-[2px]", THEME_COLOR_META[color].dot, className)}
      aria-hidden
    />
  );
}

// ── Avatar ──
// text-green-90 ink on the light -30 tints keeps every tone ≥ 4.5:1 (pink-60 ink
// was 2.39:1 and failed AA). `neutral` drops the hue entirely — used where a
// coloured avatar would add a competing colour dimension (e.g. the Timeline).
const AVATAR_TONES = [
  "bg-green-30 text-green-90",
  "bg-blue-30 text-green-90",
  "bg-lime-30 text-green-90",
  "bg-pink-30 text-green-90",
  "bg-orange-30 text-green-90",
];
const AVATAR_NEUTRAL = "bg-beige-30 text-green-90";
export function Avatar({
  name,
  className,
  neutral = false,
}: {
  name: string;
  className?: string;
  neutral?: boolean;
}) {
  const tone = neutral ? AVATAR_NEUTRAL : AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];
  return (
    <span
      title={name}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        tone,
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

// ── Icon-only segmented control ──
/**
 * Icon-only variant of the toolbar `Segmented` control (FilterBar.tsx:60-86
 * — a text-labeled mutually-exclusive toggle for Group/Zoom). Deliberately a
 * separate small component here rather than adding an `iconOnly` prop to
 * that one: FilterBar.tsx's toolbar internals are owned by a different,
 * fully-independent Sprint Heron Week 2 workstream (Timeline header/toolbar
 * compaction, T42-T46) mid-build in this same sprint, so this avoids a file
 * conflict rather than reusing that exact component. Same visual language
 * (rounded-lg border, p-0.5 wrapper, active = bg-green-90/text-white) —
 * sized per docs/design/roadmap-sidebar-header-sharing.md §2.1 (`px-2 py-1.5`
 * per button, tighter than the text variant's `px-2.5 py-1`).
 */
export function IconSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[];
  value: T;
  onChange: (v: T) => void;
  /** e.g. a Shared+View-only Roadmap — matches Button's disabled treatment. */
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg border border-beige-30 bg-white p-0.5">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-label={o.label}
            title={o.label}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center rounded-md px-2 py-1.5 transition-colors",
              "disabled:pointer-events-none disabled:opacity-50",
              value === o.value ? "bg-green-90 text-white" : "text-green-70 hover:bg-beige-10"
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

// ── Eyebrow label ──
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mono-label text-beige-60", className)}>{children}</div>;
}
