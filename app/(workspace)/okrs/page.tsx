"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useOkrWorkspace } from "@/lib/useOkrWorkspace";
import { EMPTY_OKR_FILTERS, OkrFilterBar, applyOkrFilters, type OkrFilters } from "@/components/OkrFilterBar";
import { OkrList } from "@/components/OkrList";
import { OkrDrawer } from "@/components/OkrDrawer";
import { Logo } from "@/components/Logo";

export default function OkrsPage() {
  const {
    businessUnits,
    teams,
    strategicObjectives,
    okrs,
    okrOwners,
    okrInitiatives,
    loading,
    error,
  } = useOkrWorkspace();

  const [filters, setFilters] = useState<OkrFilters>(EMPTY_OKR_FILTERS);
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);

  const filtered = useMemo(() => applyOkrFilters(okrs, filters, teams), [okrs, filters, teams]);
  const selectedOkr = selectedOkrId ? okrs.find((o) => o.id === selectedOkrId) : undefined;

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

  if (error) {
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

  if (okrs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-beige-60">No OKRs yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
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
        onSelect={setSelectedOkrId}
      />
      <OkrDrawer
        okr={selectedOkr}
        onClose={() => setSelectedOkrId(null)}
        teams={teams}
        businessUnits={businessUnits}
        strategicObjectives={strategicObjectives}
        okrOwners={okrOwners}
        okrInitiatives={okrInitiatives}
      />
    </div>
  );
}
