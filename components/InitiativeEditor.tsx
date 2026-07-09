"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import {
  CONFIDENCE_OPTIONS,
  DELIVERY_TYPE_LABEL,
  HEALTH_META,
  IMPACT_OPTIONS,
  riceScore,
  STATUS_META,
  STATUSES,
  TEAMS,
  type DeliveryLink,
  type DeliveryLinkType,
  type Health,
  type Initiative,
} from "@/lib/types";
import { Drawer } from "./Drawer";
import { Button, Eyebrow } from "./ui";
import { Field, NativeSelect, TextArea, TextInput } from "./form";

export function InitiativeEditor() {
  const { editorDraft, closeEditor } = useRoadmap();
  return (
    <Drawer open={Boolean(editorDraft)} onClose={closeEditor} width={560}>
      {editorDraft && <EditorForm key={editorDraft.id} draft={editorDraft} />}
    </Drawer>
  );
}

function EditorForm({ draft }: { draft: Initiative }) {
  const { themes, owners, initiatives, saveInitiative, closeEditor } = useRoadmap();
  const [d, setD] = useState<Initiative>(draft);
  const isNew = !initiatives.some((x) => x.id === draft.id);

  const set = <K extends keyof Initiative>(key: K, value: Initiative[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const setScore = (key: keyof Initiative["scores"], value: number) =>
    setD((prev) => ({ ...prev, scores: { ...prev.scores, [key]: value } }));

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

  const canSave = d.title.trim().length > 0 && d.targetStart <= d.targetEnd;

  const save = () => {
    if (!canSave) return;
    saveInitiative(d);
    closeEditor();
  };

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-beige-20 bg-white px-6 py-4">
        <div>
          <Eyebrow>{isNew ? "New" : "Edit"}</Eyebrow>
          <h2 className="font-display text-lg font-semibold text-green-90">
            {isNew ? "Create initiative" : d.title || "Edit initiative"}
          </h2>
        </div>
        <button
          onClick={closeEditor}
          className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <Field label="Title">
          <TextInput
            value={d.title}
            autoFocus
            onChange={(e) => set("title", e.target.value)}
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
          <Field label="Visibility">
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
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
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
            <NativeSelect value={d.themeId} onChange={(e) => set("themeId", e.target.value)}>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
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
          <Field label="Target end">
            <TextInput type="date" value={d.targetEnd} onChange={(e) => set("targetEnd", e.target.value)} />
          </Field>
        </div>

        <Field label="Strategic goal">
          <TextInput
            value={d.strategicGoal}
            onChange={(e) => set("strategicGoal", e.target.value)}
            placeholder="Which company goal does this serve?"
          />
        </Field>

        {/* Scoring — RICE */}
        <div className="rounded-xl border border-beige-20 bg-beige-5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Prioritization · RICE</Eyebrow>
            <span className="text-sm text-green-90">
              RICE score{" "}
              <span className="font-display text-lg font-semibold">{riceScore(d.scores)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reach" hint="Users / accounts per quarter">
              <TextInput
                type="number"
                min={0}
                value={d.scores.reach}
                onChange={(e) => setScore("reach", Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
            <Field label="Effort" hint="Person-months">
              <TextInput
                type="number"
                min={0.5}
                step={0.5}
                value={d.scores.effort}
                onChange={(e) => setScore("effort", Math.max(0.5, Number(e.target.value) || 0.5))}
              />
            </Field>
            <Field label="Impact">
              <NativeSelect
                value={d.scores.impact}
                onChange={(e) => setScore("impact", Number(e.target.value))}
              >
                {IMPACT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.value}×)
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Confidence">
              <NativeSelect
                value={d.scores.confidence}
                onChange={(e) => setScore("confidence", Number(e.target.value))}
              >
                {CONFIDENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.pct})
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <p className="mt-3 text-xs text-beige-60">
            RICE = (Reach × Impact × Confidence) ÷ Effort
          </p>
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
        <Button variant="secondary" onClick={closeEditor}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave}>
          {isNew ? "Create initiative" : "Save changes"}
        </Button>
      </div>
    </>
  );
}
