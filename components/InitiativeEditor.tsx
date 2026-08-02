"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import {
  DEFAULT_SCORES,
  DELIVERY_TYPE_LABEL,
  DEMAND_OPTIONS,
  diveScore,
  HEALTH_META,
  IMPACT_OPTIONS,
  normalizeThemeColor,
  ownerName,
  STATUS_META,
  STATUSES,
  TEAMS,
  THEME_COLOR_META,
  VIABILITY_OPTIONS,
  type DeliveryLink,
  type DeliveryLinkType,
  type Health,
  type Initiative,
  type Scores,
  type Theme,
  type ThemeColor,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Drawer } from "./Drawer";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, Eyebrow, ScoreTierTag } from "./ui";
import { Field, NativeSelect, SearchableSelect, TextArea, TextInput } from "./form";

/** Prepend https:// to a scheme-less URL so a delivery link never becomes relative. */
function withScheme(url: string): string {
  const t = url.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

export function InitiativeEditor() {
  const { editorDraft } = useRoadmap();
  if (!editorDraft) return null;
  // Key by id so switching drafts fully resets local form state.
  return <EditorForm key={editorDraft.id} draft={editorDraft} />;
}

function EditorForm({ draft }: { draft: Initiative }) {
  const { themes, owners, initiatives, saveInitiative, addTheme, closeEditor, notify, select } =
    useRoadmap();
  const [d, setD] = useState<Initiative>(draft);
  const [titleTouched, setTitleTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isNew = !initiatives.some((x) => x.id === draft.id);

  const set = <K extends keyof Initiative>(key: K, value: Initiative[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const setScore = (key: keyof Scores, value: number) =>
    setD((prev) => ({ ...prev, scores: { ...(prev.scores ?? DEFAULT_SCORES), [key]: value } }));
  const addScore = () => setD((prev) => ({ ...prev, scores: DEFAULT_SCORES }));
  const clearScore = () => setD((prev) => ({ ...prev, scores: null }));

  const addLink = () =>
    set("deliveryLinks", [
      ...d.deliveryLinks,
      { id: `d-${Math.random().toString(36).slice(2, 8)}`, label: "", url: "", type: "redmine" },
    ]);
  const updateLink = (id: string, patch: Partial<DeliveryLink>) =>
    set("deliveryLinks", d.deliveryLinks.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLink = (id: string) =>
    set("deliveryLinks", d.deliveryLinks.filter((l) => l.id !== id));

  const toggleDep = (id: string) =>
    set("dependsOn", d.dependsOn.includes(id) ? d.dependsOn.filter((x) => x !== id) : [...d.dependsOn, id]);

  const titleMissing = d.title.trim().length === 0;
  const dateOutOfOrder = d.targetStart > d.targetEnd;
  const canSave = !titleMissing && !dateOutOfOrder;
  const scores = d.scores; // null = unscored



  // Guard the close paths (Cancel, ✕, Esc, backdrop) when there are edits.
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(draft), [d, draft]);
  const attemptClose = () => (dirty ? setConfirmOpen(true) : closeEditor());

  const save = () => {
    if (!canSave) return;
    // Drop blank rows and give scheme-less URLs an https:// prefix so links work.
    const cleanLinks = d.deliveryLinks
      .filter((l) => l.url.trim() || l.label.trim())
      .map((l) => ({ ...l, url: withScheme(l.url), label: l.label.trim() }));
    const toSave: Initiative = { ...d, title: d.title.trim(), deliveryLinks: cleanLinks };
    saveInitiative(toSave);
    notify({
      message: isNew ? "Initiative created" : "Changes saved",
      tone: "success",
      action: isNew ? { label: "View", onClick: () => select(toSave.id) } : undefined,
    });
    closeEditor();
  };

  return (
    <Drawer open onClose={attemptClose} width={560}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-beige-20 bg-white px-6 py-4">
        <div>
          <Eyebrow>{isNew ? "New" : "Edit"}</Eyebrow>
          <h2 className="font-display text-lg font-semibold text-green-90">
            {isNew ? "Create initiative" : d.title || "Edit initiative"}
          </h2>
        </div>
        <button
          onClick={attemptClose}
          className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <Field
          label="Title"
          required
          error={titleTouched && titleMissing ? "Give the initiative a title." : undefined}
        >
          <TextInput
            value={d.title}
            autoFocus
            onChange={(e) => set("title", e.target.value)}
            onBlur={() => setTitleTouched(true)}
            aria-invalid={titleTouched && titleMissing}
            placeholder="What is this initiative?"
          />
        </Field>

        <Field label="Summary">
          <TextArea
            value={d.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="One or two lines a stakeholder can grasp quickly."
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <NativeSelect value={d.status} onChange={(e) => set("status", e.target.value as Initiative["status"])}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Visibility"
            hint={
              d.visibility === "external"
                ? "Shown on the public /share roadmap — title, summary, timeframe & status only. Notes and scores stay internal."
                : "Internal initiatives never appear on the public /share roadmap."
            }
          >
            <NativeSelect
              value={d.visibility}
              onChange={(e) => set("visibility", e.target.value as Initiative["visibility"])}
            >
              <option value="internal">Internal only</option>
              <option value="external">External (shareable)</option>
            </NativeSelect>
          </Field>
          <Field label="Owner">
            <NativeSelect value={d.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {ownerName(o)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Team">
            <NativeSelect value={d.team} onChange={(e) => set("team", e.target.value)}>
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Theme">
            <SearchableSelect
              ariaLabel="Theme"
              value={d.themeId}
              onChange={(v) => set("themeId", v)}
              placeholder="No theme"
              options={[
                { value: "", label: "No theme" },
                ...themes.map((t) => ({
                  value: t.id,
                  label: t.name,
                  dot: THEME_COLOR_META[normalizeThemeColor(t.color)].dot,
                })),
              ]}
            />
            <ThemeCreator
              onCreate={(t) => {
                addTheme(t);
                set("themeId", t.id);
              }}
            />
          </Field>
          <Field label="Health">
            <NativeSelect value={d.health} onChange={(e) => set("health", e.target.value as Health)}>
              {(Object.keys(HEALTH_META) as Health[]).map((h) => (
                <option key={h} value={h}>
                  {HEALTH_META[h].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Target start">
            <TextInput type="date" value={d.targetStart} onChange={(e) => set("targetStart", e.target.value)} />
          </Field>
          <Field
            label="Target end"
            error={dateOutOfOrder ? "End date must be on or after the start date." : undefined}
          >
            <TextInput
              type="date"
              value={d.targetEnd}
              onChange={(e) => set("targetEnd", e.target.value)}
              aria-invalid={dateOutOfOrder}
            />
          </Field>
        </div>

        <Field label="Strategic goal">
          <TextInput
            value={d.strategicGoal}
            onChange={(e) => set("strategicGoal", e.target.value)}
            placeholder="Which company goal does this serve?"
          />
        </Field>

        {/* Scoring — DIVE (optional; starts unscored) */}
        <div className="rounded-xl border border-beige-20 bg-beige-5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Prioritization · DIVE</Eyebrow>
            <span className="flex items-center gap-2 text-sm text-green-90">
              <ScoreTierTag score={diveScore(scores)} />
              {scores && (
                <span className="font-display text-lg font-semibold">{diveScore(scores)}</span>
              )}
            </span>
          </div>
          {scores ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Demand" hint="Accounts reached per month">
                  <NativeSelect
                    value={scores.demand}
                    onChange={(e) => setScore("demand", Number(e.target.value))}
                  >
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
                    onChange={(e) => setScore("effort", Math.max(0.5, Number(e.target.value) || 0.5))}
                  />
                </Field>
                <Field label="Impact">
                  <NativeSelect
                    value={scores.impact}
                    onChange={(e) => setScore("impact", Number(e.target.value))}
                  >
                    {IMPACT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} ({o.value}×)
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Viability">
                  <NativeSelect
                    value={scores.viability}
                    onChange={(e) => setScore("viability", Number(e.target.value))}
                  >
                    {VIABILITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} ({o.pct})
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-beige-60">
                  DIVE = (Demand × Impact × Viability) ÷ Effort
                </p>
                <button
                  type="button"
                  onClick={clearScore}
                  className="shrink-0 text-[13px] font-medium text-beige-60 hover:text-green-90"
                >
                  Clear score
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-beige-60">
                Not scored yet — add DIVE inputs when you’re ready to prioritize.
              </p>
              <button
                type="button"
                onClick={addScore}
                className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60"
              >
                <Plus size={14} /> Add DIVE score
              </button>
            </div>
          )}
        </div>

        <Field label="Problem">
          <TextArea value={d.problem} onChange={(e) => set("problem", e.target.value)} />
        </Field>
        <Field label="Expected outcome">
          <TextArea value={d.expectedOutcome} onChange={(e) => set("expectedOutcome", e.target.value)} />
        </Field>

        {/* Delivery links */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Delivery links</Eyebrow>
            <button
              type="button"
              onClick={addLink}
              className="flex items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60"
            >
              <Plus size={14} /> Add link
            </button>
          </div>
          <div className="space-y-2">
            {d.deliveryLinks.map((l) => (
              <div key={l.id} className="rounded-lg border border-beige-20 bg-beige-5 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-32 shrink-0">
                    <NativeSelect
                      value={l.type}
                      onChange={(e) => updateLink(l.id, { type: e.target.value as DeliveryLinkType })}
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
                    onChange={(e) => updateLink(l.id, { label: e.target.value })}
                    placeholder="Label"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(l.id)}
                    className="shrink-0 rounded-md p-2 text-beige-60 hover:bg-beige-10 hover:text-red-60"
                    aria-label="Remove link"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <TextInput
                  value={l.url}
                  onChange={(e) => updateLink(l.id, { url: e.target.value })}
                  placeholder="https://"
                  className="mt-2"
                />
              </div>
            ))}
            {d.deliveryLinks.length === 0 && (
              <p className="text-sm text-beige-60">
                Link Redmine, Figma, Specs or anything else you want here.
              </p>
            )}
          </div>
        </div>

        {/* Dependencies */}
        <div>
          <Eyebrow className="mb-2">Depends on</Eyebrow>
          <div className="calm-scroll max-h-40 space-y-1 overflow-auto rounded-xl border border-beige-20 bg-white p-2">
            {initiatives
              .filter((x) => x.id !== d.id && !x.archived)
              .map((x) => (
                <label
                  key={x.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-green-90 hover:bg-beige-10"
                >
                  <input
                    type="checkbox"
                    checked={d.dependsOn.includes(x.id)}
                    onChange={() => toggleDep(x.id)}
                    className="accent-green-90"
                  />
                  <span className="truncate">{x.title}</span>
                </label>
              ))}
          </div>
        </div>

        <Field label="Internal notes" hint="Never shown on the external roadmap.">
          <TextArea value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center justify-end gap-2 border-t border-beige-20 bg-white px-6 py-3">
        <Button variant="secondary" onClick={attemptClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave}>
          {isNew ? "Create initiative" : "Save changes"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Discard your changes?"
        body="This initiative has unsaved changes. If you close now, they'll be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          setConfirmOpen(false);
          closeEditor();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Drawer>
  );
}

/** Inline "＋ New theme" creator shown under the Theme picker. */
function ThemeCreator({ onCreate }: { onCreate: (t: Theme) => void }) {
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
