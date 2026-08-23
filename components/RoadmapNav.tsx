"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Home,
  Link2,
  Map,
  MoreVertical,
  Pencil,
  Plus,
  Share2,
  Target,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { isOkrViewOwner, isRoadmapOwner, useRoadmap } from "@/lib/store";
import { ownerName } from "@/lib/types";
import type { OkrView, Roadmap } from "@/lib/types";
import { useOutsideClose } from "./hooks";
import { TextInput } from "./form";
import { Button, Tag } from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { RoadmapSharePanel } from "./RoadmapShareMenu";
import { OkrViewShareMenu } from "./OkrViewShareMenu";

/**
 * Sidebar nav (Sprint Heron Week 2, restructured Sprint Heron Week 3 per
 * plan §3.2; label hierarchy + mine/shared regroup fixed Sprint Heron Week
 * 3b per `docs/plans/heron-week-3b-sidebar-hierarchy-and-mine-shared-split.md`).
 * Owns two sections now, not one:
 *
 *   OVERVIEW    — General Roadmap (unchanged) + the plain "OKRs" link
 *                 (moved in from AppShell.tsx, which previously rendered
 *                 its own "Views" header + this Link directly).
 *   MY VIEWS    — content-type-first, Roadmaps then OKRs, each with its own
 *                 mine/"Shared with me" split: Roadmaps (mine rows, "+ New
 *                 roadmap", gated "Shared with me") then OKRs (mine
 *                 OkrView rows or a quiet empty-state line, gated "Shared
 *                 with me"). Three label tiers (`mono-label-sm text-green-40`
 *                 → `mono-label-sm pl-5 text-beige-50` → `mono-label-xs pl-7
 *                 text-beige-50`) keep "Overview"/"My views" reading as real
 *                 headers and "Roadmaps"/"OKRs"/"Shared with me" reading as
 *                 visibly subordinate.
 *
 * `beige-50` (not `-70`) for tier 2/3 labels since Sprint Heron Week 3c
 * (QA-REPORT-HERON-W3.md finding #3) — `beige-70` on this sidebar's actual
 * `bg-green-90` background measures 2.44:1, failing AA; `beige-50` measures
 * 6.59:1 there. See `tailwind.config.ts`'s `beige-70` doc comment for the
 * white-background-vs-dark-sidebar distinction.
 *
 * Kept as its own component (not grown inline into AppShell.tsx) per the
 * "keep components focused" convention.
 */
