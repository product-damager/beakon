"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Plus, Search, Trash2, X, type LucideIcon } from "lucide-react";
import {
  DEFAULT_SCORES,
  DELIVERY_TYPE_LABEL,
  DEMAND_OPTIONS,
  diveScore,
  IMPACT_OPTIONS,
  THEME_COLOR_META,
  VIABILITY_OPTIONS,
  type DeliveryLink,
  type DeliveryLinkType,
  type Initiative,
  type Scores,
  type Theme,
  type ThemeColor,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, Eyebrow, ScoreTierTag } from "./ui";
import { Field, NativeSelect, TextInput } from "./form";
import { useOutsideClose } from "./hooks";

/** Prepend https:// to a scheme-less URL so a delivery link never becomes relative. */
export function withScheme(url: string): string {
  const t = url.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

/** A compact "icon · label · value" property row (Notion-style), label on the left. */
export function PropRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[104px_1fr] items-start gap-3 rounded-lg px-2 py-1.5">
      <span className="flex items-center gap-2 pt-1.5 text-sm text-beige-60">
        <Icon size={15} strokeWidth={1.75} className="shrink-0" />
        {label}
      </span>
      <div className="min-w-0 self-center text-sm text-green-90">{children}</div>
    </div>
  );
}

/** A collapsible drawer section with a quiet header row. */
export function CollapsibleSection({
  label,
  open,
  onToggle,
  hint,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  /** Shown next to the label while collapsed, to say what's inside. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-beige-20 pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-beige-60 transition-transform", !open && "-rotate-90")}
        />
        <span className="mono-label text-beige-60">{label}</span>
        {!open && hint && <span className="ml-1 truncate text-xs text-beige-60">{hint}</span>}
      </button>
      {open && <div className="mt-4 flex flex-col gap-4">{children}</div>}
    </div>
  );
}

/** Controlled DIVE scorer box (optional; null = unscored). */
export function DiveEditor({
  scores,
  onChange,
}: {
  scores: Scores | null;
  onChange: (s: Scores | null) => void;
}) {
  const set = (k: keyof Scores, v: number) => onChange({ ...(scores ?? DEFAULT_SCORES), [k]: v });
  return (
    <div className="rounded-xl border border-beige-20 bg-beige-5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Prioritization · DIVE</Eyebrow>
        <span className="flex items-center gap-2 text-sm text-green-90">
          <ScoreTierTag score={diveScore(scores)} />
          {scores && <span className="font-display text-lg font-semibold">{diveScore(scores)}</span>}
        </span>
      </div>
      {scores ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Demand" hint="Accounts reached per month">
              <NativeSelect value={scores.demand} onChange={(e) => set("demand", Number(e.target.value))}>
                {DEMAND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.range}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Effort" hint="Person-months">
              <TextInput
                type="number"
                min={0.5}
                step={0.5}
                value={scores.effort}
                onChange={(e) => set("effort", Math.max(0.5, Number(e.target.value) || 0.5))}
              />
            </Field>
            <Field label="Impact">
              <NativeSelect value={scores.impact} onChange={(e) => set("impact", Number(e.target.value))}>
                {IMPACT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.value}×)
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Viability">
              <NativeSelect value={scores.viability} onChange={(e) => set("viability", Number(e.target.value))}>
                {VIABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.pct})
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-beige-60">DIVE = (Demand × Impact × Viability) ÷ Effort</p>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 text-[13px] font-medium text-beige-60 hover:text-green-90"
            >
              Clear score
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-beige-60">
            Not scored yet — add DIVE inputs when you&apos;re ready to prioritize.
          </p>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SCORES)}
            className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60"
          >
            <Plus size={14} /> Add DIVE score
          </button>
        </div>
      )}
    </div>
  );
}

