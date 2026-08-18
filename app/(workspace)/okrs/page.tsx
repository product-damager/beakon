"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { useOkrWorkspace } from "@/lib/useOkrWorkspace";
import { EMPTY_OKR_FILTERS, OkrFilterBar, applyOkrFilters, type OkrFilters } from "@/components/OkrFilterBar";
import { OkrList } from "@/components/OkrList";
import { OkrDrawer } from "@/components/OkrDrawer";
import { Logo } from "@/components/Logo";
import type { Okr, StrategicObjective, Team } from "@/lib/types";

/** A fresh, unsaved OKR draft for "New OKR" — mirrors RoadmapProvider's
 * newDraft(): sensible defaults (first team/objective) rather than forcing
 * every field to be picked from scratch, title/team-or-BU still required
 * before Create is enabled. */
function newOkrDraft(teams: Team[], strategicObjectives: StrategicObjective[]): Okr {
  const now = new Date();
  return {
    id: `okr-${Math.random().toString(36).slice(2, 9)}`,
    title: "",
    strategicObjectiveId: strategicObjectives[0]?.id ?? "",
    teamId: teams[0]?.id,
    businessUnitId: undefined,
    year: now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3) + 1,
    deliverableDetail: "",
    governanceStatus: "draft",
    okrClass: null,
    targetDate: undefined,
    achievement: null,
    health: "on_track",
    notes: "",
    archived: false,
    updatedAt: now.toISOString(),
  };
}

export default function OkrsPage() {
  // useSearchParams() (used to open "New OKR" from AppShell's header button —
  // see components/AppShell.tsx) needs a Suspense boundary per Next.js.
  return (
    <Suspense fallback={null}>
      <OkrsPageInner />
    </Suspense>
  );
}

function OkrsPageInner() {
  const {
    businessUnits,
    teams,
    strategicObjectives,
    okrs,
    okrOwners,
    okrInitiatives,
    loading,
    error,
    saveOkr,
    archiveOkr,
    unarchiveOkr,
    dismissError,
  } = useOkrWorkspace();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<OkrFilters>(EMPTY_OKR_FILTERS);
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState<Okr | null>(null);

  // AppShell's "New OKR" button navigates to /okrs?new=1 (no second global
  // provider for OKR state — see lib/useOkrWorkspace.ts's own doc comment).
  // Consumed once teams/objectives have loaded, then stripped from the URL —
  // genuinely syncing from an external system (the URL), not derivable state,
  // so the setState-in-effect rule is suppressed here rather than restructured.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loading) return;
    if (searchParams.get("new") === "1") {
      setSelectedOkrId(null);
      setCreatingDraft(newOkrDraft(teams, strategicObjectives));
      router.replace("/okrs", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on the URL/loading flip, not every team/objective refresh
  }, [searchParams, loading]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => applyOkrFilters(okrs, filters, teams), [okrs, filters, teams]);
  const selectedOkr = selectedOkrId ? okrs.find((o) => o.id === selectedOkrId) : undefined;

  const closeDrawer = () => {
    setSelectedOkrId(null);
    setCreatingDraft(null);
  };

  // This page's data-fetch is independent of useRoadmap().loading (which
  // gates AppShell's own spinner and is initiative-only) — see lib/useOkrWorkspace.ts.
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-beige-60">
          <Logo size={26} tile className="animate-pulse" />
          <span className="mono-label-sm">Loading OKRs…</span>
        </div>
      </div>
    );
  }

  // No data ever loaded (initial fetch itself failed) — nothing sensible to
  // render underneath, so this is the only case that takes over the full page.
  // Invariant this relies on: every mutation path in useOkrWorkspace.ts
  // (saveOkr, setArchived) applies its optimistic setOkrs update *before* the
  // async persist call that can set `error` — so okrs.length === 0 is a safe
  // proxy for "the initial load failed," never "a mutation failed on an
  // otherwise-empty workspace." If a future mutation path is added that can
  // fail before/without an optimistic setOkrs update, this check needs to be
  // revisited or it will incorrectly take over the full page.
  if (error && okrs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center text-sm text-beige-60">
          <AlertTriangle size={20} className="text-red-60" />
          <p className="text-green-90">Could not load OKRs.</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="flex items-center gap-2 border-b border-red-30 bg-red-30/50 px-6 py-2 text-[13px] text-red-70">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="flex-1 truncate">{error}</span>
          <button
            onClick={dismissError}
            className="shrink-0 rounded p-0.5 hover:bg-red-30"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {okrs.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-beige-60">No OKRs yet.</p>
        </div>
      ) : (
        <>
          <OkrFilterBar
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            teams={teams}
            businessUnits={businessUnits}
            strategicObjectives={strategicObjectives}
          />
          <OkrList
            okrs={filtered}
            teams={teams}
            businessUnits={businessUnits}
            strategicObjectives={strategicObjectives}
            okrOwners={okrOwners}
            okrInitiatives={okrInitiatives}
            saveOkr={saveOkr}
            onSelect={(id) => {
              setCreatingDraft(null);
              setSelectedOkrId(id);
            }}
          />
        </>
      )}
      <OkrDrawer
        okr={selectedOkr}
        creatingDraft={creatingDraft}
        onClose={closeDrawer}
        teams={teams}
        businessUnits={businessUnits}
        strategicObjectives={strategicObjectives}
        okrOwners={okrOwners}
        okrInitiatives={okrInitiatives}
        saveOkr={saveOkr}
        archiveOkr={archiveOkr}
        unarchiveOkr={unarchiveOkr}
      />
    </div>
  );
}
