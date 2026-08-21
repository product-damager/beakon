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
  OWNERS,
  ROADMAPS,
  STRATEGIC_OBJECTIVES,
  TEAMS_TABLE,
  THEMES,
} from "./seed";
import { EMPTY_FILTERS, normalizeFilters, type Filters } from "./filters";
import { ZOOM_SCALE_MAX, ZOOM_SCALE_MIN } from "./types";
import type {
  BusinessUnit,
  Density,
  GroupBy,
  Initiative,
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
  deleteRoadmap as deleteRoadmapRow,
  fetchWorkspace,
  persistArchive,
  persistInitiative,
  persistMove,
  persistOwner,
  persistRoadmap,
  persistSchedule,
  persistUnarchive,
} from "./data";

/** The one always-present, non-deletable Roadmap row (see ADR 008 decision 2). */
const GENERAL_ROADMAP_ID = "roadmap-general";

/** Debounce window for autosaving live filter/view-mode edits to the active
 * Roadmap — long enough that a burst of clicks (or fast typing in the search
 * box) collapses into one write, short enough that switching away/reloading
 * soon after an edit still reliably persists it. */
const ROADMAP_AUTOSAVE_DEBOUNCE_MS = 500;

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
   * Switch the active Roadmap: loads its filters/groupBy/zoom/zoomScale/
   * density/timelineSort/viewMode into this provider's live state (the same
   * "apply a saved config via existing setters" mechanism used everywhere
   * else in this provider).
   */
  setActiveRoadmap: (id: string) => void;
  /** Switch the active Roadmap's view mode (List/Board/Timeline). */
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
  const [activeRoadmapId, setActiveRoadmapId] = useState<string>(GENERAL_ROADMAP_ID);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // filters/groupBy/zoom/zoomScale/density/timelineSort are the *live*
  // in-memory state of whichever Roadmap is active (Sprint Heron Week 2) —
  // switching `activeRoadmapId` loads that Roadmap's saved fields into these
  // via the same setters below; editing them while a non-system Roadmap is
  // active autosaves back to it (see the debounced effect below). Their
  // initial values intentionally match the seeded System Roadmap's own
  // defaults, so the very first render needs no separate "load" step.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("theme");
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
        viewMode: "list",
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

  // Whether the current signed-in caller is allowed to persist changes to a
  // given Roadmap — mirrors persist_roadmap()'s own authorization shape
  // (ADR 008 decision 1) and generalizes the System-roadmap-never-persists
  // rule (decision 2) to the Shared+View-only case: neither the owner nor a
  // Shared+editable participant, so any write would be a no-op locally and
  // a rejection server-side (QA-REPORT-HERON-W2.md finding #2 / sprint T47).
  const canPersistRoadmap = useCallback(
    (target: Roadmap) => {
      if (target.isSystem) return false;
      const isOwner = target.ownerId === (currentOwner?.id ?? null);
      return isOwner || (target.visibility === "shared" && target.editable);
    },
    [currentOwner]
  );

  // Skips the very next autosave-effect run — set right before we load a
  // Roadmap's saved fields into live state (switching active Roadmap,
  // creating one, or falling back after a delete), so re-applying that same
  // Roadmap's own values back onto itself doesn't trigger a redundant write.
  const skipNextAutosaveRef = useRef(false);

  // Holds the id of the debounced autosave effect's currently pending
  // `setTimeout`, if any — lives outside the effect itself so a Roadmap
  // switch (`setActiveRoadmap`/`createRoadmap`, both of which call
  // `applyRoadmapState` and so overwrite the exact fields the debounce is
  // about to save) can flush it synchronously first instead of losing the
  // edit when the effect's own cleanup cancels it (QA-REPORT-HERON-W2.md
  // finding #1 / sprint T47).
  const pendingAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load a Roadmap's saved fields into this provider's live state — the
  // mechanism `activeRoadmapId` switches drive. `viewMode` isn't part of the
  // live filters/groupBy/etc. bundle above (it's read directly off
  // `activeRoadmap.viewMode` by consumers), so it's not applied here.
  const applyRoadmapState = useCallback((r: Roadmap) => {
    skipNextAutosaveRef.current = true;
    setFilters(normalizeFilters(r.filters));
    setGroupBy(r.groupBy);
    setZoom(r.zoom);
    setZoomScaleRaw(r.zoomScale);
    setDensity(r.density);
    setTimelineSort(r.timelineSort ?? { key: "start", dir: 1 });
  }, []);

  // Synchronously commits whatever the debounced autosave effect has
  // pending (if anything) for the *currently* active Roadmap, right before
  // that Roadmap gets swapped out from under it. Safe/no-op to call when
  // nothing is pending (a plain Roadmap switch with no unsaved edit) — it
  // only acts when `pendingAutosaveTimerRef` is actually set, so switching
  // Roadmaps never fires an extra write beyond what the debounce would have
  // sent anyway.
  const flushPendingRoadmapAutosave = useCallback(() => {
    if (pendingAutosaveTimerRef.current === null) return;
    clearTimeout(pendingAutosaveTimerRef.current);
    pendingAutosaveTimerRef.current = null;
    setRoadmaps((prev) => {
      const target = prev.find((r) => r.id === activeRoadmapId);
      if (!target) return prev;
      // Same guard as the debounce callback below (and generalized the same
      // way — not just System, but any Roadmap this caller can't persist
      // to): the live edit is real and stays visible locally for the rest
      // of this session, it just never reaches `roadmaps` state or the RPC.
      if (!canPersistRoadmap(target)) return prev;
      const updated: Roadmap = {
        ...target,
        filters: filters as unknown as Record<string, unknown>,
        groupBy,
        zoom,
        zoomScale,
        density,
        timelineSort,
      };
      if (isSupabaseConfigured) {
        queueMicrotask(() =>
          persistRoadmap(updated).catch((e) => reportError(e, "save roadmap"))
        );
      }
      return prev.map((r) => (r.id === target.id ? updated : r));
    });
  }, [activeRoadmapId, filters, groupBy, zoom, zoomScale, density, timelineSort, canPersistRoadmap, reportError]);

  const setActiveRoadmap = useCallback(
    (id: string) => {
      // Flush the outgoing Roadmap's pending edit (if any) before
      // `applyRoadmapState` overwrites the exact same live fields — see
      // `flushPendingRoadmapAutosave`'s comment and QA-REPORT-HERON-W2.md
      // finding #1 / sprint T47.
      flushPendingRoadmapAutosave();
      const target = getRoadmap(id);
      setActiveRoadmapId(id);
      if (target) applyRoadmapState(target);
    },
    [getRoadmap, applyRoadmapState, flushPendingRoadmapAutosave]
  );

  const setRoadmapViewMode = useCallback(
    (mode: ViewKey) => {
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === activeRoadmapId);
        if (!target) return prev;
        const updated: Roadmap = { ...target, viewMode: mode };
        // ADR 008 decision 2 (System Roadmap) generalized to any Roadmap
        // this caller can't persist to — not owner, and not Shared+editable
        // (`canPersistRoadmap`; QA-REPORT-HERON-W2.md finding #2 / sprint
        // T47). One person clicking "Board" on a Roadmap they don't own/
        // can't edit would otherwise flip the view for everyone else, since
        // it's someone else's row. `viewMode` has no separate live state the
        // way filters/zoom/etc. do (activeRoadmap.viewMode, derived from
        // this array, is the only source of truth consumers read) — so
        // local state must still update here for the click to have any
        // visible effect this session; only the persistRoadmap call is
        // skipped for this row.
        if (canPersistRoadmap(updated) && isSupabaseConfigured) {
          queueMicrotask(() => persistRoadmap(updated).catch((e) => reportError(e, "save view")));
        }
        return prev.map((r) => (r.id === target.id ? updated : r));
      });
    },
    [activeRoadmapId, reportError, canPersistRoadmap]
  );

  // Debounced autosave: whenever the live filters/groupBy/zoom/zoomScale/
  // density/timelineSort bundle changes, write it back to whichever Roadmap
  // is active — mirroring saveInitiative/saveOkr's optimistic-update-then-
  // persist shape, batched behind a short debounce so a burst of edits (or
  // fast typing in the search box) collapses into one write. The pending
  // timer is tracked in `pendingAutosaveTimerRef` (not just a local `timer`
  // const) specifically so `flushPendingRoadmapAutosave` can commit it early
  // — from `setActiveRoadmap`/`createRoadmap` — instead of this effect's own
  // cleanup silently cancelling it out from under an in-flight Roadmap
  // switch (QA-REPORT-HERON-W2.md finding #1 / sprint T47). The actual
  // commit logic itself lives in `flushPendingRoadmapAutosave` so both call
  // sites (this timeout and an early flush) share one guard.
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    pendingAutosaveTimerRef.current = setTimeout(
      flushPendingRoadmapAutosave,
      ROADMAP_AUTOSAVE_DEBOUNCE_MS
    );
    return () => {
      if (pendingAutosaveTimerRef.current !== null) {
        clearTimeout(pendingAutosaveTimerRef.current);
        pendingAutosaveTimerRef.current = null;
      }
    };
  }, [filters, groupBy, zoom, zoomScale, density, timelineSort, flushPendingRoadmapAutosave]);

  const createRoadmap = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const ownerId = currentOwner?.id ?? null;
      const myPositions = roadmapsRef.current
        .filter((r) => !r.isSystem && r.ownerId === ownerId)
        .map((r) => r.position ?? 0);
      const next: Roadmap = {
        id: `roadmap-${Math.random().toString(36).slice(2, 9)}`,
        ownerId,
        name: trimmed,
        viewMode: "list",
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
      // Flush the *previous* active Roadmap's pending edit (if any) before
      // switching away from it below — same race as setActiveRoadmap (QA-
      // REPORT-HERON-W2.md finding #1 / sprint T47): this function also
      // calls applyRoadmapState, which would otherwise overwrite the live
      // fields the debounced autosave is about to save for the outgoing
      // Roadmap.
      flushPendingRoadmapAutosave();
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
      // this brand-new one once the autosave effect fires.
      setActiveRoadmapId(next.id);
      applyRoadmapState(next);
    },
    [reportError, applyRoadmapState, currentOwner, flushPendingRoadmapAutosave]
  );

  const renameRoadmap = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === id);
        if (!target || target.isSystem) return prev; // System row has no rename affordance.
        const updated: Roadmap = { ...target, name: trimmed };
        if (isSupabaseConfigured) {
          queueMicrotask(() => persistRoadmap(updated).catch((e) => reportError(e, "rename roadmap")));
        }
        return prev.map((r) => (r.id === id ? updated : r));
      });
    },
    [reportError]
  );

  const setRoadmapVisibility = useCallback(
    (id: string, v: { visibility: RoadmapVisibility; editable: boolean }) => {
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === id);
        // Owner-only in the UI (the sharing control simply doesn't render for
        // a non-owner or the System row) — mirrored here defensively so this
        // setter agrees with persist_roadmap()'s own refusal either way.
        if (!target || target.isSystem) return prev;
        const updated: Roadmap = { ...target, ...v };
        if (isSupabaseConfigured) {
          queueMicrotask(() => persistRoadmap(updated).catch((e) => reportError(e, "update sharing")));
        }
        return prev.map((r) => (r.id === id ? updated : r));
      });
    },
    [reportError]
  );

  const deleteRoadmap = useCallback(
    (id: string) => {
      setRoadmaps((prev) => {
        const target = prev.find((r) => r.id === id);
        if (!target || target.isSystem) return prev; // System row can never be deleted (matches the DELETE RLS policy).
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
    [reportError, applyRoadmapState]
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
      currentOwner,
      loading,
      error,
      dismissError,
      toasts,
      notify,
      dismissToast,
      filters,
      groupBy,
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
      currentOwner,
      loading,
      error,
      dismissError,
      toasts,
      notify,
      dismissToast,
      filters,
      groupBy,
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
