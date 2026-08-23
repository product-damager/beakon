"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { useOkrWorkspace } from "@/lib/useOkrWorkspace";
import { useRoadmap } from "@/lib/store";
import { EMPTY_OKR_FILTERS, normalizeOkrFilters, type OkrFilters } from "@/lib/okrFilters";
import { OkrFilterBar, applyOkrFilters } from "@/components/OkrFilterBar";
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

/** localStorage key for the full OkrFilters object (Sprint Heron Week 2,
 * ADR 008 decision 3) — persists quarters/teamIds/businessUnitIds/
 * strategicObjectiveIds across reloads, the reload-reset papercut the PM
 * named. Deliberately the full object, not a partial pin. */
const OKR_FILTERS_STORAGE_KEY = "beakon:okrFilters";

/** Merge whatever's in localStorage over EMPTY_OKR_FILTERS defaults —
 * defensive the same way normalizeFilters() is for Roadmap.filters: a
 * stale/malformed stored shape (e.g. from an older filter shape) should
 * degrade to sane defaults, not crash on read. */
function loadStoredOkrFilters(): OkrFilters {
  if (typeof window === "undefined") return EMPTY_OKR_FILTERS;
  try {
    const raw = window.localStorage.getItem(OKR_FILTERS_STORAGE_KEY);
    if (!raw) return EMPTY_OKR_FILTERS;
    const parsed = JSON.parse(raw) as Partial<OkrFilters>;
    return { ...EMPTY_OKR_FILTERS, ...parsed };
  } catch {
    return EMPTY_OKR_FILTERS;
  }
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
  // teams/businessUnits/strategicObjectives moved to useRoadmap()'s eager
  // fetch in Sprint Heron Week 1 (ADR 007 decision 3) — this page reads
  // them from there instead of useOkrWorkspace, which stays OKR-write-only.
  const { teams, businessUnits, strategicObjectives, activeOkrViewId, getOkrView } = useRoadmap();
  const {
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

  // Initialize from localStorage (lazy initializer — runs once, avoids a
  // render with defaults immediately followed by a render with the stored
  // value). Persisted on every change below.
  const [filters, setFilters] = useState<OkrFilters>(loadStoredOkrFilters);
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState<Okr | null>(null);

  // Mirrors `activeOkrViewId` for the localStorage-write effect below to
  // read without depending on it directly (Sprint Heron Week 3 fix — see
  // that effect's own comment for why `[filters, activeOkrViewId]` as a
  // combined dep array is the wrong shape here: on the exact render where
  // `activeOkrViewId` flips to `null`, `filters` hasn't been reset yet,
  // so a write effect keyed to *both* would fire once with the still-dirty
  // value before the reset effect below catches up).
  const activeOkrViewIdRef = useRef<string | null>(activeOkrViewId);
  useEffect(() => {
    activeOkrViewIdRef.current = activeOkrViewId;
  }, [activeOkrViewId]);

  useEffect(() => {
    // Only remember plain-browsing filters (Sprint Heron Week 3 fix): while
    // an OkrView is loaded, `filters` reflects that view's own (possibly
    // dirty, uncommitted) state, not the user's general "plain /okrs"
    // default — writing it here regardless would let a mid-edit tweak on a
    // loaded view silently redefine what plain browsing resets to the next
    // time the view is cleared, contradicting explicit-save's promise that
    // an unsaved edit doesn't persist anywhere until a deliberate action.
    // Deliberately keyed to `[filters]` only (not `activeOkrViewId` too) —
    // see `activeOkrViewIdRef`'s own comment above.
    if (activeOkrViewIdRef.current !== null) return;
    try {
      window.localStorage.setItem(OKR_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // localStorage can throw (private mode, quota) — filters still work
      // for this session, just won't survive a reload. Not worth surfacing
      // as an app-level error for a papercut-fix feature.
    }
  }, [filters]);

  // Sticky identity, non-sticky content (Sprint Heron Week 3, ADR 009):
  // loading/clearing an OkrView copies its filters into this page's own
  // live `filters` state *once*, on the transition — it does not keep them
  // in lockstep afterward (that's the whole point of explicit-save; further
  // edits are compared against, not written back to, the view). Guarded by
  // a ref (not just an `[activeOkrViewId]` dep) so mount with the default
  // `activeOkrViewId === null` doesn't redundantly re-run
  // `loadStoredOkrFilters()` over the just-initialized state. Genuinely
  // syncing from an external system (lib/store.tsx's `activeOkrViewId`, set
  // by sidebar row clicks outside this component), not derivable state, so
  // the setState-in-effect rule is suppressed here the same way the
  // `?new=1` effect below already does.
  const previousOkrViewId = useRef<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (previousOkrViewId.current === activeOkrViewId) return;
    previousOkrViewId.current = activeOkrViewId;
    if (activeOkrViewId === null) {
      setFilters(loadStoredOkrFilters());
      return;
    }
    const view = getOkrView(activeOkrViewId);
    // Defensive on this read side too (QA-REPORT-HERON-W3.md finding #4) —
    // not just belt-and-suspenders for `rowToOkrView`'s own normalization:
    // a view already sitting in this in-memory `okrViews` array from before
    // that mapper-layer fix landed (or any other path that reaches this
    // effect without going through `rowToOkrView`) could still carry a
    // malformed/partial `filters` blob.
    if (view) setFilters(normalizeOkrFilters(view.filters));
  }, [activeOkrViewId, getOkrView]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
