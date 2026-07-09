"use client";

import { useMemo } from "react";
import { useRoadmap } from "@/lib/store";
import { barPosition, buildColumns, buildWindow } from "@/lib/dates";
import { STATUS_META, STATUSES, THEME_COLOR_META } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

const LABEL_W = 240;

// External-facing statuses use friendlier, audience-ready language.
const PUBLIC_STATUS: Record<string, string> = {
  planned: "Planned",
  opportunity_framing: "Exploring",
  solution_framing: "Designing",
  in_development: "In progress",
  released: "Shipped",
};

export function ExternalRoadmap() {
  const { initiatives, themes } = useRoadmap();

  const external = useMemo(
    () => initiatives.filter((i) => i.visibility === "external" && !i.archived),
    [initiatives]
  );
  const window = useMemo(
    () => buildWindow(external.map((i) => ({ start: i.targetStart, end: i.targetEnd }))),
    [external]
  );
  const columns = useMemo(() => buildColumns(window, "quarter"), [window]);
  const canvasWidth = Math.max(640, columns.length * 200);

  const groups = themes
    .map((t) => ({ theme: t, items: external.filter((i) => i.themeId === t.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-beige-5">
      {/* Branded header (placeholder — swap in the real marketing header later) */}
      <header className="border-b border-beige-20 bg-white">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-display text-lg font-semibold text-green-90">Kameleoon</span>
          </div>
          <div className="mono-label mt-8 text-lime-70">Product roadmap</div>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-semibold leading-tight text-green-90">
            What we&apos;re building next
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-green-70">
            A curated look at where the Kameleoon platform is heading. Dates are directional and
            subject to change.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-10">
        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          {STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-green-70">
              <span className={cn("h-2.5 w-2.5 rounded-sm", STATUS_META[s].dot)} />
              {PUBLIC_STATUS[s]}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-beige-20 bg-white">
          {/* Axis */}
          <div className="flex border-b border-beige-20">
            <div className="w-[240px] shrink-0" />
            <div className="relative h-10" style={{ width: canvasWidth }}>
              {columns.map((c) => (
                <div
                  key={c.key}
                  className="absolute bottom-1.5 flex items-baseline gap-1"
                  style={{ left: `${c.leftPct}%` }}
                >
                  <span className="text-[13px] font-medium text-green-70">{c.label}</span>
                  <span className="mono-label-sm text-beige-60">{c.sublabel}</span>
                </div>
              ))}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.theme.id} className="border-b border-beige-10 last:border-b-0">
              <div className="flex items-center gap-2 bg-beige-5 px-6 py-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", THEME_COLOR_META[g.theme.color].dot)} />
                <span className="text-[13px] font-semibold text-green-90">{g.theme.name}</span>
              </div>
              {g.items.map((i) => {
                const pos = barPosition(i.targetStart, i.targetEnd, window);
                const meta = STATUS_META[i.status];
                return (
                  <div key={i.id} className="flex items-stretch">
                    <div className="flex w-[240px] shrink-0 items-center px-6 py-3">
                      <span className="text-[13px] font-medium text-green-90">{i.title}</span>
                    </div>
                    <div className="relative py-3" style={{ width: canvasWidth }}>
                      <div
                        title={i.title}
                        className={cn(
                          "absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md px-2.5 text-xs font-medium",
                          meta.bar
                        )}
                        style={{ left: `${pos.leftPct}%`, width: `max(28px, ${pos.widthPct}%)` }}
                      >
                        <span className="truncate">{i.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-beige-60">
          Curated external view · internal notes, scores, and owners are never shown here.
        </p>
      </main>
    </div>
  );
}
