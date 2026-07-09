"use client";

import {
  ArrowUpRight,
  Archive,
  Clock,
  Link2,
  Lock,
  Pencil,
  X,
} from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { formatDateEN, quarterLabelFromISO } from "@/lib/dates";
import { DELIVERY_TYPE_LABEL, REACH_OPTIONS, riceScore, THEME_COLOR_META } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Drawer } from "./Drawer";
import { Avatar, Button, HealthTag, Eyebrow, StatusTag, Tag } from "./ui";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow className="mb-1">{label}</Eyebrow>
      <div className="text-sm text-green-90">{children}</div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <p className="whitespace-pre-line text-sm leading-relaxed text-green-90">{children}</p>
    </div>
  );
}

export function InitiativeDrawer() {
  const { selectedId, getInitiative, getOwner, getTheme, initiatives, select, openEdit, archiveInitiative } =
    useRoadmap();
  const i = selectedId ? getInitiative(selectedId) : undefined;

  const owner = i ? getOwner(i.ownerId) : undefined;
  const theme = i ? getTheme(i.themeId) : undefined;
  const blocks = i ? initiatives.filter((x) => x.dependsOn.includes(i.id) && !x.archived) : [];

  return (
    <Drawer open={Boolean(i)} onClose={() => select(null)} width={480}>
      {i && (
        <>
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-beige-20 bg-white px-6 pb-4 pt-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {theme && (
                  <span className={cn("h-2.5 w-2.5 rounded-full", THEME_COLOR_META[theme.color].dot)} />
                )}
                <Eyebrow>{theme?.name ?? "No theme"}</Eyebrow>
              </div>
              <button
                onClick={() => select(null)}
                className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <h2 className="font-display text-xl font-semibold leading-snug text-green-90">
              {i.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusTag status={i.status} />
              <Tag className={i.visibility === "external" ? "bg-green-30 text-green-70" : "bg-beige-30 text-beige-60"}>
                {i.visibility === "external" ? "External" : "Internal"}
              </Tag>
              <HealthTag health={i.health} />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-6 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <Row label="Owner">
                <span className="flex items-center gap-2">
                  {owner && <Avatar name={owner.name} className="h-6 w-6 text-[10px]" />}
                  {owner?.name ?? "Unassigned"}
                </span>
              </Row>
              <Row label="Team">{i.team}</Row>
              <Row label="Timeframe">
                {formatDateEN(i.targetStart)} → {formatDateEN(i.targetEnd)}
              </Row>
              <Row label="Target quarter">
                {quarterLabelFromISO(i.targetStart)}
                {quarterLabelFromISO(i.targetStart) !== quarterLabelFromISO(i.targetEnd) &&
                  ` – ${quarterLabelFromISO(i.targetEnd)}`}
              </Row>
            </div>

            {i.summary && <Section label="Summary">{i.summary}</Section>}
            {i.problem && <Section label="Problem">{i.problem}</Section>}
            {i.expectedOutcome && <Section label="Expected outcome">{i.expectedOutcome}</Section>}
            {i.strategicGoal && <Section label="Strategic goal">{i.strategicGoal}</Section>}

            {/* Scoring — RICE */}
            <div>
              <Eyebrow className="mb-2">Prioritization · RICE</Eyebrow>
              <div className="rounded-xl border border-beige-20 bg-beige-5 p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-sm text-green-90">RICE score</span>
                  <span className="font-display text-2xl font-semibold text-green-90">
                    {riceScore(i.scores)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Reach", value: REACH_OPTIONS.find((o) => o.value === i.scores.reach)?.label ?? String(i.scores.reach) },
                    { label: "Impact", value: `${i.scores.impact}×` },
                    { label: "Confidence", value: `${Math.round(i.scores.confidence * 100)}%` },
                    { label: "Effort", value: `${i.scores.effort} pm` },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-white py-2">
                      <div className="font-display text-lg font-semibold text-green-90">
                        {m.value}
                      </div>
                      <div className="mono-label-sm text-beige-60">{m.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-beige-60">
                  RICE = (Reach × Impact × Confidence) ÷ Effort
                </p>
              </div>
            </div>

            {/* Delivery links */}
            <div>
              <Eyebrow className="mb-2">Delivery links</Eyebrow>
              {i.deliveryLinks.length ? (
                <ul className="space-y-1.5">
                  {i.deliveryLinks.map((l) => (
                    <li key={l.id}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-beige-20 bg-white px-3 py-2 text-sm text-green-90 hover:border-green-40 hover:bg-beige-5"
                      >
                        <Link2 size={15} className="text-beige-60" />
                        <span className="mono-label-sm rounded bg-beige-10 px-1.5 py-0.5 text-beige-60">
                          {DELIVERY_TYPE_LABEL[l.type]}
                        </span>
                        <span className="truncate">{l.label}</span>
                        <ArrowUpRight size={14} className="ml-auto text-beige-60" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-beige-60">No links yet.</p>
              )}
            </div>

            {/* Dependencies */}
            {(i.dependsOn.length > 0 || blocks.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Eyebrow className="mb-2">Depends on</Eyebrow>
                  {i.dependsOn.length ? (
                    <ul className="space-y-1">
                      {i.dependsOn.map((id) => {
                        const dep = getInitiative(id);
                        return (
                          <li key={id}>
                            <button
                              onClick={() => dep && select(dep.id)}
                              className="text-left text-sm text-green-70 underline-offset-2 hover:text-green-60 hover:underline"
                            >
                              {dep?.title ?? id}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-beige-60">—</p>
                  )}
                </div>
                <div>
                  <Eyebrow className="mb-2">Blocks</Eyebrow>
                  {blocks.length ? (
                    <ul className="space-y-1">
                      {blocks.map((b) => (
                        <li key={b.id}>
                          <button
                            onClick={() => select(b.id)}
                            className="text-left text-sm text-green-70 underline-offset-2 hover:text-green-60 hover:underline"
                          >
                            {b.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-beige-60">—</p>
                  )}
                </div>
              </div>
            )}

            {/* Internal notes */}
            <div>
              <Eyebrow className="mb-1.5 flex items-center gap-1.5">
                <Lock size={12} /> Internal notes
              </Eyebrow>
              <div className="rounded-xl border border-beige-20 bg-beige-5 p-3 text-sm leading-relaxed text-green-90">
                {i.notes ? (
                  i.notes
                ) : (
                  <span className="text-beige-60">No internal notes.</span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-beige-60">
                Notes and scores never appear on the external roadmap.
              </p>
            </div>

            {/* Activity placeholder */}
            <div>
              <Eyebrow className="mb-1.5">Activity</Eyebrow>
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-beige-30 bg-beige-5/50 px-3 py-3 text-sm text-beige-60">
                <Clock size={15} />
                Change history and comments are coming in a later milestone.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-beige-20 bg-white px-6 py-3">
            <Button onClick={() => openEdit(i)}>
              <Pencil size={15} /> Edit
            </Button>
            <Button variant="ghost" onClick={() => archiveInitiative(i.id)}>
              <Archive size={15} /> Archive
            </Button>
            <span className="ml-auto text-xs text-beige-60">
              Updated {formatDateEN(i.updatedAt.slice(0, 10))}
            </span>
          </div>
        </>
      )}
    </Drawer>
  );
}
