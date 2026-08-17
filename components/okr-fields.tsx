"use client";

import { useRef, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import type { BusinessUnit, Okr, OkrOwner, Owner, Team } from "@/lib/types";
import { ownerName } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, Eyebrow } from "./ui";
import { NativeSelect, TextInput } from "./form";
import { useOutsideClose } from "./hooks";

const baseInput =
  "w-full rounded-lg border border-beige-30 bg-white px-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90";

/**
 * Controlled owners editor: list of owner rows, add/remove. Follows
 * DeliveryLinksEditor's shape (list-with-add-button, per-row controls,
 * remove button). Each row also carries an `OkrOwner.role`, defaulted to
 * `"contributor"` and written through unchanged on save — the free-text role
 * input was dropped from this UI (Chickadee Week 2 plan §2 finding 6); the
 * schema column and its default stay as-is for a future, scoped role-tagging
 * feature.
 */
export function OkrOwnersEditor({
  okrId,
  owners,
  ownerOptions,
  onChange,
}: {
  okrId: string;
  owners: OkrOwner[];
  ownerOptions: Owner[];
  onChange: (owners: OkrOwner[]) => void;
}) {
  const selectedSet = new Set(owners.map((o) => o.ownerId));
  const firstUnselected = ownerOptions.find((opt) => !selectedSet.has(opt.id));
  const add = () =>
    onChange([...owners, { okrId, ownerId: firstUnselected?.id ?? "", role: "contributor" }]);
  const update = (idx: number, patch: Partial<OkrOwner>) =>
    onChange(owners.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  const remove = (idx: number) => onChange(owners.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow>Owners</Eyebrow>
        <button
          type="button"
          onClick={add}
          disabled={!firstUnselected}
          className="flex items-center gap-1 text-[13px] font-medium text-green-70 hover:text-green-60 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus size={14} /> Add owner
        </button>
      </div>
      <div className="space-y-2">
        {owners.map((o, idx) => {
          // Exclude owners already selected in *other* rows, but keep this
          // row's own current selection available (mirrors DependencyPicker's
          // selectedSet-filtering pattern in initiative-fields.tsx).
          const rowOptions = ownerOptions.filter(
            (opt) => opt.id === o.ownerId || !selectedSet.has(opt.id)
          );
          return (
          <div key={`${o.ownerId}-${idx}`} className="flex items-center gap-2 rounded-lg border border-beige-20 bg-beige-5 p-2.5">
            <div className="min-w-0 flex-1">
              <NativeSelect
                aria-label="Owner"
                value={o.ownerId}
                onChange={(e) => update(idx, { ownerId: e.target.value })}
              >
                {!ownerOptions.some((opt) => opt.id === o.ownerId) && (
                  <option value={o.ownerId}>{o.ownerId}</option>
                )}
                {rowOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {ownerName(opt)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="shrink-0 rounded-md p-2 text-beige-60 hover:bg-beige-10 hover:text-red-60"
              aria-label="Remove owner"
            >
              <Trash2 size={15} />
            </button>
          </div>
          );
        })}
        {owners.length === 0 && <p className="text-sm text-beige-60">No owners assigned yet.</p>}
      </div>
    </div>
  );
}

/**
 * Combined team/business-unit picker: one grouped dropdown listing both,
 * where selecting one clears whichever of teamId/businessUnitId doesn't
 * apply (PM decision, Chickadee plan §6 Q3 — not a mode-toggle). Callers
 * are still responsible for validating "exactly one selected" before save;
 * this component only ever sets exactly one, never both, never neither
 * once something has been chosen.
 */
export function TeamOrBuPicker({
  teams,
  businessUnits,
  teamId,
  businessUnitId,
  onChange,
}: {
  teams: Team[];
  businessUnits: BusinessUnit[];
  teamId?: string;
  businessUnitId?: string;
  onChange: (next: { teamId?: string; businessUnitId?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  useOutsideClose(ref, open, close);

  const selectedTeam = teamId ? teams.find((t) => t.id === teamId) : undefined;
  const selectedBu = businessUnitId ? businessUnits.find((b) => b.id === businessUnitId) : undefined;
  const label = selectedTeam?.name ?? selectedBu?.name;

  const q = query.trim().toLowerCase();
  const shownTeams = teams.filter((t) => !q || t.name.toLowerCase().includes(q));
  const shownBus = businessUnits.filter((b) => !q || b.name.toLowerCase().includes(q));

  const pickTeam = (id: string) => {
    onChange({ teamId: id, businessUnitId: undefined });
    close();
  };
  const pickBu = (id: string) => {
    onChange({ teamId: undefined, businessUnitId: id });
    close();
  };

  const renderTeamOption = (t: Team) => (
    <button
      key={t.id}
      type="button"
      role="option"
      aria-selected={t.id === teamId}
      onClick={() => pickTeam(t.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-beige-10",
        t.id === teamId ? "bg-beige-10 text-green-90" : "text-green-90"
      )}
    >
      <span className="truncate">{t.name}</span>
    </button>
  );

  // Sub-group the "Teams" section by parent business unit, one sub-header
  // per BU, with an "Other teams" fallback bucket for any team whose
  // businessUnitId doesn't resolve to a known BU.
  const teamsByBu = businessUnits
    .map((bu) => ({ bu, teams: shownTeams.filter((t) => t.businessUnitId === bu.id) }))
    .filter((g) => g.teams.length > 0);
  const otherTeams = shownTeams.filter((t) => !businessUnits.some((b) => b.id === t.businessUnitId));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Team or business unit"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(baseInput, "flex h-9 w-full items-center gap-2 pr-9 text-left")}
      >
        <span className={cn("truncate", label ? "text-green-90" : "text-beige-60")}>
          {label ?? "Choose a team or business unit"}
        </span>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-beige-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-beige-20 bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-beige-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), close())}
              placeholder="Search teams & business units…"
              className="h-8 w-full rounded-lg border border-beige-30 bg-white pl-8 pr-3 text-sm text-green-90 placeholder:text-beige-60 focus:outline-none focus:ring-2 focus:ring-green-90"
            />
          </div>
          <div className="calm-scroll max-h-60 space-y-0.5 overflow-auto" role="listbox">
            {shownTeams.length > 0 && (
              <>
                <div className="mono-label-sm px-2.5 py-1.5 text-beige-60">Teams</div>
                {teamsByBu.map(({ bu, teams: buTeams }) => (
                  <div key={bu.id}>
                    <div className="mono-label-sm px-4 py-1 text-beige-40">{bu.name}</div>
                    {buTeams.map(renderTeamOption)}
                  </div>
                ))}
                {otherTeams.length > 0 && (
                  <div>
                    <div className="mono-label-sm px-4 py-1 text-beige-40">Other teams</div>
                    {otherTeams.map(renderTeamOption)}
                  </div>
                )}
              </>
            )}
            {shownBus.length > 0 && (
              <>
                <div className="mono-label-sm px-2.5 py-1.5 text-beige-60">Business units</div>
                {shownBus.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={b.id === businessUnitId}
                    onClick={() => pickBu(b.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-beige-10",
                      b.id === businessUnitId ? "bg-beige-10 text-green-90" : "text-green-90"
                    )}
                  >
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </>
            )}
            {shownTeams.length === 0 && shownBus.length === 0 && (
              <div className="px-2.5 py-2 text-sm text-beige-60">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Achievement input: a percentage number field that keeps null ("not
 * assessed yet") distinct from 0 (assessed at zero). Local text state means
 * an emptied field reads as "" rather than silently coercing to 0/NaN; the
 * "Mark as not assessed" action is the one explicit way back to null once a
 * value has been set.
 */
export function AchievementInput({
  value,
  onCommit,
}: {
  value: Okr["achievement"];
  onCommit: (v: number | null) => void;
}) {
  // Local text is the source of truth while this input is mounted — every
  // commit (including "Mark as not assessed") writes it back in sync, so no
  // effect is needed to mirror `value` back into `text`. (This component is
  // remounted via the drawer's key={okr.id} when switching OKRs, which reruns
  // the initializer above for the fresh OKR.)
  const [text, setText] = useState(value === null ? "" : String(Math.round(value * 100)));

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      setText(value === null ? "" : String(Math.round(value * 100)));
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    setText(String(clamped));
    onCommit(clamped / 100);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="relative w-24">
        <TextInput
          type="number"
          min={0}
          max={100}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder="—"
          aria-label="Achievement percentage"
          className="pr-7"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-beige-60">
          %
        </span>
      </div>
      {value !== null && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setText("");
            onCommit(null);
          }}
        >
          Mark as not assessed
        </Button>
      )}
    </div>
  );
}
