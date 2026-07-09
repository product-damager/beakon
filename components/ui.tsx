"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn, initials } from "@/lib/cn";
import {
  CONFIDENCE_META,
  STATUS_META,
  THEME_COLOR_META,
  type Confidence,
  type Status,
  type ThemeColor,
} from "@/lib/types";

// ── Button (ShadCN variant mapping, Kameleoon colors, Inter sentence case) ──
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
export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "mono-label inline-flex items-center gap-1 rounded-md px-2 py-1 leading-none",
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
      <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </Tag>
  );
}

export function ConfidenceTag({ confidence }: { confidence: Confidence }) {
  const m = CONFIDENCE_META[confidence];
  return <Tag className={m.tag}>{m.label} confidence</Tag>;
}

export function ThemeDot({ color, className }: { color: ThemeColor; className?: string }) {
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", THEME_COLOR_META[color].dot, className)}
      aria-hidden
    />
  );
}

// ── Avatar ──
const AVATAR_TONES = [
  "bg-green-30 text-green-70",
  "bg-blue-30 text-blue-70",
  "bg-lime-30 text-lime-70",
  "bg-pink-30 text-pink-60",
  "bg-orange-30 text-orange-70",
];
export function Avatar({ name, className }: { name: string; className?: string }) {
  const tone = AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];
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
