"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BUSINESS_UNITS,
  INITIATIVES,
  OKR_VIEWS,
  OWNERS,
  ROADMAPS,
  STRATEGIC_OBJECTIVES,
  TEAMS_TABLE,
  THEMES,
} from "./seed";
import { EMPTY_FILTERS, normalizeFilters, type Filters } from "./filters";
import type { OkrFilters } from "./okrFilters";
import { ZOOM_SCALE_MAX, ZOOM_SCALE_MIN } from "./types";
import type {
  BusinessUnit,
  Density,
  GroupBy,
  Initiative,
  OkrView,
  OkrViewVisibility,
  Owner,
  Roadmap,
  RoadmapVisibility,
  Status,
  StrategicObjective,
  Team,
  Theme,
  TimelineSort,
  ViewKey,
  Zoom,
} from "./types";
import { todayISO } from "./dates";
import { isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import {
  createTheme,
  deleteOkrView as deleteOkrViewRow,
  deleteRoadmap as deleteRoadmapRow,
  fetchWorkspace,
  persistArchive,
  persistInitiative,
  persistMove,
  persistOkrView,
  persistOwner,
  persistRoadmap,
  persistSchedule,
  persistUnarchive,
} from "./data";

/** The one always-present, non-deletable Roadmap row (see ADR 008 decision 2). */
const GENERAL_ROADMAP_ID = "roadmap-general";

/**
 * Gates the `beforeunload` "unsaved changes" browser prompt for a dirty
 * Roadmap (Sprint Heron Week 3, ADR 010 §5.4 / plan open question 2,
 * resolved by the PM: build it, ship disabled). The handler, the dirty-
 * check it reads (`roadmapDirty` below), and the listener/cleanup are all
 * live — flipping this to `true` is the entire re-enable path, no further
 * build work. Must be `false` when this ships.
 */
export const ROADMAP_WARN_ON_UNLOAD = false;

/** An ephemeral, auto-dismissing notification (success confirmations, Undo). */
export interface Toast {
  id: string;
  message: string;
  tone?: "default" | "success" | "error";
  /** Optional action button, e.g. Undo an archive or View a new initiative. */
  action?: { label: string; onClick: () => void };
}

/** Seed the in-memory store with stable positions (demo/local mode only). */
function seededInitiatives(): Initiative[] {
  return INITIATIVES.map((i, idx) => ({ ...i, position: (idx + 1) * 1000 }));
}

/** Midpoint between two neighbours' positions (fractional insert, no rewrites). */
function between(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return (right as number) - 1000;
  if (right === null) return left + 1000;
  return (left + right) / 2;
}

// ── Authorization guards (pure, exported for unit tests — plan §7.5) ───────
// Mirrors persist_roadmap()'s / persist_okr_view()'s own RPC authorization
// shape: the owner always wins; a Shared+editable non-owner may write the
// "view-shaping" fields the RPC actually lets them touch (Roadmap: filters/
// groupBy/viewMode/timelineSort/zoom/zoomScale/density; OkrView: filters/
// name) but never rename-adjacent/sharing/delete fields — those stay
// owner-only even when `editable` is true, regardless of what a client sends
// (both RPCs silently pin owner_id/visibility/editable/position to their
// current DB values for a non-owner caller). `canPersistRoadmap`/
// `canPersistOkrView` cover the first group; `isRoadmapOwner`/
// `isOkrViewOwner` cover the second — see QA-REPORT-HERON-W2-T47.md finding
// #1, which is what these owner-only guards close for Roadmap (and avoid
// reproducing for OkrView from day one, per plan §3.1).

/** True when `currentOwner` may write Roadmap's filters/groupBy/viewMode/
 * timelineSort/zoom/zoomScale/density — owner, or Shared+editable. Never
 * true for the System Roadmap (ADR 008 decision 2). */
export function canPersistRoadmap(target: Roadmap, currentOwner: Owner | undefined): boolean {
  if (target.isSystem) return false;
  // An `undefined` currentOwner never matches, regardless of `target.ownerId`
  // (Sprint Heron Week 3c, QA-REPORT-HERON-W3.md finding #6). Previously
  // `target.ownerId === (currentOwner?.id ?? null)` let an `ownerId: null`
  // Roadmap (a caller with no matched `owners` row created one, pre-#79's
  // guard) collapse-match an `undefined` currentOwner — both sides read as
  // `null` — which is exactly what rendered a dead-end "Update Roadmap" for
  // that caller: every write it triggers is rejected server-side.
  const isOwner = currentOwner !== undefined && target.ownerId === currentOwner.id;
  return isOwner || (target.visibility === "shared" && target.editable);
}

/** Owner-only — rename/visibility/delete are never delegable to a
 * Shared+editable participant (persist_roadmap()'s own doc comment; the
 * System row has no owner at all, so it's never true either). Requires
 * `currentOwner !== undefined`, same shape as `canPersistRoadmap` above —
 * this guard had the same `ownerId: null` collapse-match bug until
 * QA-REPORT-HERON-W3C.md finding N2 (a second QA pass caught that #6 only
 * tightened `canPersistRoadmap` and missed this sibling, even though it
 * gates the exact rename/visibility/delete/share affordances #6 was about). */
export function isRoadmapOwner(target: Roadmap, currentOwner: Owner | undefined): boolean {
  return !target.isSystem && currentOwner !== undefined && target.ownerId === currentOwner.id;
}

/** True when `currentOwner` may write an OkrView's `filters`/`name` — owner,
 * or Shared+editable (persist_okr_view()'s own doc comment). */
export function canPersistOkrView(target: OkrView, currentOwner: Owner | undefined): boolean {
  const isOwner = target.ownerId === (currentOwner?.id ?? null);
  return isOwner || (target.visibility === "shared" && target.editable);
}

/** Owner-only — visibility/delete are never delegable to a Shared+editable
 * participant (persist_okr_view()'s own doc comment). Unlike
 * `isRoadmapOwner`, this is NOT given the `currentOwner !== undefined`
 * tightening — `okr_views.owner_id` is `not null` by schema, so an
 * `ownerId: null` + `currentOwner: undefined` collapse-match can never
 * happen here. Don't "fix" this for symmetry alone. */
export function isOkrViewOwner(target: OkrView, currentOwner: Owner | undefined): boolean {
  return target.ownerId === (currentOwner?.id ?? null);
}

// ── Dirty-check comparisons (pure, exported for unit tests — plan §7.5) ─────
// Structural compares over a small, bounded field set — deliberately not a
// generic deep-equal utility (ADR 010 / plan §5.2, §3.1).

/** Order-independent compare for a multi-select filter array (e.g. `owners`,
 * `statuses`) — two selections with the same members in a different order
 * (an artifact of click order, not a real edit) should read as equal. */
function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((v, i) => v === bs[i]);
}

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.search === b.search &&
    a.showDone === b.showDone &&
    a.ownersMode === b.ownersMode &&
    a.teamsMode === b.teamsMode &&
    a.themesMode === b.themesMode &&
    a.statusesMode === b.statusesMode &&
    a.visibilityMode === b.visibilityMode &&
    sameStringSet(a.owners, b.owners) &&
    sameStringSet(a.teams, b.teams) &&
    sameStringSet(a.themes, b.themes) &&
    sameStringSet(a.statuses, b.statuses) &&
    sameStringSet(a.visibility, b.visibility)
  );
}

