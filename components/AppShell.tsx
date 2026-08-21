"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Columns3,
  LogOut,
  Plus,
  Rows3,
  CalendarRange,
  Settings,
  Share2,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useRoadmap } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ownerName, type ViewKey } from "@/lib/types";
import { Avatar, Button, IconSegmented, Tag } from "./ui";
import { Logo } from "./Logo";
import { InitiativeDrawer } from "./InitiativeDrawer";
import { SettingsDialog } from "./SettingsDialog";
import { Toaster } from "./Toaster";
import { RoadmapNav } from "./RoadmapNav";
import { RoadmapSharePanel } from "./RoadmapShareMenu";
import { useOutsideClose } from "./hooks";

const TITLES: Record<string, string> = {
  "/archived": "Archived",
  "/okrs": "OKRs",
};

const VIEW_MODE_OPTIONS: { value: ViewKey; label: string; icon: typeof Rows3 }[] = [
  { value: "list", label: "List view", icon: Rows3 },
  { value: "board", label: "Board view", icon: Columns3 },
  { value: "timeline", label: "Timeline view", icon: CalendarRange },
];

/** Header icon-only view-mode switcher + owner-only Share icon + non-owner
 * "View only" flag, rendered only on `/roadmap` (§2.1-§2.3, §3.1, §3.4 of
 * docs/design/roadmap-sidebar-header-sharing.md). */
function RoadmapHeaderControls() {
  const { activeRoadmap, currentOwner, setRoadmapViewMode } = useRoadmap();
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  useOutsideClose(shareRef, shareOpen, () => setShareOpen(false));

  const isOwner = !activeRoadmap.isSystem && activeRoadmap.ownerId === (currentOwner?.id ?? null);
  const viewOnly =
    !isOwner && activeRoadmap.visibility === "shared" && !activeRoadmap.editable && !activeRoadmap.isSystem;

  return (
    <div className="flex items-center gap-3">
      <IconSegmented
        value={activeRoadmap.viewMode}
        onChange={setRoadmapViewMode}
        options={VIEW_MODE_OPTIONS}
        disabled={viewOnly}
      />
      {isOwner && (
        <div className="relative" ref={shareRef}>
          <button
            onClick={() => setShareOpen((o) => !o)}
            aria-label="Share roadmap"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-green-70 transition-colors hover:bg-beige-10"
          >
            <Share2 size={16} strokeWidth={1.75} />
          </button>
          {shareOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-beige-20 bg-white shadow-lg">
              <RoadmapSharePanel roadmap={activeRoadmap} onClose={() => setShareOpen(false)} />
            </div>
          )}
        </div>
      )}
      {viewOnly && <Tag className="bg-beige-20 text-beige-70">View only</Tag>}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOwner, getTeam, activeRoadmap, openCreate, presentation, error, dismissError, loading } =
    useRoadmap();
  const { authRequired, email, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Prefer the matched owner profile; fall back to email (or a demo label).
  const displayName = ownerName(currentOwner) || (authRequired ? email ?? "Signed in" : "You");
  const subtitle =
    [currentOwner?.teamId ? getTeam(currentOwner.teamId)?.name : undefined, currentOwner?.role]
      .filter(Boolean)
      .join(" · ") || "Product team";
  const onRoadmapPage = pathname === "/roadmap";
  const title = onRoadmapPage ? activeRoadmap.name : TITLES[pathname] ?? "Roadmap";

  if (presentation) {
    // Presentation mode drops all chrome for a clean, room-ready timeline.
    return (
      <div className="min-h-screen">
        {children}
        <InitiativeDrawer />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-green-90 text-white">
        <div className="flex items-center gap-2.5 px-6 py-5">
          <Logo size={30} tile />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">Beakon</div>
            <div className="mono-label-sm text-green-40">Roadmap</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 px-3">
          <div className="mono-label-sm px-3 pb-2 text-green-40">Views</div>
          <Link
            href="/okrs"
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === "/okrs"
                ? "bg-green-80 text-white"
                : "text-green-20 hover:bg-green-80/60 hover:text-white"
            )}
          >
            {pathname === "/okrs" && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
            )}
            <Target size={18} strokeWidth={1.75} />
            OKRs
          </Link>

          <RoadmapNav activePathname={pathname} />

          <div className="mono-label-sm px-3 pb-2 pt-6 text-green-40">Manage</div>
          <Link
            href="/archived"
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === "/archived"
                ? "bg-green-80 text-white"
                : "text-green-20 hover:bg-green-80/60 hover:text-white"
            )}
          >
            {pathname === "/archived" && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
            )}
            <Archive size={18} strokeWidth={1.75} />
            Archived
          </Link>

          <div className="mono-label-sm px-3 pb-2 pt-6 text-green-40">Share</div>
          <Link
            href="/share"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-green-20 transition-colors hover:bg-green-80/60 hover:text-white"
          >
            <Share2 size={18} strokeWidth={1.75} />
            External preview
          </Link>
        </nav>

        {displayName && (
          <div className="flex items-center gap-1 border-t border-green-80 px-3 py-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-green-80/60"
              title="Profile settings"
            >
              <Avatar name={displayName} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium text-white">{displayName}</div>
                <div className="truncate text-xs text-green-40">{subtitle}</div>
              </div>
              <Settings
                size={15}
                className="shrink-0 text-green-40 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
            {authRequired && (
              <button
                onClick={() => signOut()}
                className="shrink-0 rounded-md p-1.5 text-green-40 transition-colors hover:bg-green-80 hover:text-white"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-beige-20 bg-white px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate font-display text-xl font-semibold text-green-90">{title}</h1>
            {onRoadmapPage && <RoadmapHeaderControls />}
          </div>
          {pathname === "/okrs" ? (
            <Button size="sm" onClick={() => router.push("/okrs?new=1")}>
              <Plus size={16} strokeWidth={2} />
              New OKR
            </Button>
          ) : pathname === "/archived" ? null : onRoadmapPage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} />
              New initiative
            </Button>
          ) : null}
        </header>

        {error && (
          <div className="flex items-center gap-2 border-b border-red-30 bg-red-30/50 px-6 py-2 text-[13px] text-red-70">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="flex-1 truncate">{error}</span>
            <button
              onClick={dismissError}
              className="shrink-0 rounded p-0.5 hover:bg-red-30"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-beige-60">
                <Logo size={26} tile className="animate-pulse" />
                <span className="mono-label-sm">Loading roadmap…</span>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <InitiativeDrawer />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster />
    </div>
  );
}