/** Controlled delivery-links editor. Parent's onChange should persist (autosave). */
export function DeliveryLinksEditor({
  links,
  onChange,
}: {
  links: DeliveryLink[];
  onChange: (links: DeliveryLink[]) => void;
}) {
  const add = () =>
    onChange([
      ...links,
      { id: `d-${Math.random().toString(36).slice(2, 8)}`, label: "", url: "", type: "redmine" },
    ]);
  const update = (id: string, patch: Partial<DeliveryLink>) =>
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(links.filter((l) => l.id !== id));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow>Delivery links</Eyebrow>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60"
        >
          <Plus size={14} /> Add link
        </button>
      </div>
      <div className="space-y-2">
        {links.map((l) => (
          <div key={l.id} className="rounded-lg border border-beige-20 bg-beige-5 p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-32 shrink-0">
                <NativeSelect
                  value={l.type}
                  onChange={(e) => update(l.id, { type: e.target.value as DeliveryLinkType })}
                >
                  {(Object.keys(DELIVERY_TYPE_LABEL) as DeliveryLinkType[]).map((t) => (
                    <option key={t} value={t}>
                      {DELIVERY_TYPE_LABEL[t]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <TextInput
                value={l.label}
                onChange={(e) => update(l.id, { label: e.target.value })}
                placeholder="Label"
                className="flex-1"
              />
              {l.url.trim() && (
                <a
                  href={withScheme(l.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md p-2 text-beige-60 hover:bg-beige-10 hover:text-green-90"
                  aria-label="Open link"
                >
                  <ArrowUpRight size={15} />
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(l.id)}
                className="shrink-0 rounded-md p-2 text-beige-60 hover:bg-beige-10 hover:text-red-60"
                aria-label="Remove link"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <TextInput
              value={l.url}
              onChange={(e) => update(l.id, { url: e.target.value })}
              onBlur={() => l.url.trim() && update(l.id, { url: withScheme(l.url) })}
              placeholder="https://"
              className="mt-2"
            />
          </div>
        ))}
        {links.length === 0 && (
          <p className="text-sm text-beige-60">Link Redmine, Figma, Specs or anything else you want here.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Multi-select chip picker: current selections as removable chips plus a
 * searchable add-dropdown. Originally dependency-specific; generalized with
 * optional copy/behavior overrides so it also powers the OKR↔initiative
 * linking picker (Sprint Chickadee), which has no cycle concept — `wouldCycle`
 * defaults to "never" rather than duplicating ~90 lines for a thin sibling.
 * Candidates that would close a dependency cycle stay listed but disabled
 * with an inline reason — a warn-and-guard, not a silent drop.
 */
export function DependencyPicker({
  candidates,
  selected,
  onChange,
  wouldCycle,
  resolveTitle,
  addLabel = "Add dependency",
  emptyLabel = "No dependencies yet.",
  allSelectedLabel = "Every other initiative is already a dependency.",
  removeAriaLabel,
  searchPlaceholder = "Search initiatives…",
}: {
  candidates: Initiative[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Defaults to "never cycles" — only dependency links have a cycle concept. */
  wouldCycle?: (id: string) => boolean;
  resolveTitle: (id: string) => string;
  addLabel?: string;
  emptyLabel?: string;
  allSelectedLabel?: string;
  removeAriaLabel?: (title: string) => string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  useOutsideClose(ref, open, close);
  const checkCycle = wouldCycle ?? (() => false);
  const removeLabel = removeAriaLabel ?? ((title: string) => `Remove dependency: ${title}`);

  const selectedSet = new Set(selected);
  const add = (id: string) => onChange([...selected, id]);
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  const q = query.trim().toLowerCase();
  const addable = candidates
    .filter((c) => !selectedSet.has(c.id))
    .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
  const firstPickable = addable.find((c) => !checkCycle(c.id));

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-beige-20 bg-beige-5 py-1 pl-2 pr-1 text-sm text-green-90"
            >
              <span className="truncate">{resolveTitle(id)}</span>
              <button
                type="button"
                onClick={() => remove(id)}
                className="shrink-0 rounded p-0.5 text-beige-60 hover:bg-beige-20 hover:text-green-90"
                aria-label={removeLabel(resolveTitle(id))}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-beige-60">{emptyLabel}</p>
      )}

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60"
        >
          <Plus size={14} /> {addLabel}
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-beige-20 bg-white p-2 shadow-lg">
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-beige-60" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                  } else if (e.key === "Enter" && firstPickable) {
                    e.preventDefault();
                    add(firstPickable.id);
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
              />
            </div>
            <div className="calm-scroll max-h-56 space-y-0.5 overflow-auto" role="listbox">
              {addable.map((c) => {
                const isCyclic = checkCycle(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={isCyclic}
                    onClick={() => add(c.id)}
                    title={isCyclic ? "Would create a dependency cycle" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm",
                      isCyclic ? "cursor-not-allowed text-beige-60" : "text-green-90 hover:bg-beige-10"
                    )}
                  >
                    <span className="truncate">{c.title}</span>
                    {isCyclic && (
                      <span className="mono-label-sm ml-auto shrink-0 text-beige-60">would create a cycle</span>
                    )}
                  </button>
                );
              })}
              {addable.length === 0 && (
                <div className="px-2.5 py-2 text-sm text-beige-60">
                  {candidates.every((c) => selectedSet.has(c.id)) ? allSelectedLabel : "No matches"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline "＋ New theme" creator shown under the Theme picker. */
export function ThemeCreator({ onCreate }: { onCreate: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ThemeColor>("green");

  const reset = () => {
    setName("");
    setColor("green");
    setOpen(false);
  };

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({
      id: `t-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      description: "",
      color,
    });
    reset();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60"
      >
        <Plus size={14} /> New theme
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-beige-20 bg-beige-5 p-2.5">
      <TextInput
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        placeholder="Theme name"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            create();
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(Object.keys(THEME_COLOR_META) as ThemeColor[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            className={cn(
              "h-6 w-6 rounded-full ring-offset-1 transition",
              THEME_COLOR_META[c].dot,
              color === c ? "ring-2 ring-green-90" : "ring-0"
            )}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="text-[13px] font-medium text-beige-60 hover:text-green-90"
        >
          Cancel
        </button>
        <Button size="sm" onClick={create} disabled={!name.trim()}>
          Add theme
        </Button>
      </div>
    </div>
  );
}

/**
 * "Depends on x" closes a loop iff x can already reach the initiative via
 * dependsOn edges — build the reachability test over the live graph, with the
 * draft's (possibly unsaved) edges overriding the stored row.
 */
export function makeWouldCycle(initiatives: Initiative[], selfId: string, selfDeps: string[]) {
  const adj = new Map<string, string[]>();
  for (const it of initiatives) adj.set(it.id, it.dependsOn);
  adj.set(selfId, selfDeps);
  return (x: string): boolean => {
    if (x === selfId) return true;
    const seen = new Set<string>();
    const stack = [x];
    while (stack.length) {
      const cur = stack.pop() as string;
      if (cur === selfId) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const next of adj.get(cur) ?? []) stack.push(next);
    }
    return false;
  };
}
