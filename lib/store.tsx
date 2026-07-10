"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { INITIATIVES, OWNERS, THEMES } from "./seed";
import { EMPTY_FILTERS, type Filters } from "./filters";
import type { GroupBy, Initiative, Owner, Status, Theme, Zoom } from "./types";
import { todayISO } from "./dates";
import { isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import {
  createTheme,
  fetchWorkspace,
  persistArchive,
  persistInitiative,
  persistMove,
  persistOwner,
} from "./data";

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

  /** True while the initial Supabase load is in flight. */
  loading: boolean;
  /** Last sync error (a failed persist or load), or null. */
  error: string | null;
  dismissError: () => void;

  /** The owner row matching the signed-in user's email, if any. */
  currentOwner: Owner | undefined;

  filters: Filters;
  groupBy: GroupBy;
  zoom: Zoom;
  presentation: boolean;
  selectedId: string | null;
  editorDraft: Initiative | null;

  setFilters: (f: Filters) => void;
  patchFilters: (p: Partial<Filters>) => void;
  resetFilters: () => void;
  setGroupBy: (g: GroupBy) => void;
  setZoom: (z: Zoom) => void;
  setPresentation: (v: boolean) => void;

  select: (id: string | null) => void;
  saveInitiative: (i: Initiative) => void;
  /** Create a new theme (persists + adds to state). */
  addTheme: (t: Theme) => void;
  /** Update the signed-in user's profile (name / surname / team). */
  saveProfile: (patch: { name: string; surname: string; team: string }) => void;
  /** Board drag: set status and place before `beforeId` (null = end of target column). */
  moveInitiative: (id: string, toStatus: Status, beforeId: string | null) => void;
  archiveInitiative: (id: string) => void;
  newDraft: () => Initiative;
  openCreate: () => void;
  openEdit: (i: Initiative) => void;
  closeEditor: () => void;

  getOwner: (id: string) => Owner | undefined;
  getTheme: (id: string) => Theme | undefined;
  getInitiative: (id: string) => Initiative | undefined;
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
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("theme");
  const [zoom, setZoom] = useState<Zoom>("quarter");
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
  const dismissError = useCallback(() => setError(null), []);

  const reportError = useCallback((e: unknown, action: string) => {
    console.error(`[beakon] ${action} failed`, e);
    setError(
      e instanceof Error ? e.message : `Could not ${action}. Your change may not be saved.`
    );
  }, []);

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

  // Match the signed-in user to a seeded owner row by email — lets the app
  // "know who you are" and default new initiatives to you as owner. In local/
  // demo mode (no auth) the first owner stands in as "you".
  const currentOwner = useMemo<Owner | undefined>(() => {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return isSupabaseConfigured ? undefined : owners[0];
    return owners.find((o) => o.email?.toLowerCase() === email);
  }, [owners, session]);

  const saveProfile = useCallback(
    (patch: { name: string; surname: string; team: string }) => {
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
        team: patch.team || undefined,
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
      team: "App System",
      themeId: themes[0]?.id ?? "",
      strategicGoal: "",
      scores: { demand: 250, impact: 1, viability: 0.8, effort: 3 },
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
  }, [owners, themes, currentOwner]);

  const openCreate = useCallback(() => setEditorDraft(newDraft()), [newDraft]);
  const openEdit = useCallback((i: Initiative) => setEditorDraft({ ...i }), []);
  const closeEditor = useCallback(() => setEditorDraft(null), []);

  const getOwner = useCallback((id: string) => owners.find((o) => o.id === id), [owners]);
  const getTheme = useCallback((id: string) => themes.find((t) => t.id === id), [themes]);
  const getInitiative = useCallback(
    (id: string) => initiatives.find((i) => i.id === id),
    [initiatives]
  );

  const value = useMemo<RoadmapState>(
    () => ({
      initiatives,
      themes,
      owners,
      currentOwner,
      loading,
      error,
      dismissError,
      filters,
      groupBy,
      zoom,
      presentation,
      selectedId,
      editorDraft,
      setFilters,
      patchFilters,
      resetFilters,
      setGroupBy,
      setZoom,
      setPresentation,
      select: setSelectedId,
      saveInitiative,
      addTheme,
      saveProfile,
      moveInitiative,
      archiveInitiative,
      newDraft,
      openCreate,
      openEdit,
      closeEditor,
      getOwner,
      getTheme,
      getInitiative,
    }),
    [
      initiatives,
      themes,
      owners,
      currentOwner,
      loading,
      error,
      dismissError,
      filters,
      groupBy,
      zoom,
      presentation,
      selectedId,
      editorDraft,
      patchFilters,
      resetFilters,
      saveInitiative,
      addTheme,
      saveProfile,
      moveInitiative,
      archiveInitiative,
      newDraft,
      openCreate,
      openEdit,
      closeEditor,
      getOwner,
      getTheme,
      getInitiative,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoadmap(): RoadmapState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoadmap must be used within RoadmapProvider");
  return v;
}
