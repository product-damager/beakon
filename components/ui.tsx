"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
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
        "mono-label inline-flex items-center gap-1 px-2 py-1 leading-none",
        shape === "square" ? "rounded-sm" : "rounded-md",
        className
      )}
    >
      {children}
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

// ── Eyebrow label ──
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mono-label text-beige-60", className)}>{children}</div>;
}