export function RoadmapNav({ activePathname }: { activePathname: string }) {
  const router = useRouter();
  const {
    roadmaps,
    activeRoadmapId,
    activeRoadmap,
    currentOwner,
    getOwner,
    setActiveRoadmap,
    createRoadmap,
    deleteRoadmap,
    roadmapDirty,
    canPersistRoadmap,
    updateRoadmap,
    okrViews,
    activeOkrViewId,
    applyOkrView,
  } = useRoadmap();

  const general = roadmaps.find((r) => r.isSystem);
  const mine = roadmaps
    .filter((r) => isRoadmapOwner(r, currentOwner))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const sharedWithMe = roadmaps
    .filter((r) => !r.isSystem && !isRoadmapOwner(r, currentOwner) && r.visibility === "shared")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // One combined "My OKRs" list — owned views first, then views shared with
  // this user (not two separately-headed subgroups the way Roadmaps get
  // "My roadmaps"/"Shared with me"; the accepted sidebar sketch shows OKR
  // views as a single list, each shared-with-me row distinguished inline via
  // the same Link2/owner-label treatment RoadmapRow already uses).
  const myOkrViews = okrViews
    .filter((v) => isOkrViewOwner(v, currentOwner))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const sharedOkrViews = okrViews
    .filter((v) => !isOkrViewOwner(v, currentOwner) && v.visibility === "shared")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Past 8 combined rows (Roadmaps + OkrViews together) this becomes its own
  // scroll region — extends the existing threshold (design review finding
  // #4) rather than giving OkrViews an independently-scrolling box under the
  // same "My views" header.
  const combinedCount = mine.length + sharedWithMe.length + myOkrViews.length + sharedOkrViews.length;
  const scrollRegion = combinedCount > 8;

  // Deferred action for the discard-confirmation dialog (plan §5.4) — set
  // only when the outgoing Roadmap is genuinely dirty and this caller could
  // actually persist to it; otherwise `goTo` just switches immediately, same
  // as today's quiet local-only behavior for a view-only visitor or System.
  const [pendingSwitch, setPendingSwitch] = useState<(() => void) | null>(null);

  // Defer `perform` behind the discard-confirmation dialog when the outgoing
  // Roadmap is genuinely dirty and this caller could persist to it;
  // otherwise runs immediately. Extracted so every `activeRoadmapId`-
  // swapping call site routes through the same gate (plan §5.2's "every
  // call site" requirement) — `goTo` below and `NewRoadmapRow`'s create
  // submit both use this, closing QA-REPORT-HERON-W3.md finding #1
  // (`+ New roadmap` previously bypassed it entirely).
  const guardedSwitch = (perform: () => void) => {
    if (roadmapDirty && canPersistRoadmap(activeRoadmap)) {
      setPendingSwitch(() => perform);
      return;
    }
    perform();
  };

  const goTo = (id: string) => {
    const perform = () => {
      setActiveRoadmap(id);
      if (activePathname !== "/roadmap") router.push("/roadmap");
    };
    if (id === activeRoadmapId) {
      // Not actually switching away from anything — no dirty check needed.
      perform();
      return;
    }
    guardedSwitch(perform);
  };

  // The plain "OKRs" row is Overview's "one canonical unfiltered thing"
  // (§3.2) — clicking it always clears back to plain browsing, even if an
  // OkrView is currently loaded, so it reliably means "no filter" rather
  // than "whatever was last loaded."
  const goToOkrs = () => {
    applyOkrView(null);
    if (activePathname !== "/okrs") router.push("/okrs");
  };

  const goToOkrView = (id: string) => {
    applyOkrView(id);
    if (activePathname !== "/okrs") router.push("/okrs");
  };

  const [deleteTarget, setDeleteTarget] = useState<Roadmap | null>(null);

  return (
    <>
      <div className="mono-label-sm px-3 pb-2 pt-6 text-green-40">Overview</div>

      {general && (
        <RoadmapGeneralRow
          roadmap={general}
          active={activePathname === "/roadmap" && activeRoadmapId === general.id}
          onSelect={() => goTo(general.id)}
        />
      )}

      <button
        onClick={goToOkrs}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
          activePathname === "/okrs" && !activeOkrViewId
            ? "bg-green-80 text-white"
            : "text-green-20 hover:bg-green-80/60 hover:text-white"
        )}
      >
        {activePathname === "/okrs" && !activeOkrViewId && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
        )}
        <Target size={18} strokeWidth={1.75} />
        OKRs
      </button>

      <div className="mono-label-sm px-3 pb-2 pt-6 text-green-40">My views</div>

      <div className={cn(scrollRegion && "calm-scroll max-h-[280px] overflow-y-auto")}>
        <div className="mono-label-sm pl-5 pr-3 pb-1.5 pt-3 text-beige-50">Roadmaps</div>
        <div className="space-y-1">
          {mine.map((r) => (
            <RoadmapRow
              key={r.id}
              roadmap={r}
              active={activePathname === "/roadmap" && activeRoadmapId === r.id}
              isOwner
              onSelect={() => goTo(r.id)}
              onDelete={() => setDeleteTarget(r)}
            />
          ))}
        </div>

        <NewRoadmapRow
          onSubmit={(trimmedName) => {
            // Routed through the same guard `goTo` uses (QA-REPORT-HERON-W3.md
            // finding #1) — if the outgoing Roadmap is dirty and persistable,
            // the discard-confirmation dialog fires first and `createRoadmap`
            // only runs once the user picks Update-and-switch or
            // Discard-and-switch.
            guardedSwitch(() => {
              createRoadmap(trimmedName);
              if (activePathname !== "/roadmap") router.push("/roadmap");
            });
          }}
        />

        {sharedWithMe.length > 0 && (
          <>
            <div className="mono-label-xs pl-7 pr-3 pb-1.5 pt-3 text-beige-50">Shared with me</div>
            <div className="space-y-1">
              {sharedWithMe.map((r) => (
                <RoadmapRow
                  key={r.id}
                  roadmap={r}
                  active={activePathname === "/roadmap" && activeRoadmapId === r.id}
                  isOwner={false}
                  ownerLabel={ownerName(r.ownerId ? getOwner(r.ownerId) : undefined)}
                  onSelect={() => goTo(r.id)}
                  onDelete={() => setDeleteTarget(r)}
                />
              ))}
            </div>
          </>
        )}

        <div className="mono-label-sm pl-5 pr-3 pb-1.5 pt-3 text-beige-50">OKRs</div>
        {myOkrViews.length === 0 && sharedOkrViews.length === 0 ? (
          <div className="px-3 pb-1.5 text-xs text-beige-50">
            Save a filter combination from the OKRs page to see it here
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {myOkrViews.map((v) => (
                <OkrViewRow
                  key={v.id}
                  view={v}
                  active={activePathname === "/okrs" && activeOkrViewId === v.id}
                  isOwner
                  onSelect={() => goToOkrView(v.id)}
                />
              ))}
            </div>

            {sharedOkrViews.length > 0 && (
              <>
                <div className="mono-label-xs pl-7 pr-3 pb-1.5 pt-3 text-beige-50">Shared with me</div>
                <div className="space-y-1">
                  {sharedOkrViews.map((v) => (
                    <OkrViewRow
                      key={v.id}
                      view={v}
                      active={activePathname === "/okrs" && activeOkrViewId === v.id}
                      isOwner={false}
                      ownerLabel={ownerName(getOwner(v.ownerId))}
                      onSelect={() => goToOkrView(v.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ""}
        body={
          deleteTarget
            ? `This roadmap's filters, sort, and view will be permanently removed. This can't be undone.${
                deleteTarget.visibility === "shared"
                  ? " Anyone it's shared with will lose access immediately."
                  : ""
              }`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteRoadmap(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {/* Discard-confirmation on Roadmap switch while dirty (ADR 010, plan
       * §5.4) — new UI surface, never triggers for the System Roadmap or a
       * caller who can't persist to the outgoing Roadmap anyway (`goTo`
       * only ever sets `pendingSwitch` when both `roadmapDirty` and
       * `canPersistRoadmap(activeRoadmap)` are true). */}
      <ConfirmDialog
        open={pendingSwitch != null}
        title={`Unsaved changes on "${activeRoadmap.name}"`}
        body="Switching roadmaps will discard these changes unless you save them first."
        hideCancelButton
        secondaryConfirmLabel="Discard & switch"
        onSecondaryConfirm={() => {
          const perform = pendingSwitch;
          setPendingSwitch(null);
          perform?.();
        }}
        confirmLabel="Save & switch"
        onConfirm={() => {
          updateRoadmap();
          const perform = pendingSwitch;
          setPendingSwitch(null);
          perform?.();
        }}
        onCancel={() => setPendingSwitch(null)}
      />
    </>
  );
}

function RoadmapGeneralRow({
  roadmap,
  active,
  onSelect,
}: {
  roadmap: Roadmap;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-green-80 text-green-10" : "text-green-20 hover:bg-green-80/60 hover:text-white"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
      )}
      <Home size={18} strokeWidth={1.75} />
      <span className="truncate">{roadmap.name}</span>
    </button>
  );
}

function RoadmapRow({
  roadmap,
  active,
  isOwner,
  ownerLabel,
  onSelect,
  onDelete,
}: {
  roadmap: Roadmap;
  active: boolean;
  isOwner: boolean;
  ownerLabel?: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { renameRoadmap } = useRoadmap();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(roadmap.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  useOutsideClose(menuRef, menuOpen, () => setMenuOpen(false));
  useOutsideClose(shareRef, shareOpen, () => setShareOpen(false));

  const viewOnly = !isOwner && roadmap.visibility === "shared" && !roadmap.editable;

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== roadmap.name) renameRoadmap(roadmap.id, trimmed);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-3 py-2">
        <Map size={18} strokeWidth={1.75} className="shrink-0 text-green-40" />
        <TextInput
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setName(roadmap.name);
              setRenaming(false);
            }
          }}
          onBlur={commitRename}
          className="h-7 flex-1 bg-white text-sm text-green-90"
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-1 rounded-lg">
      <button
        onClick={onSelect}
        className={cn(
          "relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
          active ? "bg-green-80 text-white" : "text-green-20 hover:bg-green-80/60 hover:text-white"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
        )}
        {!isOwner && <Link2 size={14} className="shrink-0 text-green-40" />}
        <Map size={isOwner ? 18 : 16} strokeWidth={1.75} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={roadmap.name}>
          {roadmap.name}
        </span>
        {!isOwner && ownerLabel && (
          <span className="max-w-[72px] shrink-0 truncate text-xs text-green-40" title={ownerLabel}>
            by {ownerLabel}
          </span>
        )}
        {viewOnly && (
          <Tag className="shrink-0 bg-beige-20 text-beige-70">View only</Tag>
        )}
      </button>

      {isOwner && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label={`${roadmap.name} options`}
            className="rounded-md p-1.5 text-green-40 opacity-0 transition-opacity hover:bg-green-80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-beige-20 bg-white p-1.5 shadow-lg">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShareOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
              >
                <Share2 size={14} /> Share…
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
              >
                <Pencil size={14} /> Rename
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-red-60 hover:bg-red-5"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}

          {shareOpen && (
            <div
              ref={shareRef}
              className="absolute right-0 top-full z-50 mt-1 rounded-xl border border-beige-20 bg-white shadow-lg"
            >
              <RoadmapSharePanel roadmap={roadmap} onClose={() => setShareOpen(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sidebar row for a saved/shareable "My OKRs" filter view (Sprint Heron
 * Week 3, ADR 009) — a trimmed `RoadmapRow`: same menu/rename/share/delete
 * shape and the same `Link2`/owner-label/"View only" tag treatment for a
 * shared-with-me row, but no view-mode concept (an OkrView has no
 * equivalent field). Starts from the *already-fixed* version of
 * `RoadmapRow`'s truncation/contrast pattern (`min-w-0 flex-1 truncate` +
 * `title=`, `text-beige-70`, a real `max-w-*` bound on the owner-label
 * trailer) rather than reintroducing a bug already fixed once (design
 * review finding #3). Own icon — `Bookmark`, not `Target` — so "OKRs"
 * (Overview's one canonical unfiltered thing) and "a saved OKR view" (one
 * of several named things a user created) stay visually distinct, the same
 * distinction `Home`/`Map` already preserve for Roadmap.
 */
function OkrViewRow({
  view,
  active,
  isOwner,
  ownerLabel,
  onSelect,
}: {
  view: OkrView;
  active: boolean;
  isOwner: boolean;
  ownerLabel?: string;
  onSelect: () => void;
}) {
  const { renameOkrView, deleteOkrView } = useRoadmap();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(view.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  useOutsideClose(menuRef, menuOpen, () => setMenuOpen(false));
  useOutsideClose(shareRef, shareOpen, () => setShareOpen(false));

  const viewOnly = !isOwner && view.visibility === "shared" && !view.editable;

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== view.name) renameOkrView(view.id, trimmed);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-3 py-2">
        <Bookmark size={18} strokeWidth={1.75} className="shrink-0 text-green-40" />
        <TextInput
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setName(view.name);
              setRenaming(false);
            }
          }}
          onBlur={commitRename}
          className="h-7 flex-1 bg-white text-sm text-green-90"
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-1 rounded-lg">
      <button
        onClick={onSelect}
        className={cn(
          "relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
          active ? "bg-green-80 text-white" : "text-green-20 hover:bg-green-80/60 hover:text-white"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
        )}
        {!isOwner && <Link2 size={14} className="shrink-0 text-green-40" />}
        <Bookmark size={isOwner ? 18 : 16} strokeWidth={1.75} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={view.name}>
          {view.name}
        </span>
        {!isOwner && ownerLabel && (
          <span className="max-w-[72px] shrink-0 truncate text-xs text-green-40" title={ownerLabel}>
            by {ownerLabel}
          </span>
        )}
        {viewOnly && <Tag className="shrink-0 bg-beige-20 text-beige-70">View only</Tag>}
      </button>

      {isOwner && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label={`${view.name} options`}
            className="rounded-md p-1.5 text-green-40 opacity-0 transition-opacity hover:bg-green-80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-beige-20 bg-white p-1.5 shadow-lg">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShareOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
              >
                <Share2 size={14} /> Share…
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
              >
                <Pencil size={14} /> Rename
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-red-60 hover:bg-red-5"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}

          {shareOpen && (
            <div
              ref={shareRef}
              className="absolute right-0 top-full z-50 mt-1 rounded-xl border border-beige-20 bg-white shadow-lg"
            >
              <OkrViewShareMenu view={view} onClose={() => setShareOpen(false)} />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${view.name}"?`}
        body={`This saved view will be permanently removed. This can't be undone.${
          view.visibility === "shared" ? " Anyone it's shared with will lose access immediately." : ""
        }`}
        confirmLabel="Delete"
        tone="destructive"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteOkrView(view.id);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Deliberately dumb (Sprint Heron Week 3c, QA-REPORT-HERON-W3.md finding
 * #1) — doesn't call `createRoadmap` itself, doesn't know about
 * `pendingSwitch`/dirty-checking at all. `onSubmit` is supplied by the
 * parent already wrapped in `guardedSwitch`, matching the existing
 * `onCreated`-style prop pattern this row used before.
 *
 * The naming popover is rendered via a `document.body` portal, `fixed`-
 * positioned from the trigger button's own `getBoundingClientRect()`
 * (finding #2) rather than as an `absolute` child of this row. This row
 * lives inside the sidebar's `calm-scroll max-h-[280px] overflow-y-auto`
 * region once "My views" crosses 8 combined rows; an `absolute` popover
 * there gets clipped on both axes by that ancestor's overflow, and
 * `RoadmapRow`/`OkrViewRow`'s own `absolute right-0 top-full` menu/share
 * popovers were checked and clip the exact same way for rows near the
 * bottom of a long list (QA's finding #2 already corrected the assumption
 * that `.group.relative` or `z-50` makes them escape the scroll container —
 * it doesn't; nothing about their placement is structurally different from
 * this one). So there's no existing in-file pattern to mirror; a portal is
 * the general fix here, verified against the same 13-row repro QA used.
 */
function NewRoadmapRow({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // True while `el`'s own rect is still *fully* contained within every
  // scrollable ancestor's visible box — i.e. `el` hasn't started scrolling
  // out of view within one of its containers (QA-REPORT-HERON-W3F.md finding
  // N20). `getBoundingClientRect` reports layout position, not visibility,
  // so an element clipped by an `overflow: auto` ancestor still reports
  // coordinates outside that ancestor's box — this walks the ancestor chain
  // to catch that directly, rather than inferring it from the viewport alone
  // (the trigger can be "visible" in the `window` sense while still clipped
  // by the sidebar's own scroll region, which is exactly N20's failure).
  //
  // Deliberately a *containment* check, not a mere *intersection* one
  // (QA-REPORT-HERON-W3G.md finding N27) — the popover is anchored off the
  // trigger's bottom edge (`triggerRect.bottom + 4` below), so a trigger that
  // is only partially clipped (a sliver still overlapping the ancestor) is
  // already enough to place the popover's whole body outside the ancestor's
  // box. An intersection test ("do the two rects overlap at all") only turns
  // false once the trigger is *entirely* outside, which left a scroll window
  // of several trigger-heights where the check still said "visible" but the
  // popover had already detached and floated over unrelated sidebar rows.
  function isVisibleWithinScrollAncestors(el: HTMLElement): boolean {
    // Absorbs sub-pixel rounding noise between two independently-measured
    // rects (seen under non-integer browser zoom) without meaningfully
    // widening the containment check itself.
    const EPSILON = 0.5;
    const rect = el.getBoundingClientRect();
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const scrollsY = style.overflowY === "auto" || style.overflowY === "scroll";
      const scrollsX = style.overflowX === "auto" || style.overflowX === "scroll";
      if (!scrollsY && !scrollsX) continue;
      const ancestorRect = node.getBoundingClientRect();
      const clippedY =
        scrollsY && (rect.top < ancestorRect.top - EPSILON || rect.bottom > ancestorRect.bottom + EPSILON);
      const clippedX =
        scrollsX && (rect.left < ancestorRect.left - EPSILON || rect.right > ancestorRect.right + EPSILON);
      if (clippedY || clippedX) return false;
    }
    return true;
  }

  // Recompute the popover's position from the trigger's current rect,
  // clamped/flipped against the viewport on all four edges (QA-REPORT-
  // HERON-W3C.md finding N1 / QA-REPORT-HERON-W3F.md finding N21 — an
  // unclamped position can render the whole popover off the fold in any
  // direction, unreachable by mouse or keyboard since it's a `position:
  // fixed` portal that nothing scrolls). Before the popover has mounted (no
  // measurable size yet) this falls back to the portal's own fixed
  // `w-64`/estimated height so the first paint is already close to correct;
  // the effect below re-runs it once mounted to pick up the real measured
  // size.
  //
  // Closes instead of repositioning when the trigger itself has scrolled
  // out of view within one of its own scrollable ancestors (N20) — this is
  // a check of current DOM state, not of *which event* fired, so it doesn't
  // reintroduce the class of bug the note below describes.
  //
  // History worth knowing before touching this again: an earlier version
  // of this component *closed* the popover on every scroll/resize event
  // instead of repositioning it (QA-REPORT-HERON-W3C.md finding N3's
  // original fix). That approach went through two follow-up bug passes
  // (QA-REPORT-HERON-W3D.md N10/N11, then QA-REPORT-HERON-W3E.md N15/N16)
  // because "should this particular scroll/resize event close the popover"
  // is a genuinely hard heuristic — it has to somehow distinguish the
  // popover's own input scrolling itself (N10), a scroll already in flight
  // before the click (N11), inertial/momentum scrolling that keeps going
  // well past any fixed arming delay (N16), and `resize` events whose
  // `target` isn't even a `Node` (N15). Repositioning by default sidesteps
  // that whole class — there's no "was this the right event" decision left
  // to get wrong — and the one close condition that remains (N20, above) is
  // a state check recomputed fresh on every call, not an event-type guess.
  // Returns focus to the trigger on a programmatic/keyboard close
  // (QA-REPORT-HERON-W3G.md finding N28) — without this, a keyboard or
  // screen-reader user who triggers the auto-close (by scrolling), `Escape`,
  // or `Cancel` loses their place entirely and lands back on `<body>`.
  // `preventScroll: true` because `reposition`'s own auto-close already runs
  // in response to a scroll the user is mid-gesture on; re-focusing the
  // (possibly still-being-scrolled) trigger must not fight that scroll.
  // Deliberately NOT used for outside-click — the browser is already moving
  // focus to whatever the user just clicked, and pulling it back to this
  // trigger would fight that, not restore it.
  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    if (!isVisibleWithinScrollAncestors(triggerRef.current)) {
      closeAndRefocus();
      return;
    }
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current?.getBoundingClientRect();
    const height = popoverRect?.height ?? 134;
    const width = popoverRect?.width ?? 256;
    const top = Math.max(
      8,
      Math.min(
        triggerRect.bottom + height + 4 > window.innerHeight
          ? triggerRect.top - height - 4
          : triggerRect.bottom + 4,
        window.innerHeight - height - 8
      )
    );
    const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - width - 8));
    setCoords((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [closeAndRefocus]);

  // Initial placement on open, and a second pass once the popover has
  // mounted so `reposition` can measure its real size instead of the
  // estimate above (this second run is what makes the clamp/flip land on
  // the popover's true height rather than a guess) — `isMeasured` flips
  // false→true exactly once per open, which is what triggers that second
  // run; JSX below only renders the portal while `open`, so a stale
  // `coords` value sitting around after close is harmless and doesn't need
  // resetting here.
  const isMeasured = coords !== null;
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, isMeasured, reposition]);

  // Keep tracking the trigger as the page scrolls or resizes, rather than
  // closing (see the doc comment on `reposition` above for why). `capture:
  // true` so this also catches the sidebar's own `overflow-y-auto` region
  // scrolling, not just the window; `passive: true` since this never calls
  // `preventDefault`.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("scroll", reposition, { capture: true, passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // Custom outside-close (not the shared `useOutsideClose` hook) because the
  // popover now lives in a portal outside this row's own DOM subtree — a
  // single ref can't cover both the trigger button and the portaled panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setName("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-green-40 transition-colors hover:bg-green-80/60 hover:text-white"
      >
        <Plus size={18} strokeWidth={1.75} />
        New roadmap
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-50 w-64 rounded-xl border border-beige-20 bg-white p-3 shadow-lg"
          >
            <div className="mb-2 text-sm font-medium text-green-90">New roadmap</div>
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 planning"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") closeAndRefocus();
              }}
              className="mb-2"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeAndRefocus}>
                Cancel
              </Button>
              <Button size="sm" disabled={!name.trim()} onClick={submit}>
                Create
              </Button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
