"use client";

import { useRef, useState } from "react";
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
import { useClampedPopover } from "./hooks";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Both popovers below share `triggerRef` (the "⋮" button) — they're
  // mutually exclusive (Share… closes the menu on click) but each needs its
  // own open state and its own estimated size for the two-pass placement.
  // Destructured immediately (not kept as `menuPopover.foo`/`sharePopover.foo`
  // member expressions) — `react-hooks/refs` flags any later property access
  // on an object that carries a ref as if it were the ref itself.
  const {
    open: menuOpen,
    setOpen: setMenuOpen,
    coords: menuCoords,
    popoverRef: menuPopoverRef,
    close: closeMenu,
  } = useClampedPopover(triggerRef, { estimatedWidth: 160, estimatedHeight: 140, align: "right" });
  const {
    open: shareOpen,
    setOpen: setShareOpen,
    coords: shareCoords,
    popoverRef: sharePopoverRef,
    close: closeShare,
  } = useClampedPopover(triggerRef, { estimatedWidth: 288, estimatedHeight: 260, align: "right" });

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
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label={`${roadmap.name} options`}
            className="rounded-md p-1.5 text-green-40 opacity-0 transition-opacity hover:bg-green-80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen &&
            menuCoords &&
            createPortal(
              <div
                ref={menuPopoverRef}
                style={{ position: "fixed", top: menuCoords.top, left: menuCoords.left }}
                className="z-50 w-40 rounded-xl border border-beige-20 bg-white p-1.5 shadow-lg"
              >
                <button
                  onClick={() => {
                    closeMenu();
                    setShareOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
                >
                  <Share2 size={14} /> Share…
                </button>
                <button
                  onClick={() => {
                    closeMenu();
                    setRenaming(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
                >
                  <Pencil size={14} /> Rename
                </button>
                <button
                  onClick={() => {
                    closeMenu();
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-red-60 hover:bg-red-5"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>,
              document.body
            )}

          {shareOpen &&
            shareCoords &&
            createPortal(
              <div
                ref={sharePopoverRef}
                style={{ position: "fixed", top: shareCoords.top, left: shareCoords.left }}
                className="z-50 rounded-xl border border-beige-20 bg-white shadow-lg"
              >
                <RoadmapSharePanel roadmap={roadmap} onClose={closeShare} />
              </div>,
              document.body
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Both popovers below share `triggerRef` (the "⋮" button) — they're
  // mutually exclusive (Share… closes the menu on click) but each needs its
  // own open state and its own estimated size for the two-pass placement.
  // Destructured immediately (not kept as `menuPopover.foo`/`sharePopover.foo`
  // member expressions) — `react-hooks/refs` flags any later property access
  // on an object that carries a ref as if it were the ref itself.
  const {
    open: menuOpen,
    setOpen: setMenuOpen,
    coords: menuCoords,
    popoverRef: menuPopoverRef,
    close: closeMenu,
  } = useClampedPopover(triggerRef, { estimatedWidth: 160, estimatedHeight: 140, align: "right" });
  const {
    open: shareOpen,
    setOpen: setShareOpen,
    coords: shareCoords,
    popoverRef: sharePopoverRef,
    close: closeShare,
  } = useClampedPopover(triggerRef, { estimatedWidth: 288, estimatedHeight: 260, align: "right" });

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
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label={`${view.name} options`}
            className="rounded-md p-1.5 text-green-40 opacity-0 transition-opacity hover:bg-green-80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen &&
            menuCoords &&
            createPortal(
              <div
                ref={menuPopoverRef}
                style={{ position: "fixed", top: menuCoords.top, left: menuCoords.left }}
                className="z-50 w-40 rounded-xl border border-beige-20 bg-white p-1.5 shadow-lg"
              >
                <button
                  onClick={() => {
                    closeMenu();
                    setShareOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
                >
                  <Share2 size={14} /> Share…
                </button>
                <button
                  onClick={() => {
                    closeMenu();
                    setRenaming(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-green-90 hover:bg-beige-10"
                >
                  <Pencil size={14} /> Rename
                </button>
                <button
                  onClick={() => {
                    closeMenu();
                    setDeleteOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-red-60 hover:bg-red-5"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>,
              document.body
            )}

          {shareOpen &&
            shareCoords &&
            createPortal(
              <div
                ref={sharePopoverRef}
                style={{ position: "fixed", top: shareCoords.top, left: shareCoords.left }}
                className="z-50 rounded-xl border border-beige-20 bg-white shadow-lg"
              >
                <OkrViewShareMenu view={view} onClose={closeShare} />
              </div>,
              document.body
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
 * The naming popover is rendered via `useClampedPopover` (relocated from
 * this component into `hooks.ts` — see that file's doc comment for the full
 * QA history behind the positioning logic) rather than as an `absolute`
 * child of this row. This row lives inside the sidebar's `calm-scroll
 * max-h-[280px] overflow-y-auto` region once "My views" crosses 8 combined
 * rows; an `absolute` popover there gets clipped on both axes by that
 * ancestor's overflow, which is exactly what the hook's scroll-ancestor
 * containment check exists to catch.
 */
function NewRoadmapRow({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, setOpen, coords, popoverRef, close } = useClampedPopover(triggerRef, {
    estimatedWidth: 256,
    estimatedHeight: 134,
  });

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
                if (e.key === "Escape") close();
              }}
              className="mb-2"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={close}>
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
