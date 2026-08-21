"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Link2, Map, MoreVertical, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRoadmap } from "@/lib/store";
import { ownerName } from "@/lib/types";
import type { Roadmap } from "@/lib/types";
import { useOutsideClose } from "./hooks";
import { TextInput } from "./form";
import { Button, Tag } from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { RoadmapSharePanel } from "./RoadmapShareMenu";

/**
 * Sidebar "Roadmaps" section (Sprint Heron Week 2) — replaces the old flat
 * Timeline/Board/List NAV items. Structure per
 * docs/design/roadmap-sidebar-header-sharing.md §1: pinned General Roadmap
 * (no menu, no delete affordance), then "My roadmaps"/"Shared with me"
 * subgroups, then "+ New roadmap". Kept as its own component (not grown
 * inline into AppShell.tsx) per the "keep components focused" convention.
 */
export function RoadmapNav({ activePathname }: { activePathname: string }) {
  const router = useRouter();
  const { roadmaps, activeRoadmapId, currentOwner, getOwner, setActiveRoadmap, deleteRoadmap } =
    useRoadmap();

  const general = roadmaps.find((r) => r.isSystem);
  const mine = roadmaps
    .filter((r) => !r.isSystem && r.ownerId === (currentOwner?.id ?? null))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const sharedWithMe = roadmaps
    .filter((r) => !r.isSystem && r.ownerId !== (currentOwner?.id ?? null) && r.visibility === "shared")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const combinedCount = mine.length + sharedWithMe.length;
  const scrollRegion = combinedCount > 8;

  const goTo = (id: string) => {
    setActiveRoadmap(id);
    if (activePathname !== "/roadmap") router.push("/roadmap");
  };

  const [deleteTarget, setDeleteTarget] = useState<Roadmap | null>(null);

  return (
    <>
      <div className="mono-label-sm px-3 pb-2 pt-6 text-green-40">Roadmaps</div>

      {general && (
        <RoadmapGeneralRow
          roadmap={general}
          active={activePathname === "/roadmap" && activeRoadmapId === general.id}
          onSelect={() => goTo(general.id)}
        />
      )}

      <div className="my-2 border-t border-green-80" />

      {/* Past 8 combined rows this becomes its own scroll region (§1.4 of the
       * design doc, explicitly flagged there as "good enough for now, not a
       * final polish pass") — both subgroup labels stay inside it here (a
       * simplification of the doc's "labels pinned outside scroll" ideal,
       * which would need its own sticky-label mechanics); the ordering bug
       * this replaces (the "Shared with me" label rendering after its own
       * rows) was worth fixing over chasing that full polish this pass. */}
      <div className={cn(scrollRegion && "calm-scroll max-h-[280px] overflow-y-auto")}>
        <div className="mono-label-sm px-3 pb-1.5 pt-3 text-green-40/80">My roadmaps</div>
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

        {sharedWithMe.length > 0 && (
          <>
            <div className="mono-label-sm px-3 pb-1.5 pt-3 text-green-40/80">Shared with me</div>
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
      </div>

      <NewRoadmapRow
        onCreated={() => {
          // createRoadmap() (lib/store.tsx) already switches activeRoadmapId
          // to the new Roadmap — this only needs to make sure we're on the
          // page that renders it.
          if (activePathname !== "/roadmap") router.push("/roadmap");
        }}
      />

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
        <span className="min-w-0 flex-1 truncate">{roadmap.name}</span>
        {!isOwner && ownerLabel && (
          <span className="shrink-0 truncate text-xs text-green-40">by {ownerLabel}</span>
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

function NewRoadmapRow({ onCreated }: { onCreated: () => void }) {
  const { createRoadmap } = useRoadmap();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, open, () => setOpen(false));

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createRoadmap(trimmed);
    setName("");
    setOpen(false);
    onCreated();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-green-40 transition-colors hover:bg-green-80/60 hover:text-white"
      >
        <Plus size={18} strokeWidth={1.75} />
        New roadmap
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-beige-20 bg-white p-3 shadow-lg">
          <div className="mb-2 text-sm font-medium text-green-90">New roadmap</div>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q3 planning"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            className="mb-2"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!name.trim()} onClick={submit}>
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
