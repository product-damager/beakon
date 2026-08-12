"use client";

import { useEffect, useState } from "react";
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
import { fetchOkrWorkspace } from "./data";
import type { BusinessUnit, Okr, OkrOwner, StrategicObjective, Team } from "./types";

interface OkrInitiativeLink {
  okrId: string;
  initiativeId: string;
}

interface OkrWorkspaceState {
  businessUnits: BusinessUnit[];
  teams: Team[];
  strategicObjectives: StrategicObjective[];
  okrs: Okr[];
  okrOwners: OkrOwner[];
  okrInitiatives: OkrInitiativeLink[];
  /** True while the initial Supabase load is in flight. */
  loading: boolean;
  /** Last load error, or null. */
  error: string | null;
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

  return {
    businessUnits,
    teams,
    strategicObjectives,
    okrs,
    okrOwners,
    okrInitiatives,
    loading,
    error,
  };
}