/**
 * Structural compare, Roadmap's three remaining definitional fields
 * (originally ADR 010's four; `viewMode` moved to the personal-rendering-
 * preference/autosave bucket alongside zoom/zoomScale/density — see the
 * viewMode-autosave `useEffect` below): live in-memory values vs. the active
 * Roadmap's own persisted row. `filters` is normalized on both sides first
 * (mirrors how it's loaded/applied elsewhere) so a malformed/legacy stored
 * shape doesn't read as spuriously "dirty."
 */
export function roadmapFieldsEqual(
  live: { filters: Filters; groupBy: GroupBy; timelineSort: TimelineSort },
  target: Roadmap
): boolean {
  if (live.groupBy !== target.groupBy) return false;
  const targetSort = target.timelineSort ?? { key: "start", dir: 1 };
  if (live.timelineSort.key !== targetSort.key || live.timelineSort.dir !== targetSort.dir) {
    return false;
  }
  return filtersEqual(normalizeFilters(live.filters), normalizeFilters(target.filters));
}

/** Order-insensitive array equality for OkrFilters' five multi-select fields (below). */
function sameValues<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const bSorted = [...b].sort();
  return [...a].sort().every((v, i) => v === bSorted[i]);
}

/**
 * Structural compare, OkrView's filter fields (ADR 009). These became arrays
 * (docs/plans/okr-filters-archive-parity-and-delayed-health.md T8 —
 * multi-select), so this is no longer a plain primitive compare; order
 * shouldn't matter for "is this the same filter set" (a MultiSelect's
 * internal selection order is an implementation detail, not a meaningful
 * difference), hence `sameValues` rather than `===`/array-identity.
 * `governanceStatuses` was dropped entirely as a filter dimension (PM
 * request, docs/plans/qa-followup-f1-f2-fp1.md "FP1") — no longer compared.
 */
export function okrFiltersEqual(a: OkrFilters, b: OkrFilters): boolean {
  return (
    sameValues(a.quarters, b.quarters) &&
    sameValues(a.teamIds, b.teamIds) &&
    sameValues(a.businessUnitIds, b.businessUnitIds) &&
    sameValues(a.strategicObjectiveIds, b.strategicObjectiveIds)
  );
}

interface RoadmapState {
  initiatives: Initiative[];
  themes: Theme[];
  owners: Owner[];
  /**
   * Moved here from useOkrWorkspace by Sprint Heron Week 1 (ADR 007 decision
   * 3) — Initiative/Owner now depend on `teams` for every list/filter/
   * settings render, so these three reference tables must be eagerly
   * available wherever Initiative/Owner are, not lazily on `/okrs` only.
   */
  teams: Team[];
  businessUnits: BusinessUnit[];
  strategicObjectives: StrategicObjective[];

  /**
   * Every Roadmap the current user can see (the System row, their own, and
   * any shared with them) — Sprint Heron Week 2. Small, always-needed
   * metadata, eagerly loaded alongside teams/businessUnits/objectives.
   */
  roadmaps: Roadmap[];
  /** Which Roadmap is currently active; defaults to the System row. */
  activeRoadmapId: string;
  /** The active Roadmap object, derived from `roadmaps`/`activeRoadmapId`. */
  activeRoadmap: Roadmap;
  /**
   * Switch the active Roadmap: loads its filters/groupBy/viewMode/zoom/
   * zoomScale/density/timelineSort into this provider's live state (the same
   * "apply a saved config via existing setters" mechanism used everywhere
   * else in this provider). Does not itself guard against discarding a
   * dirty outgoing Roadmap — callers that can swap `activeRoadmapId` while
   * the outgoing Roadmap may be dirty (sidebar row clicks) are responsible
   * for checking `roadmapDirty`/`canPersistRoadmap` first and offering the
   * discard-confirmation dialog (plan §5.4, `RoadmapNav.tsx`).
   */
  setActiveRoadmap: (id: string) => void;
  /** Switch the *live* view mode only (List/Board/Timeline) — a personal
   * rendering preference (like zoom/zoomScale/density), not one of the
   * definitional fields; autosaves silently via the zoom/density effect
   * below rather than requiring an explicit `updateRoadmap()`/
   * `saveRoadmapAsNew()` save. */
  setRoadmapViewMode: (mode: ViewKey) => void;
  /** Create a new, owned Roadmap; makes it active. */
  createRoadmap: (name: string) => void;
  renameRoadmap: (id: string, name: string) => void;
  setRoadmapVisibility: (
    id: string,
    v: { visibility: RoadmapVisibility; editable: boolean }
  ) => void;
  /** Delete a user-created Roadmap. Falls back to the System Roadmap if it was active. */
  deleteRoadmap: (id: string) => void;
  getRoadmap: (id: string) => Roadmap | undefined;
  /**
   * True when the live filters/groupBy/timelineSort differ from
   * the active Roadmap's own persisted row (ADR 010; `viewMode` no longer
   * part of this compare — it autosaves like zoom/zoomScale/density) —
   * drives FilterBar's three-state save cluster and the discard-confirmation
   * dialog. Always `false` for the System Roadmap's own fields in practice
   * (nothing ever persists them, so nothing to be "dirty" against in a way
   * that matters, though the raw compare still runs the same way).
   */
  roadmapDirty: boolean;
  /** Whether the signed-in caller may persist to `target` — owner, or
   * Shared+editable. Never true for the System Roadmap. */
  canPersistRoadmap: (target: Roadmap) => boolean;
  /** Persist the active Roadmap's live filters/groupBy/timelineSort
   * onto its own row — the explicit "Update Roadmap" action (ADR 010).
   * `viewMode` is included in the payload too (harmless — it's the same live
   * value the autosave effect would also write) but isn't part of what makes
   * this a no-op-vs-needed decision. No-op if the caller can't persist to the
   * active Roadmap. */
  updateRoadmap: () => void;
  /** Create a new, owned Roadmap seeded from the *live* filters/groupBy/
   * timelineSort (not fresh defaults) — the explicit "Save as new
   * Roadmap…" action (ADR 010). `viewMode` is carried over too, same
   * harmless-inclusion note as `updateRoadmap`. Makes the new Roadmap
   * active. */
  saveRoadmapAsNew: (name: string) => void;

