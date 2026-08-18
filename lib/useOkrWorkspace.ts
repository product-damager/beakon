"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BUSINESS_UNITS,
  OKR_INITIATIVES,
  OKR_OWNERS,
  OKRS,
  STRATEGIC_OBJECTIVES,
  TEAMS_TABLE,
} from "./seed";
import { isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import { fetchOkrWorkspace, persistOkr } from "./data";
import type {
  BusinessUnit,
  Okr,
  OkrInitiativeLink,
  OkrOwner,
  StrategicObjective,
  Team,
} from "./types";

interface OkrWorkspaceState {
  businessUnits: BusinessUnit[];
  teams: Team[];
  strategicObjectives: StrategicObjective[];
  okrs: Okr[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
  /** True while the initial Supabase load is in flight. */
  loading: boolean;
  /** Last load (or mutation) error, or null. */
  error: string | null;
  /** Upsert an OKR and fully replace its owners/initiative links, optimistically. */
  saveOkr: (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => void;
  /** Soft-delete: archive an OKR (owners/links carried through unchanged). */
  archiveOkr: (id: string) => void;
  /** Restore an archived OKR (the Undo of archiveOkr). */
  unarchiveOkr: (id: string) => void;
  /** Clear the current error (e.g. dismiss a failed-save banner). */
  dismissError: () => void;
}

/**
 * Page-scoped OKR data hook — lazily loaded only when the /okrs route mounts,
 * mirroring RoadmapProvider's seed-vs-Supabase branching (lib/store.tsx)
 * without folding OKR data into that global, eagerly-loaded provider. Owns
 * its own loading/error state, independent of useRoadmap().loading.
 */
export function useOkrWorkspace(): OkrWorkspaceState {
  const { session } = useAuth();

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(() =>
    isSupabaseConfigured ? [] : BUSINESS_UNITS
  );
  const [teams, setTeams] = useState<Team[]>(() => (isSupabaseConfigured ? [] : TEAMS_TABLE));
  const [strategicObjectives, setStrategicObjectives] = useState<StrategicObjective[]>(() =>
    isSupabaseConfigured ? [] : STRATEGIC_OBJECTIVES
  );
  const [okrs, setOkrs] = useState<Okr[]>(() => (isSupabaseConfigured ? [] : OKRS));
  const [okrOwners, setOkrOwners] = useState<OkrOwner[]>(() =>
    isSupabaseConfigured ? [] : OKR_OWNERS
  );
  const [okrInitiatives, setOkrInitiatives] = useState<OkrInitiativeLink[]>(() =>
    isSupabaseConfigured ? [] : OKR_INITIATIVES
  );
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    let active = true;
    fetchOkrWorkspace()
      .then((w) => {
        if (!active) return;
        setError(null);
        setBusinessUnits(w.businessUnits);
        setTeams(w.teams);
        setStrategicObjectives(w.strategicObjectives);
        setOkrs(w.okrs);
        setOkrOwners(w.okrOwners);
        setOkrInitiatives(w.okrInitiatives);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load OKRs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const reportError = useCallback((e: unknown, action: string) => {
    console.error(`[beakon] ${action} failed`, e);
    setError(e instanceof Error ? e.message : `Could not ${action}. Your change may not be saved.`);
  }, []);

  // Mirrors RoadmapProvider's saveInitiative/archiveInitiative shape: update
  // local state immediately, persist in the background when Supabase-backed.
  const saveOkr = useCallback(
    (okr: Okr, owners: OkrOwner[], initiativeIds: string[]) => {
      const stamped: Okr = { ...okr, updatedAt: new Date().toISOString() };

      setOkrs((prev) => {
        const exists = prev.some((x) => x.id === okr.id);
        return exists ? prev.map((x) => (x.id === okr.id ? stamped : x)) : [stamped, ...prev];
      });
      setOkrOwners((prev) => [
        ...prev.filter((o) => o.okrId !== okr.id),
        ...owners.map((o) => ({ ...o, okrId: okr.id })),
      ]);
      setOkrInitiatives((prev) => [
        ...prev.filter((l) => l.okrId !== okr.id),
        ...initiativeIds.map((initiativeId) => ({ okrId: okr.id, initiativeId })),
      ]);

      if (isSupabaseConfigured) {
        queueMicrotask(() =>
          persistOkr(stamped, owners, initiativeIds).catch((e) => reportError(e, "save"))
        );
      }
    },
    [reportError]
  );

  // Archiving reuses persistOkr() (no dedicated OKR archive endpoint — see
  // Chickadee plan §2) — owners/links must be passed through unchanged since
  // persistOkr() fully replaces them, so this reads the current arrays from
  // closure rather than mutating state from within another state's updater.
  const setArchived = useCallback(
    (id: string, archived: boolean) => {
      const target = okrs.find((x) => x.id === id);
      if (!target) return;
      const stamped: Okr = { ...target, archived, updatedAt: new Date().toISOString() };
      setOkrs((prev) => prev.map((x) => (x.id === id ? stamped : x)));
      if (isSupabaseConfigured) {
        const owners = okrOwners.filter((o) => o.okrId === id);
        const initiativeIds = okrInitiatives.filter((l) => l.okrId === id).map((l) => l.initiativeId);
        queueMicrotask(() =>
          persistOkr(stamped, owners, initiativeIds).catch((e) =>
            reportError(e, archived ? "archive" : "restore")
          )
        );
      }
    },
    [okrs, okrOwners, okrInitiatives, reportError]
  );
  const archiveOkr = useCallback((id: string) => setArchived(id, true), [setArchived]);
  const unarchiveOkr = useCallback((id: string) => setArchived(id, false), [setArchived]);

  const dismissError = useCallback(() => setError(null), []);

  return {
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
  };
}
