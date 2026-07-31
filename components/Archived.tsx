"use client";

import { useMemo } from "react";
import { ArchiveRestore } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { formatShortEN } from "@/lib/dates";
import { ownerName, THEME_COLOR_META } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, Button, StatusTag } from "./ui";

/** Archived initiatives + one-click Restore. The only place archived rows surface. */
export function Archived() {
  const { initiatives, getOwner, getTheme, unarchiveInitiative, select, notify } = useRoadmap();

  const archived = useMemo(
    () =>
      initiatives
        .filter((i) => i.archived)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [initiatives]
  );

  return (
    <div className="calm-scroll h-full overflow-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm text-beige-60">
          Archived initiatives are hidden from Timeline, Board and List. Restore one to bring it
          back wherever it was.
        </p>

        {archived.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-beige-30 bg-beige-5/50 px-8 py-12 text-center">
            <div className="font-display text-lg font-semibold text-green-90">Nothing archived</div>
            <p className="mt-1 text-sm text-beige-60">Initiatives you archive will collect here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {archived.map((i) => {
              const owner = getOwner(i.ownerId);
              const theme = getTheme(i.themeId);
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-3 rounded-xl border border-beige-20 bg-white px-4 py-3"
                >
                  {owner && <Avatar name={ownerName(owner)} className="h-7 w-7" neutral />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {theme && (
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            THEME_COLOR_META[theme.color].dot
                          )}
                        />
                      )}
                      <span className="truncate text-sm font-medium text-green-90">{i.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-beige-60">
                      {[ownerName(owner) || "Unassigned", i.team, `Archived ${formatShortEN(i.updatedAt.slice(0, 10))}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <StatusTag status={i.status} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      unarchiveInitiative(i.id);
                      notify({
                        message: `“${i.title}” restored`,
                        action: { label: "View", onClick: () => select(i.id) },
                      });
                    }}
                  >
                    <ArchiveRestore size={15} /> Restore
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
