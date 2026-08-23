"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { useOkrWorkspace } from "@/lib/useOkrWorkspace";
import { ArchivedOkrs } from "@/components/ArchivedOkrs";
import { OkrDrawer } from "@/components/OkrDrawer";
import { Logo } from "@/components/Logo";

export default function ArchivedOkrsPage() {
  const { teams, businessUnits, strategicObjectives, notify } = useRoadmap();
  const {
    okrs,
    okrOwners,
    okrInitiatives,
    loading,
    error,
    saveOkr,
    archiveOkr,
    unarchiveOkr,
  } = useOkrWorkspace();

  // Page-scoped selection state (F1, QA-REPORT-HERON-ARCHIVE-FILTERS.md) —
  // mirrors app/(workspace)/okrs/page.tsx's own `selectedOkrId` pattern
  // rather than a global store field, since OKR selection isn't global.
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const selectedOkr = selectedOkrId ? okrs.find((o) => o.id === selectedOkrId) : undefined;

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
    <>
      <ArchivedOkrs
        okrs={okrs}
        teams={teams}
        businessUnits={businessUnits}
        strategicObjectives={strategicObjectives}
        unarchiveOkr={unarchiveOkr}
        notify={notify}
        onSelect={setSelectedOkrId}
      />
      <OkrDrawer
        okr={selectedOkr}
        creatingDraft={null}
        onClose={() => setSelectedOkrId(null)}
        teams={teams}
        businessUnits={businessUnits}
        strategicObjectives={strategicObjectives}
        okrOwners={okrOwners}
        okrInitiatives={okrInitiatives}
        saveOkr={saveOkr}
        archiveOkr={archiveOkr}
        unarchiveOkr={unarchiveOkr}
      />
    </>
  );
}