  /**
   * Saved/shareable "My OKRs" filter views (Sprint Heron Week 3, ADR 009).
   * Explicit-save, sticky-identity/non-sticky-content model (plan §3.1):
   * `activeOkrViewId` tracks *which* view is loaded; it does not auto-write
   * back live filter edits.
   */
  okrViews: OkrView[];
  /** Which OkrView (if any) is currently "loaded" on `/okrs`; `null` = plain browsing. */
  activeOkrViewId: string | null;
  /** The active OkrView object, or `undefined` if none is loaded. */
  activeOkrView: OkrView | undefined;
  getOkrView: (id: string) => OkrView | undefined;
  /** Sets which OkrView's filters are "loaded" — `null` clears back to plain
   * browsing. Does not itself apply the view's filters into any live state;
   * callers (the `/okrs` page) react to the id change and load
   * `getOkrView(id)?.filters` into their own local filter state. */
  applyOkrView: (id: string | null) => void;
  /** Create a new, owned OkrView from `filters`; makes it active. */
  createOkrView: (name: string, filters: OkrFilters) => void;
  renameOkrView: (id: string, name: string) => void;
  setOkrViewVisibility: (
    id: string,
    v: { visibility: OkrViewVisibility; editable: boolean }
  ) => void;
  /** Persist `filters` onto the active OkrView's row — the explicit "Update
   * '<name>'" action. No-op if there's no active view or the caller can't
   * persist to it. */
  updateOkrView: (filters: OkrFilters) => void;
  deleteOkrView: (id: string) => void;
  /** Whether the signed-in caller may persist filters/name to `target` —
   * owner, or Shared+editable. */
  canPersistOkrView: (target: OkrView) => boolean;

  /** True while the initial Supabase load is in flight. */
  loading: boolean;
  /** Last sync error (a failed persist or load), or null. */
  error: string | null;
  dismissError: () => void;

  /** Ephemeral success/undo notifications. */
  toasts: Toast[];
  notify: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;

  /** The owner row matching the signed-in user's email, if any. */
  currentOwner: Owner | undefined;

  filters: Filters;
  groupBy: GroupBy;
  /** Live view mode (List/Board/Timeline) — see `setRoadmapViewMode` above. */
  viewMode: ViewKey;
  zoom: Zoom;
  /** Continuous zoom multiplier on top of `zoom` (clamped to ZOOM_SCALE_MIN..MAX). */
  zoomScale: number;
  /** Timeline row density. */
  density: Density;
  /** How timeline rows are ordered within each group. */
  timelineSort: TimelineSort;
  presentation: boolean;
  selectedId: string | null;
  editorDraft: Initiative | null;

  setFilters: (f: Filters) => void;
  patchFilters: (p: Partial<Filters>) => void;
  resetFilters: () => void;
  setGroupBy: (g: GroupBy) => void;
  setZoom: (z: Zoom) => void;
  /** Set the continuous zoom multiplier; clamped to the allowed range. */
  setZoomScale: (n: number) => void;
  setDensity: (d: Density) => void;
  setTimelineSort: (s: TimelineSort) => void;
  setPresentation: (v: boolean) => void;

  select: (id: string | null) => void;
  saveInitiative: (i: Initiative) => void;
  /** Timeline drag: reschedule dates only (targeted persist, no link sync). */
  rescheduleInitiative: (id: string, targetStart: string, targetEnd: string) => void;
  /** Create a new theme (persists + adds to state). */
  addTheme: (t: Theme) => void;
  /** Update the signed-in user's profile (name / surname / team / role). */
  saveProfile: (patch: { name: string; surname: string; teamId: string; role: string }) => void;
  /** Board drag: set status and place before `beforeId` (null = end of target column). */
  moveInitiative: (id: string, toStatus: Status, beforeId: string | null) => void;
  archiveInitiative: (id: string) => void;
  /** Restore an archived initiative (the Undo of archiveInitiative). */
  unarchiveInitiative: (id: string) => void;
  newDraft: () => Initiative;
  openCreate: () => void;
  closeEditor: () => void;

  getOwner: (id: string) => Owner | undefined;
  getTheme: (id: string) => Theme | undefined;
  getInitiative: (id: string) => Initiative | undefined;
  getTeam: (id: string) => Team | undefined;
  getStrategicObjective: (id: string) => StrategicObjective | undefined;
}

const Ctx = createContext<RoadmapState | null>(null);

