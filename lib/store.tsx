"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { INITIATIVES, OWNERS, THEMES } from "./seed";
import { EMPTY_FILTERS, type Filters } from "./filters";
import type { GroupBy, Initiative, Owner, Status, Theme, Zoom } from "./types";
import { todayISO } from "./dates";

interface RoadmapState {
  initiatives: Initiative[];
  themes: Theme[];
  owners: Owner[];

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
  // v1 runs on seed data in memory. Swap this initializer for a Supabase fetch
  // (see lib/supabase.ts and supabase/schema.sql) without touching the UI.
  const [initiatives, setInitiatives] = useState<Initiative[]>(INITIATIVES);
  const [themes] = useState<Theme[]>(THEMES);
  const [owners] = useState<Owner[]>(OWNERS);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("theme");
  const [zoom, setZoom] = useState<Zoom>("quarter");
  const [presentation, setPresentation] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<Initiative | null>(null);

  const patchFilters = useCallback(
    (p: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...p })),
    []
  );
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const saveInitiative = useCallback((i: Initiative) => {
    const stamped = { ...i, updatedAt: new Date().toISOString() };
    setInitiatives((prev) => {
      const exists = prev.some((x) => x.id === i.id);
      return exists ? prev.map((x) => (x.id === i.id ? stamped : x)) : [stamped, ...prev];
    });
  }, []);

  const moveInitiative = useCallback(
    (id: string, toStatus: Status, beforeId: string | null) => {
      if (beforeId === id) return; // dropped onto itself — no-op
      setInitiatives((prev) => {
        const dragged = prev.find((x) => x.id === id);
        if (!dragged) return prev;
        const stamped =
          dragged.status === toStatus
            ? { ...dragged }
            : { ...dragged, status: toStatus, updatedAt: new Date().toISOString() };
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
        without.splice(insertAt, 0, stamped);
        return without;
      });
    },
    []
  );

  const archiveInitiative = useCallback((id: string) => {
    setInitiatives((prev) =>
      prev.map((x) => (x.id === id ? { ...x, archived: true, updatedAt: new Date().toISOString() } : x))
    );
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const newDraft = useCallback((): Initiative => {
    const start = todayISO();
    return {
      id: `i-${Math.random().toString(36).slice(2, 9)}`,
      title: "",
      summary: "",
      problem: "",
      expectedOutcome: "",
      status: "planned",
      ownerId: owners[0]?.id ?? "",
      team: "App System",
      themeId: themes[0]?.id ?? "",
      strategicGoal: "",
      scores: { reach: 8, impact: 1, confidence: 0.8, effort: 3 },
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
  }, [owners, themes]);

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
      filters,
      groupBy,
      zoom,
      presentation,
      selectedId,
      editorDraft,
      patchFilters,
      resetFilters,
      saveInitiative,
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
