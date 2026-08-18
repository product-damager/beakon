"use client";

import { useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  CalendarRange,
  Flag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { HEALTH_META } from "@/lib/types";
import type {
  BusinessUnit,
  Health,
  Okr,
  OkrClass,
  OkrInitiativeLink,
  OkrOwner,
  StrategicObjective,
  Team,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Drawer } from "./Drawer";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, Eyebrow, HealthTag, StatusTag, Tag } from "./ui";
import { Field, InlineTagSelect, NativeSelect, SearchableSelect, TextArea, TextInput } from "./form";
import { DependencyPicker } from "./initiative-fields";
import { AchievementInput, OkrOwnersEditor, TeamOrBuPicker } from "./okr-fields";
import { OKR_GOVERNANCE_META, formatAchievement } from "./OkrList";
import { OKR_GOVERNANCE_STATUSES } from "./OkrFilterBar";

const OKR_CLASS_LABEL: Record<NonNullable<Okr["okrClass"]>, string> = {
  committed: "Committed",
  conditional: "Conditional",
  optional: "Optional",
};
const OKR_CLASS_OPTIONS: OkrClass[] = ["committed", "conditional", "optional"];
const HEALTH_KEYS = Object.keys(HEALTH_META) as Health[];

function Prop({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-beige-60" />
      <div className="min-w-0 flex-1">
        <div className="mono-label-sm text-beige-60">{label}</div>
        <div className="mt-0.5 text-sm text-green-90">{children}</div>
      </div>
    </div>
  );
}

/**
 * One drawer for viewing and editing an OKR. Existing OKRs edit in place and
 * autosave per field (discrete controls commit immediately, free text on
 * blur); "New OKR" opens the same drawer on a local draft with an explicit
 * Create — mirrors InitiativeDrawer's convention exactly.
 */