export function RoadmapProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  // Local/demo mode (no Supabase env) runs on seed data immediately. With
  // Supabase configured, we start empty and load once a session is present.
  const [initiatives, setInitiatives] = useState<Initiative[]>(() =>
    isSupabaseConfigured ? [] : seededInitiatives()
  );
  const [themes, setThemes] = useState<Theme[]>(() => (isSupabaseConfigured ? [] : THEMES));
  const [owners, setOwners] = useState<Owner[]>(() => (isSupabaseConfigured ? [] : OWNERS));
  const [teams, setTeams] = useState<Team[]>(() => (isSupabaseConfigured ? [] : TEAMS_TABLE));
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(() =>
    isSupabaseConfigured ? [] : BUSINESS_UNITS
  );
  const [strategicObjectives, setStrategicObjectives] = useState<StrategicObjective[]>(() =>
    isSupabaseConfigured ? [] : STRATEGIC_OBJECTIVES
  );
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>(() => (isSupabaseConfigured ? [] : ROADMAPS));
  const [okrViews, setOkrViews] = useState<OkrView[]>(() => (isSupabaseConfigured ? [] : OKR_VIEWS));
  const [activeRoadmapId, setActiveRoadmapId] = useState<string>(GENERAL_ROADMAP_ID);
  const [activeOkrViewId, setActiveOkrViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // filters/groupBy/viewMode/zoom/zoomScale/density/timelineSort are the
  // *live* in-memory state of whichever Roadmap is active (Sprint Heron Week
  // 2) — switching `activeRoadmapId` loads that Roadmap's saved fields into
  // these via the same setters below. Per ADR 010 (Sprint Heron Week 3):
  // filters/groupBy/timelineSort are explicit-save (local-only until
  // `updateRoadmap()`/`saveRoadmapAsNew()` commits them); `viewMode` was
  // originally in that group too but has since moved to the
  // personal-rendering-preference bucket alongside zoom/zoomScale/density —
  // all four of those now autosave, unconditionally, below. Initial values
  // intentionally match the seeded System Roadmap's own defaults, so the
  // very first render needs no separate "load" step.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("theme");
  const [viewMode, setViewModeRaw] = useState<ViewKey>("board");
  const [zoom, setZoom] = useState<Zoom>("month");
  const [zoomScale, setZoomScaleRaw] = useState(1);
  const [density, setDensity] = useState<Density>("comfortable");
  const [timelineSort, setTimelineSort] = useState<TimelineSort>({ key: "start", dir: 1 });
  const [presentation, setPresentation] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<Initiative | null>(null);

  // Load from Supabase whenever the signed-in user changes. The workspace is
  // gated behind auth and the dataset is shared across all users, so we don't
  // clear on sign-out — the next sign-in refetches and replaces it.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    let active = true;
    fetchWorkspace()
      .then((w) => {
        if (!active) return;
        setError(null);
        setInitiatives(w.initiatives);
        setThemes(w.themes);
        setOwners(w.owners);
        setTeams(w.teams);
        setBusinessUnits(w.businessUnits);
        setStrategicObjectives(w.strategicObjectives);
        setRoadmaps(w.roadmaps);
        setOkrViews(w.okrViews);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load workspace.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const patchFilters = useCallback(
    (p: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...p })),
    []
  );
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);
  const setZoomScale = useCallback(
    (n: number) => setZoomScaleRaw(Math.min(ZOOM_SCALE_MAX, Math.max(ZOOM_SCALE_MIN, n))),
    []
  );
  const dismissError = useCallback(() => setError(null), []);

  // Cap the visible stack so a burst of actions can't bury the screen.
  const notify = useCallback((t: Omit<Toast, "id">) => {
    const id = `t-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...t, id }].slice(-3));
  }, []);
  const dismissToast = useCallback(
    (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id)),
    []
  );

  const reportError = useCallback((e: unknown, action: string) => {
    console.error(`[beakon] ${action} failed`, e);
    setError(
      e instanceof Error ? e.message : `Could not ${action}. Your change may not be saved.`
    );
  }, []);

  // Match the signed-in user to a seeded owner row by email — lets the app
  // "know who you are" and default new initiatives/Roadmaps to you as
  // owner. In local/demo mode (no auth) the first owner stands in as "you".
  // Computed here (moved up from its original spot further below) since
  // createRoadmap needs it as `ownerId` for the Roadmap it creates.
  const currentOwner = useMemo<Owner | undefined>(() => {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return isSupabaseConfigured ? undefined : owners[0];
    return owners.find((o) => o.email?.toLowerCase() === email);
  }, [owners, session]);

  // Ref mirror of `roadmaps`, read inside callbacks (createRoadmap's
  // position calc, deleteRoadmap's post-delete fallback) that shouldn't
  // themselves depend on — and re-create every time — the roadmaps array.
  const roadmapsRef = useRef<Roadmap[]>(roadmaps);
  useEffect(() => {
    roadmapsRef.current = roadmaps;
  }, [roadmaps]);

  // Same pattern for `okrViews` — createOkrView's position calc reads the
  // latest list without needing to depend on (and re-create on every
  // change of) the array itself.
  const okrViewsRef = useRef<OkrView[]>(okrViews);
  useEffect(() => {
    okrViewsRef.current = okrViews;
  }, [okrViews]);

  // ── Roadmaps (Sprint Heron Week 2) ──────────────────────────────────────
  const getRoadmap = useCallback((id: string) => roadmaps.find((r) => r.id === id), [roadmaps]);

  const activeRoadmap = useMemo<Roadmap>(() => {
    return (
      getRoadmap(activeRoadmapId) ??
      roadmaps.find((r) => r.isSystem) ?? {
        // Defensive fallback so a not-yet-loaded/deleted-out-from-under-us
        // activeRoadmapId never leaves `activeRoadmap` undefined — mirrors
        // this Roadmap's own seeded shape (lib/seed.ts's ROADMAPS[0]).
        id: GENERAL_ROADMAP_ID,
        ownerId: null,
        name: "General Roadmap",
        viewMode: "board",
        filters: {},
        groupBy: "theme",
        zoom: "month",
        zoomScale: 1,
        density: "comfortable",
        timelineSort: null,
        visibility: "private",
        editable: false,
        isSystem: true,
        position: 0,
      }
    );
  }, [roadmaps, activeRoadmapId, getRoadmap]);

  // True when the live definitional fields (filters/groupBy/timelineSort;
  // `viewMode` no longer counted here — see the autosave effect below)
  // diverge from the active Roadmap's own persisted row (ADR 010) — drives
  // FilterBar's three-state save cluster and the discard-confirmation
  // dialog (RoadmapNav.tsx).
  const roadmapDirty = useMemo(
    () => !roadmapFieldsEqual({ filters, groupBy, timelineSort }, activeRoadmap),
    [filters, groupBy, timelineSort, activeRoadmap]
  );

  // Load a Roadmap's saved fields into this provider's live state — the
  // mechanism `activeRoadmapId` switches drive.
  const applyRoadmapState = useCallback((r: Roadmap) => {
    setFilters(normalizeFilters(r.filters));
    setGroupBy(r.groupBy);
    setViewModeRaw(r.viewMode);
    setZoom(r.zoom);
    setZoomScaleRaw(r.zoomScale);
    setDensity(r.density);
    setTimelineSort(r.timelineSort ?? { key: "start", dir: 1 });
  }, []);

  // Plain, immediate switch — no discard-confirmation of its own (ADR 010 /
  // plan §5.4): callers that can swap `activeRoadmapId` while the outgoing
  // Roadmap may be dirty (sidebar row clicks, RoadmapNav.tsx) check
  // `roadmapDirty`/`canPersistRoadmap` themselves first and offer the
  // discard-confirmation dialog before calling this.
  const setActiveRoadmap = useCallback(
    (id: string) => {
      const target = getRoadmap(id);
      setActiveRoadmapId(id);
      if (target) applyRoadmapState(target);
    },
    [getRoadmap, applyRoadmapState]
  );

  // Sets the *live* view mode only — a personal rendering preference (like
  // zoom/zoomScale/density), not one of the definitional fields. This no
  // longer touches `roadmaps` state or calls `persistRoadmap()` directly;
  // the autosave effect below (which now includes `viewMode`) reacts to the
  // live state change and persists it silently, same as zoom/density.
  const setRoadmapViewMode = useCallback((mode: ViewKey) => {
    setViewModeRaw(mode);
  }, []);

  // Narrowed autosave (originally ADR 010's zoom/zoomScale/density-only
  // effect; `viewMode` was moved in here from the definitional-field/
  // explicit-save group, since it's really the same kind of "personal
  // rendering preference" as the other three): these four persist on
  // change, unconditionally, as personal rendering prefs — no timer/skip-ref
  // dance needed (unlike the old six-field debounce this replaces), since
  // there's nothing time-sensitive to lose on a Roadmap switch once the
  // remaining definitional fields (filters/groupBy/timelineSort) aren't part
  // of this effect: switching just reads the new Roadmap's own fresh zoom/
  // zoomScale/density/viewMode via `applyRoadmapState`, and the equality
  // guard below means re-applying a Roadmap's own values back onto itself is
  // a no-op, not a redundant write. Known, accepted consequence (same as
  // zoom/density already had): `viewMode` lives on the Roadmap *row*, not
  // per-viewer, so on a Shared+editable Roadmap one editor's view-mode
  // switch autosaves onto the shared row and becomes the next viewer's
  // landing view too — not a new risk, the same tradeoff ADR 010 already
  // accepted for zoom. This effect genuinely syncs local rendering-pref
  // state out to `roadmaps` state + Supabase (an external system), not
  // derivable render state, so the setState-in-effect rule is suppressed
  // here the same way app/(workspace)/okrs/page.tsx's own external-sync
  // effects do.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setRoadmaps((prev) => {
      const target = prev.find((r) => r.id === activeRoadmapId);
      if (!target) return prev;
      if (
        target.zoom === zoom &&
        target.zoomScale === zoomScale &&
        target.density === density &&
        target.viewMode === viewMode
      ) {
        return prev;
      }
      if (!canPersistRoadmap(target, currentOwner)) return prev;
      const updated: Roadmap = { ...target, zoom, zoomScale, density, viewMode };
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistRoadmap(updated).catch((e) => reportError(e, "save view")));
      }
      return prev.map((r) => (r.id === target.id ? updated : r));
    });
  }, [activeRoadmapId, zoom, zoomScale, density, viewMode, currentOwner, reportError]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Gated behind ROADMAP_WARN_ON_UNLOAD (default false, see its own doc
  // comment above) — fires the native browser "unsaved changes" prompt only
  // while a definitional field is genuinely dirty *and* this caller could
  // actually do something about it. The `canPersistRoadmap` check (added
  // Sprint Heron Week 3c, QA-REPORT-HERON-W3.md finding #5) matches §5.4's
  // own "never triggers for a caller who can't persist" principle for the
  // in-app discard dialog — without it, the System Roadmap (every user's
  // default landing spot) and a Shared+View-only visitor could both be
  // "dirty" with no save affordance at all, and this would be the only
  // warning, about something the user has no way to act on.
  useEffect(() => {
    if (!ROADMAP_WARN_ON_UNLOAD || !roadmapDirty || !canPersistRoadmap(activeRoadmap, currentOwner)) {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [roadmapDirty, activeRoadmap, currentOwner]);

  const createRoadmap = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const ownerId = currentOwner?.id ?? null;
      // No matched `owners` row to attribute this Roadmap to — mirrors
      // createOkrView's existing guard (Sprint Heron Week 3c,
      // QA-REPORT-HERON-W3.md finding #6). Without this, an `ownerId: null`
      // Roadmap gets created that (pre-#79's canPersistRoadmap tightening
      // too) rendered a dead-end "Update Roadmap" cluster for a caller whose
      // every server write is rejected.
      if (!ownerId) return;
      const myPositions = roadmapsRef.current
        .filter((r) => !r.isSystem && r.ownerId === ownerId)
        .map((r) => r.position ?? 0);
      const next: Roadmap = {
        id: `roadmap-${Math.random().toString(36).slice(2, 9)}`,
        ownerId,
        name: trimmed,
        viewMode: "board",
        filters: {},
        groupBy: "theme",
        zoom: "month",
        zoomScale: 1,
        density: "comfortable",
        timelineSort: null,
        visibility: "private",
        editable: false,
        isSystem: false,
        // Most-recently-created-first among "My roadmaps" (Direction 2's
        // sidebar ordering) — one step below the lowest existing position.
        position: myPositions.length ? Math.min(...myPositions) - 1 : 0,
      };
      setRoadmaps((prev) => [...prev, next]);
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistRoadmap(next).catch((e) => reportError(e, "create roadmap")));
      }
      // Apply `next`'s (default) fields directly rather than routing through
      // setActiveRoadmap(next.id): that helper looks the target up inside
      // `roadmaps` state, which hasn't re-rendered with `next` yet at this
      // point (setRoadmaps above is async) — looking it up here would find
      // nothing and silently skip loading the new Roadmap's fields, leaving
      // whatever filters were live on the *previous* Roadmap to leak onto
      // this brand-new one.
      setActiveRoadmapId(next.id);
      applyRoadmapState(next);
    },
    [reportError, applyRoadmapState, currentOwner]
  );

  // Persist the active Roadmap's live filters/groupBy/timelineSort onto its
  // own row — "Update Roadmap" (ADR 010). `viewMode` is included in the
  // payload too (harmless — it's the same live value the autosave effect
  // would also write) but, like zoom/zoomScale/density, isn't touched here
  // as a *dirty-tracked* field; it already autosaves on its own.
  const updateRoadmap = useCallback(() => {
    setRoadmaps((prev) => {
      const target = prev.find((r) => r.id === activeRoadmapId);
      if (!target || !canPersistRoadmap(target, currentOwner)) return prev;
      const updated: Roadmap = {
        ...target,
        filters: filters as unknown as Record<string, unknown>,
        groupBy,
        viewMode,
        timelineSort,
      };
      if (isSupabaseConfigured) {
        queueMicrotask(() =>
          persistRoadmap(updated).catch((e) => reportError(e, "update roadmap"))
        );
      }
      return prev.map((r) => (r.id === target.id ? updated : r));
    });
  }, [activeRoadmapId, filters, groupBy, viewMode, timelineSort, currentOwner, reportError]);

  // Create a new, owned Roadmap seeded from the *live* filters/groupBy/
  // timelineSort/viewMode values — "Save as new Roadmap…" (ADR 010). Mirrors
  // createRoadmap, but zoom/zoomScale/density still start at fresh defaults
  // (personal rendering prefs, not part of what's being "saved as new"
  // here) — `viewMode` carries over from live state anyway since it's the
  // same value the autosave effect would write moments later.
  const saveRoadmapAsNew = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const ownerId = currentOwner?.id ?? null;
      // Same guard as createRoadmap above (finding #6) — no matched owner,
      // no Roadmap.
      if (!ownerId) return;
      const myPositions = roadmapsRef.current
        .filter((r) => !r.isSystem && r.ownerId === ownerId)
        .map((r) => r.position ?? 0);
      const next: Roadmap = {
        id: `roadmap-${Math.random().toString(36).slice(2, 9)}`,
        ownerId,
        name: trimmed,
        viewMode,
        filters: filters as unknown as Record<string, unknown>,
        groupBy,
        zoom: "month",
        zoomScale: 1,
        density: "comfortable",
        timelineSort,
        visibility: "private",
        editable: false,
        isSystem: false,
        position: myPositions.length ? Math.min(...myPositions) - 1 : 0,
      };
      setRoadmaps((prev) => [...prev, next]);
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistRoadmap(next).catch((e) => reportError(e, "create roadmap")));
      }
      setActiveRoadmapId(next.id);
      applyRoadmapState(next);
    },
    [currentOwner, filters, groupBy, viewMode, timelineSort, applyRoadmapState, reportError]
  );

  const renameRoadmap = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === id);
        // Owner-only (QA-REPORT-HERON-W2-T47.md finding #1) — not
        // `canPersistRoadmap`, since a Shared+editable non-owner may write
        // filters/groupBy/etc. but never rename (persist_roadmap()'s own
        // doc comment pins `name` to its current DB value for that caller).
        if (!target || !isRoadmapOwner(target, currentOwner)) return prev;
        const updated: Roadmap = { ...target, name: trimmed };
        if (isSupabaseConfigured) {
          queueMicrotask(() => persistRoadmap(updated).catch((e) => reportError(e, "rename roadmap")));
        }
        return prev.map((r) => (r.id === id ? updated : r));
      });
    },
    [currentOwner, reportError]
  );

  const setRoadmapVisibility = useCallback(
    (id: string, v: { visibility: RoadmapVisibility; editable: boolean }) => {
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === id);
        // Owner-only (same reasoning as renameRoadmap above) — mirrored
        // defensively so this setter agrees with persist_roadmap()'s own
        // refusal either way.
        if (!target || !isRoadmapOwner(target, currentOwner)) return prev;
        const updated: Roadmap = { ...target, ...v };
        if (isSupabaseConfigured) {
          queueMicrotask(() => persistRoadmap(updated).catch((e) => reportError(e, "update sharing")));
        }
        return prev.map((r) => (r.id === id ? updated : r));
      });
    },
    [currentOwner, reportError]
  );

  const deleteRoadmap = useCallback(
    (id: string) => {
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === id);
        // Owner-only (same reasoning as renameRoadmap above; also matches
        // the `roadmaps` table's plain owner-only DELETE RLS policy).
        if (!target || !isRoadmapOwner(target, currentOwner)) return prev;
        if (isSupabaseConfigured) {
          queueMicrotask(() => deleteRoadmapRow(id).catch((e) => reportError(e, "delete roadmap")));
        }
        return prev.filter((r) => r.id !== id);
      });
      // Never leave the UI pointed at a Roadmap that no longer exists.
      setActiveRoadmapId((cur) => {
        if (cur !== id) return cur;
        const general = roadmapsRef.current.find((r) => r.id === GENERAL_ROADMAP_ID);
        if (general) applyRoadmapState(general);
        return GENERAL_ROADMAP_ID;
      });
    },
    [currentOwner, reportError, applyRoadmapState]
  );

  // ── OkrViews (Sprint Heron Week 3, ADR 009) ─────────────────────────────
  const getOkrView = useCallback(
    (id: string) => okrViews.find((v) => v.id === id),
    [okrViews]
  );

  const activeOkrView = useMemo(
    () => (activeOkrViewId ? getOkrView(activeOkrViewId) : undefined),
    [activeOkrViewId, getOkrView]
  );

  // Sets *which* OkrView is loaded — sticky identity, non-sticky content
  // (design review's "Question 1"): does not itself copy `filters` into any
  // live state, since that state is owned by the `/okrs` page, not this
  // provider. `null` clears back to plain browsing.
  const applyOkrView = useCallback((id: string | null) => {
    setActiveOkrViewId(id);
  }, []);

  const createOkrView = useCallback(
    (name: string, filters: OkrFilters) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const ownerId = currentOwner?.id ?? null;
      if (!ownerId) return; // no signed-in/matched owner to attribute this view to
      const myPositions = okrViewsRef.current
        .filter((v) => v.ownerId === ownerId)
        .map((v) => v.position ?? 0);
      const next: OkrView = {
        id: `okr-view-${Math.random().toString(36).slice(2, 9)}`,
        ownerId,
        name: trimmed,
        filters,
        visibility: "private",
        editable: false,
        position: myPositions.length ? Math.min(...myPositions) - 1 : 0,
      };
      setOkrViews((prev) => [...prev, next]);
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistOkrView(next).catch((e) => reportError(e, "save view")));
      }
      setActiveOkrViewId(next.id);
    },
    [currentOwner, reportError]
  );

  const renameOkrView = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setOkrViews((prev) => {
        const target = prev.find((v) => v.id === id);
        // Owner, or Shared+editable (persist_okr_view()'s doc comment: a
        // shared-editable non-owner may write name/filters).
        if (!target || !canPersistOkrView(target, currentOwner)) return prev;
        const updated: OkrView = { ...target, name: trimmed };
        if (isSupabaseConfigured) {
          queueMicrotask(() => persistOkrView(updated).catch((e) => reportError(e, "rename view")));
        }
        return prev.map((v) => (v.id === id ? updated : v));
      });
    },
    [currentOwner, reportError]
  );

  const setOkrViewVisibility = useCallback(
    (id: string, v: { visibility: OkrViewVisibility; editable: boolean }) => {
      setOkrViews((prev) => {
        const target = prev.find((x) => x.id === id);
        // Owner-only — visibility/editable are never delegable, same
        // reasoning as Roadmap's own sharing setter.
        if (!target || !isOkrViewOwner(target, currentOwner)) return prev;
        const updated: OkrView = { ...target, ...v };
        if (isSupabaseConfigured) {
          queueMicrotask(() =>
            persistOkrView(updated).catch((e) => reportError(e, "update sharing"))
          );
        }
        return prev.map((x) => (x.id === id ? updated : x));
      });
    },
    [currentOwner, reportError]
  );

  const updateOkrView = useCallback(
    (filters: OkrFilters) => {
      setOkrViews((prev) => {
        const target = prev.find((v) => v.id === activeOkrViewId);
        if (!target || !canPersistOkrView(target, currentOwner)) return prev;
        const updated: OkrView = { ...target, filters };
        if (isSupabaseConfigured) {
          queueMicrotask(() => persistOkrView(updated).catch((e) => reportError(e, "update view")));
        }
        return prev.map((v) => (v.id === target.id ? updated : v));
      });
    },
    [activeOkrViewId, currentOwner, reportError]
  );

  const deleteOkrView = useCallback(
    (id: string) => {
      setOkrViews((prev) => {
        const target = prev.find((v) => v.id === id);
        if (!target || !isOkrViewOwner(target, currentOwner)) return prev;
        if (isSupabaseConfigured) {
          queueMicrotask(() => deleteOkrViewRow(id).catch((e) => reportError(e, "delete view")));
        }
        return prev.filter((v) => v.id !== id);
      });
      setActiveOkrViewId((cur) => (cur === id ? null : cur));
    },
    [currentOwner, reportError]
  );

  const saveInitiative = useCallback(
    (i: Initiative) => {
      setInitiatives((prev) => {
        const exists = prev.some((x) => x.id === i.id);
        // New items appear on top (smallest position), matching the old prepend.
        const position = exists
          ? i.position
          : i.position ??
            (prev.length ? Math.min(...prev.map((x) => x.position ?? 0)) - 1000 : 0);
        const stamped: Initiative = {
          ...i,
          position,
          updatedAt: new Date().toISOString(),
        };
        if (isSupabaseConfigured) {
          queueMicrotask(() =>
            persistInitiative(stamped).catch((e) => reportError(e, "save"))
          );
        }
        return exists ? prev.map((x) => (x.id === i.id ? stamped : x)) : [stamped, ...prev];
      });
    },
    [reportError]
  );

  const rescheduleInitiative = useCallback(
    (id: string, targetStart: string, targetEnd: string) => {
      setInitiatives((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, targetStart, targetEnd, updatedAt: new Date().toISOString() }
            : x
        )
      );
      if (isSupabaseConfigured) {
        queueMicrotask(() =>
          persistSchedule(id, targetStart, targetEnd).catch((e) => reportError(e, "save"))
        );
      }
    },
    [reportError]
  );

  const moveInitiative = useCallback(
    (id: string, toStatus: Status, beforeId: string | null) => {
      if (beforeId === id) return; // dropped onto itself — no-op
      setInitiatives((prev) => {
        const dragged = prev.find((x) => x.id === id);
        if (!dragged) return prev;
        const without = prev.filter((x) => x.id !== id);

        let insertAt: number;
        if (beforeId) {
          insertAt = without.findIndex((x) => x.id === beforeId);
          if (insertAt < 0) insertAt = without.length;
        } else {
          // No anchor: append after the last card already in the target column.
          insertAt = without.length;
          for (let k = without.length - 1; k >= 0; k--) {
            if (without[k].status === toStatus) {
              insertAt = k + 1;
              break;
            }
          }
        }

        const leftPos = insertAt > 0 ? without[insertAt - 1].position ?? 0 : null;
        const rightPos = insertAt < without.length ? without[insertAt].position ?? 0 : null;
        const position = between(leftPos, rightPos);
        const statusChanged = dragged.status !== toStatus;

        const moved: Initiative = {
          ...dragged,
          status: toStatus,
          position,
          updatedAt: statusChanged ? new Date().toISOString() : dragged.updatedAt,
        };

        if (isSupabaseConfigured) {
          queueMicrotask(() =>
            persistMove(id, toStatus, position).catch((e) => reportError(e, "move"))
          );
        }

        without.splice(insertAt, 0, moved);
        return without;
      });
    },
    [reportError]
  );

  const addTheme = useCallback(
    (t: Theme) => {
      setThemes((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
      if (isSupabaseConfigured) {
        queueMicrotask(() => createTheme(t).catch((e) => reportError(e, "create theme")));
      }
    },
    [reportError]
  );

  const archiveInitiative = useCallback(
    (id: string) => {
      setInitiatives((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, archived: true, updatedAt: new Date().toISOString() } : x
        )
      );
      setSelectedId((cur) => (cur === id ? null : cur));
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistArchive(id).catch((e) => reportError(e, "archive")));
      }
    },
    [reportError]
  );

  const unarchiveInitiative = useCallback(
    (id: string) => {
      setInitiatives((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, archived: false, updatedAt: new Date().toISOString() } : x
        )
      );
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistUnarchive(id).catch((e) => reportError(e, "restore")));
      }
    },
    [reportError]
  );

  const saveProfile = useCallback(
    (patch: { name: string; surname: string; teamId: string; role: string }) => {
      const email = session?.user?.email ?? undefined;
      // Edit the matched owner row if there is one; otherwise create a profile
      // keyed to the signed-in email so anyone in the domain can identify.
      const base: Owner =
        currentOwner ??
        { id: `u-${Math.random().toString(36).slice(2, 9)}`, name: "", role: "", email };
      const next: Owner = {
        ...base,
        name: patch.name.trim(),
        surname: patch.surname.trim() || undefined,
        role: patch.role.trim(),
        teamId: patch.teamId || undefined,
        email: base.email ?? email,
      };
      setOwners((prev) =>
        prev.some((o) => o.id === next.id)
          ? prev.map((o) => (o.id === next.id ? next : o))
          : [...prev, next]
      );
      if (isSupabaseConfigured) {
        queueMicrotask(() => persistOwner(next).catch((e) => reportError(e, "save profile")));
      }
    },
    [currentOwner, session, reportError]
  );

  const newDraft = useCallback((): Initiative => {
    const start = todayISO();
    return {
      id: `i-${Math.random().toString(36).slice(2, 9)}`,
      title: "",
      summary: "",
      problem: "",
      expectedOutcome: "",
      status: "planned",
      ownerId: currentOwner?.id ?? owners[0]?.id ?? "",
      // Default to the creator's own team so they don't have to switch off a
      // fixed default; falls back to the first real team when it's not set yet.
      teamId: currentOwner?.teamId ?? teams[0]?.id ?? "",
      // Start unthemed rather than silently inheriting the first theme — the
      // creator makes theme an explicit choice (see W4).
      themeId: "",
      // Start with no strategic objective — optional, unlike OKR's required field.
      strategicObjectiveId: null,
      // Start unscored — a made-up default DIVE reads as a real priority nobody set.
      scores: null,
      health: "on_track",
      targetStart: start,
      targetEnd: start,
      deliveryLinks: [],
      dependsOn: [],
      visibility: "internal",
      notes: "",
      updatedAt: new Date().toISOString(),
      archived: false,
    };
  }, [owners, currentOwner, teams]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    // Opening an existing initiative dismisses any in-progress "New" draft.
    setEditorDraft(null);
  }, []);
  const openCreate = useCallback(() => {
    setSelectedId(null);
    setEditorDraft(newDraft());
  }, [newDraft]);
  const closeEditor = useCallback(() => setEditorDraft(null), []);

  const getOwner = useCallback((id: string) => owners.find((o) => o.id === id), [owners]);
  const getTheme = useCallback((id: string) => themes.find((t) => t.id === id), [themes]);
  const getInitiative = useCallback(
    (id: string) => initiatives.find((i) => i.id === id),
    [initiatives]
  );
  const getTeam = useCallback((id: string) => teams.find((t) => t.id === id), [teams]);
  const getStrategicObjective = useCallback(
    (id: string) => strategicObjectives.find((s) => s.id === id),
    [strategicObjectives]
  );

  const value = useMemo<RoadmapState>(
    () => ({
      initiatives,
      themes,
      owners,
      teams,
      businessUnits,
      strategicObjectives,
      roadmaps,
      activeRoadmapId,
      activeRoadmap,
      setActiveRoadmap,
      setRoadmapViewMode,
      createRoadmap,
      renameRoadmap,
      setRoadmapVisibility,
      deleteRoadmap,
      getRoadmap,
      roadmapDirty,
      canPersistRoadmap: (target: Roadmap) => canPersistRoadmap(target, currentOwner),
      updateRoadmap,
      saveRoadmapAsNew,
      okrViews,
      activeOkrViewId,
      activeOkrView,
      getOkrView,
      applyOkrView,
      createOkrView,
      renameOkrView,
      setOkrViewVisibility,
      updateOkrView,
      deleteOkrView,
      canPersistOkrView: (target: OkrView) => canPersistOkrView(target, currentOwner),
      currentOwner,
      loading,
      error,
      dismissError,
      toasts,
      notify,
      dismissToast,
      filters,
      groupBy,
      viewMode,
      zoom,
      zoomScale,
      density,
      timelineSort,
      presentation,
      selectedId,
      editorDraft,
      setFilters,
      patchFilters,
      resetFilters,
      setGroupBy,
      setZoom,
      setZoomScale,
      setDensity,
      setTimelineSort,
      setPresentation,
      select,
      saveInitiative,
      rescheduleInitiative,
      addTheme,
      saveProfile,
      moveInitiative,
      archiveInitiative,
      unarchiveInitiative,
      newDraft,
      openCreate,
      closeEditor,
      getOwner,
      getTheme,
      getInitiative,
      getTeam,
      getStrategicObjective,
    }),
    [
      initiatives,
      themes,
      owners,
      teams,
      businessUnits,
      strategicObjectives,
      roadmaps,
      activeRoadmapId,
      activeRoadmap,
      setActiveRoadmap,
      setRoadmapViewMode,
      createRoadmap,
      renameRoadmap,
      setRoadmapVisibility,
      deleteRoadmap,
      getRoadmap,
      roadmapDirty,
      updateRoadmap,
      saveRoadmapAsNew,
      okrViews,
      activeOkrViewId,
      activeOkrView,
      getOkrView,
      applyOkrView,
      createOkrView,
      renameOkrView,
      setOkrViewVisibility,
      updateOkrView,
      deleteOkrView,
      currentOwner,
      loading,
      error,
      dismissError,
      toasts,
      notify,
      dismissToast,
      filters,
      groupBy,
      viewMode,
      zoom,
      zoomScale,
      density,
      timelineSort,
      presentation,
      selectedId,
      editorDraft,
      patchFilters,
      resetFilters,
      setZoomScale,
      saveInitiative,
      rescheduleInitiative,
      addTheme,
      saveProfile,
      moveInitiative,
      archiveInitiative,
      unarchiveInitiative,
      newDraft,
      openCreate,
      closeEditor,
      select,
      getOwner,
      getTheme,
      getInitiative,
      getTeam,
      getStrategicObjective,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoadmap(): RoadmapState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoadmap must be used within RoadmapProvider");
  return v;
}