export function OkrDrawer({
  okr,
  creatingDraft,
  onClose,
  teams,
  businessUnits,
  strategicObjectives,
  okrOwners,
  okrInitiatives,
  saveOkr,
  archiveOkr,
  unarchiveOkr,
}: {
  /** The currently-selected existing OKR, if any. */
  okr: Okr | undefined;
  /** A local "new OKR" draft owned by the page; non-null opens create mode. */
  creatingDraft: Okr | null;
  onClose: () => void;
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
  saveOkr: (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => void;
  archiveOkr: (id: string) => void;
  unarchiveOkr: (id: string) => void;
}) {
  const creating = creatingDraft !== null;
  const source = creating ? creatingDraft : okr;
  if (!source) return null;
  // Key by id so switching OKRs (or create → view) fully resets local state.
  return (
    <DrawerBody
      key={source.id}
      source={source}
      creating={creating}
      onClose={onClose}
      teams={teams}
      businessUnits={businessUnits}
      strategicObjectives={strategicObjectives}
      okrOwners={okrOwners}
      okrInitiatives={okrInitiatives}
      saveOkr={saveOkr}
      archiveOkr={archiveOkr}
      unarchiveOkr={unarchiveOkr}
    />
  );
}

function DrawerBody({
  source,
  creating,
  onClose,
  teams,
  businessUnits,
  strategicObjectives,
  okrOwners,
  okrInitiatives,
  saveOkr,
  archiveOkr,
  unarchiveOkr,
}: {
  source: Okr;
  creating: boolean;
  onClose: () => void;
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
  saveOkr: (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => void;
  archiveOkr: (id: string) => void;
  unarchiveOkr: (id: string) => void;
}) {
  // Owners/initiatives lists themselves are global (already loaded via
  // useRoadmap()) — reused here for owner options and the linking picker.
  const { owners, initiatives, notify } = useRoadmap();

  const [d, setD] = useState<Okr>(source);
  const [ownersDraft, setOwnersDraft] = useState<OkrOwner[]>(() =>
    okrOwners.filter((o) => o.okrId === source.id)
  );
  const [initiativeIdsDraft, setInitiativeIdsDraft] = useState<string[]>(() =>
    okrInitiatives.filter((l) => l.okrId === source.id).map((l) => l.initiativeId)
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [objectiveTouched, setObjectiveTouched] = useState(false);
  const [teamBuTouched, setTeamBuTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  // Local edit + autosave. Discrete controls commit immediately via patch(); free
  // text commits on blur via saveNow(). In create mode nothing persists until Create.
  // `lastSavedRef` tracks the last snapshot actually written via saveOkr(), so
  // a blur/commit that didn't change anything (e.g. click into title, click
  // back out) skips the persistence call instead of stamping a fresh
  // updatedAt for no reason.
  const lastSavedRef = useRef({ okr: source, owners: ownersDraft, initiativeIds: initiativeIdsDraft });
  // Mirrors of `d`/`ownersDraft`/`initiativeIdsDraft`, updated synchronously on
  // every write (both from `set()` and from `commit()`). React does not
  // guarantee that a `setState` updater callback runs synchronously, so
  // `commit()` cannot rely on one to read "the current value" before it
  // calls `saveIfChanged` — refs are the only synchronously-correct source
  // of truth here.
  const dRef = useRef(d);
  const ownersDraftRef = useRef(ownersDraft);
  const initiativeIdsDraftRef = useRef(initiativeIdsDraft);
  const set = <K extends keyof Okr>(key: K, value: Okr[K]) => {
    const next = { ...dRef.current, [key]: value };
    dRef.current = next;
    setD(next);
  };
  const saveIfChanged = (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => {
    const next = { okr, owners, initiativeIds };
    if (JSON.stringify(next) === JSON.stringify(lastSavedRef.current)) return;
    lastSavedRef.current = next;
    saveOkr(okr, owners, initiativeIds);
  };
  // Single commit path for every save trigger. Each argument defaults to the
  // corresponding ref (always synchronously current) rather than either the
  // closured `d`/`ownersDraft`/`initiativeIdsDraft` variables (which could be
  // stale relative to a just-applied sibling call in the same tick) or a
  // `setState` updater's side effect (which React doesn't guarantee runs
  // synchronously). `okrPartial` merges onto the fresh ref value (mirroring
  // the old `patch`'s "merge onto latest" behavior) rather than replacing it
  // outright.
  const commit = (okrPartial?: Partial<Okr>, ownersNext?: OkrOwner[], initiativeIdsNext?: string[]) => {
    const okrValue = okrPartial ? { ...dRef.current, ...okrPartial } : dRef.current;
    const ownersValue = ownersNext ?? ownersDraftRef.current;
    const initiativeIdsValue = initiativeIdsNext ?? initiativeIdsDraftRef.current;

    dRef.current = okrValue;
    ownersDraftRef.current = ownersValue;
    initiativeIdsDraftRef.current = initiativeIdsValue;

    setD(okrValue);
    setOwnersDraft(ownersValue);
    setInitiativeIdsDraft(initiativeIdsValue);

    if (creating) return; // create mode: local draft only, no persistence yet
    saveIfChanged(okrValue, ownersValue, initiativeIdsValue);
  };
  const patch = (p: Partial<Okr>) => commit(p);
  const saveNow = () => commit();
  const patchOwners = (next: OkrOwner[]) => commit(undefined, next);
  const patchInitiativeIds = (next: string[]) => commit(undefined, undefined, next);

  const titleMissing = d.title.trim().length === 0;
  const objectiveMissing = d.strategicObjectiveId.trim().length === 0;
  // UI-enforced XOR (not just a DB-constraint backstop, per Chickadee plan §5)
  // — the combined picker only ever sets exactly one, but this still guards
  // the initial "nothing chosen yet" create-mode state and any future bug.
  const teamBuInvalid = Boolean(d.teamId) === Boolean(d.businessUnitId);
  const canSave = !titleMissing && !objectiveMissing && !teamBuInvalid;

  const ownerOptionsForPicker = owners;
  const initiativeCandidates = initiatives.filter((i) => !i.archived);

  const dirty =
    creating &&
    (JSON.stringify(d) !== JSON.stringify(source) ||
      ownersDraft.length > 0 ||
      initiativeIdsDraft.length > 0);
  const attemptClose = () => {
    if (dirty) setConfirmOpen(true);
    else onClose();
  };

  const create = () => {
    if (!canSave) {
      setTitleTouched(true);
      setObjectiveTouched(true);
      setTeamBuTouched(true);
      return;
    }
    const toSave: Okr = { ...d, title: d.title.trim() };
    saveOkr(toSave, ownersDraft, initiativeIdsDraft);
    notify({ message: "OKR created", tone: "success" });
    onClose();
  };

  const governance = OKR_GOVERNANCE_META[d.governanceStatus];

  return (
    <Drawer open onClose={attemptClose} width={520}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-beige-20 bg-white px-6 pb-4 pt-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Eyebrow>{creating ? "New OKR" : "Edit OKR"}</Eyebrow>
          <button
            onClick={attemptClose}
            className="rounded-md p-1 text-beige-60 hover:bg-beige-10 hover:text-green-90"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <input
          value={d.title}
          onChange={(e) => set("title", e.target.value)}
          onBlur={() => {
            setTitleTouched(true);
            patch({ title: d.title.trim() });
          }}
          placeholder="What is this OKR?"
          aria-label="Title"
          autoFocus={creating}
          className="-mx-2 w-[calc(100%+1rem)] rounded-md border border-transparent bg-transparent px-2 py-0.5 font-display text-xl font-semibold leading-snug text-green-90 placeholder:text-beige-40 hover:border-beige-30 hover:bg-beige-5 focus:border-green-90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-90/30"
        />
        {titleTouched && titleMissing && <p className="mt-1 text-xs text-red-70">Give the OKR a title.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tag shape="square" className={governance.tag}>
            {governance.label}
          </Tag>
          <HealthTag health={d.health} shape="square" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 px-6 py-5">
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-beige-20 bg-beige-5 p-4">
          <div className="col-span-2">
            <Prop icon={Users} label="Team / business unit">
              <TeamOrBuPicker
                teams={teams}
                businessUnits={businessUnits}
                teamId={d.teamId}
                businessUnitId={d.businessUnitId}
                onChange={({ teamId, businessUnitId }) => {
                  setTeamBuTouched(true);
                  patch({ teamId, businessUnitId });
                }}
              />
              {teamBuTouched && teamBuInvalid && (
                <p className="mt-1 text-xs text-red-70">Choose exactly one team or business unit.</p>
              )}
            </Prop>
          </div>
          <div className="col-span-2">
            <Prop icon={Building2} label="Strategic objective">
              <SearchableSelect
                ariaLabel="Strategic objective"
                value={d.strategicObjectiveId}
                onChange={(v) => {
                  setObjectiveTouched(true);
                  patch({ strategicObjectiveId: v });
                }}
                placeholder="Choose an objective"
                options={strategicObjectives.map((s) => ({ value: s.id, label: s.name }))}
              />
              {objectiveTouched && objectiveMissing && (
                <p className="mt-1 text-xs text-red-70">Choose a strategic objective.</p>
              )}
            </Prop>
          </div>
          <div className="col-span-2">
            <Prop icon={Flag} label="Target date">
              <TextInput
                type="date"
                value={d.targetDate ?? ""}
                onChange={(e) => patch({ targetDate: e.target.value || undefined })}
                aria-label="Target date"
              />
            </Prop>
          </div>
          <div className="col-span-2">
            <Prop icon={CalendarRange} label="Year / quarter">
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  type="number"
                  value={d.year}
                  onChange={(e) => set("year", Number(e.target.value) || d.year)}
                  onBlur={saveNow}
                  aria-label="Year"
                  className="w-full"
                />
                <NativeSelect
                  aria-label="Quarter"
                  value={d.quarter}
                  onChange={(e) => patch({ quarter: Number(e.target.value) })}
                  className="w-full"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </Prop>
          </div>
        </div>

        <Field label="Governance status">
          <NativeSelect
            value={d.governanceStatus}
            onChange={(e) => patch({ governanceStatus: e.target.value as Okr["governanceStatus"] })}
          >
            {OKR_GOVERNANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {OKR_GOVERNANCE_META[s].label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Health">
          <InlineTagSelect
            label="Change health"
            value={d.health}
            options={HEALTH_KEYS}
            render={(h: Health) => <HealthTag health={h} shape="square" />}
            onSelect={(health) => patch({ health })}
          />
        </Field>

        <Field label="Deliverable detail">
          <TextArea
            value={d.deliverableDetail}
            onChange={(e) => set("deliverableDetail", e.target.value)}
            onBlur={saveNow}
          />
        </Field>

        {/* Achievement — keeps null ("not assessed yet") distinct from 0. */}
        <div className="rounded-xl border border-beige-20 bg-beige-5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Achievement</Eyebrow>
            <span
              className={cn(
                "font-display text-lg font-semibold",
                d.achievement === null ? "text-beige-60" : "text-green-90"
              )}
            >
              {formatAchievement(d.achievement)}
            </span>
          </div>
          <AchievementInput value={d.achievement} onCommit={(achievement) => patch({ achievement })} />
        </div>

        <Field label="Notes">
          <TextArea value={d.notes} onChange={(e) => set("notes", e.target.value)} onBlur={saveNow} />
        </Field>

        {/* De-emphasized: a post-governance delivery-commitment tier, optional
         * and read by nothing downstream — styled visually secondary and
         * placed low in the form, not alongside required fields like Health. */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-beige-60">
            OKR class
            <span className="font-normal text-beige-40">Optional</span>
          </label>
          <NativeSelect
            value={d.okrClass ?? ""}
            onChange={(e) => patch({ okrClass: (e.target.value || null) as OkrClass | null })}
            className="max-w-[220px] h-8 text-[13px] text-beige-60"
          >
            <option value="">Not classified</option>
            {OKR_CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {OKR_CLASS_LABEL[c]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <OkrOwnersEditor
          okrId={d.id}
          owners={ownersDraft}
          ownerOptions={ownerOptionsForPicker}
          onChange={patchOwners}
        />

        <div>
          <Eyebrow className="mb-2">Linked initiatives</Eyebrow>
          <DependencyPicker
            candidates={initiativeCandidates}
            selected={initiativeIdsDraft}
            onChange={patchInitiativeIds}
            resolveTitle={(id) => initiatives.find((i) => i.id === id)?.title ?? id}
            addLabel="Add initiative"
            emptyLabel="No linked initiatives yet."
            allSelectedLabel="Every initiative is already linked."
            removeAriaLabel={(title) => `Unlink initiative: ${title}`}
            renderSelected={(selected, remove) =>
              selected.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-beige-20">
                  <table className="w-full text-sm">
                    <tbody>
                      {selected.map((id) => {
                        const linked = initiatives.find((i) => i.id === id);
                        return (
                          <tr key={id} className="border-b border-beige-10 last:border-b-0">
                            <td className="px-3 py-2 text-green-90">{linked?.title ?? id}</td>
                            <td className="w-px whitespace-nowrap px-3 py-2">
                              {/* Round shape, unaffected by T14's OKR-scoped square badges — StatusTag doesn't take a shape prop; initiative status stays round everywhere. */}
                              {linked && <StatusTag status={linked.status} />}
                            </td>
                            <td className="w-px px-2 py-2">
                              <button
                                type="button"
                                onClick={() => remove(id)}
                                className="shrink-0 rounded p-1 text-beige-60 hover:bg-beige-10 hover:text-red-60"
                                aria-label={`Unlink initiative: ${linked?.title ?? id}`}
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-beige-60">No linked initiatives yet.</p>
              )
            }
          />
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-beige-20 bg-white px-6 py-3">
        {creating ? (
          <>
            <Button variant="secondary" onClick={attemptClose}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!canSave}>
              Create OKR
            </Button>
          </>
        ) : (
          <>
            {d.archived ? (
              <Button
                variant="ghost"
                onClick={() => {
                  unarchiveOkr(d.id);
                  notify({ message: `“${d.title}” restored` });
                }}
              >
                <ArchiveRestore size={15} /> Restore
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setArchiveConfirmOpen(true)}>
                <Archive size={15} /> Archive
              </Button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Discard this OKR?"
        body="You haven't created this OKR yet. If you close now, it won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="Archive this OKR?"
        body="Archived OKRs are hidden from the default list — you can restore them anytime from Show archived."
        confirmLabel="Archive"
        cancelLabel="Cancel"
        tone="destructive"
        onConfirm={() => {
          setArchiveConfirmOpen(false);
          archiveOkr(d.id);
          notify({
            message: `“${d.title}” archived`,
            action: { label: "Undo", onClick: () => unarchiveOkr(d.id) },
          });
          onClose();
        }}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </Drawer>
  );
}
