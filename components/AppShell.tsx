"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, CalendarRange, Columns3, LogOut, Plus, Rows3, Share2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRoadmap } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Avatar, Button } from "./ui";
import { Logo } from "./Logo";
import { InitiativeDrawer } from "./InitiativeDrawer";
import { InitiativeEditor } from "./InitiativeEditor";

const NAV = [
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/list", label: "List", icon: Rows3 },
];

const TITLES: Record<string, string> = {
  "/timeline": "Timeline",
  "/board": "Board",
  "/list": "List",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { owners, openCreate, presentation, error, dismissError, loading } = useRoadmap();
  const { authRequired, email, signOut } = useAuth();
  // Signed-in identity when auth is on; otherwise fall back to the first owner.
  const displayName = authRequired ? email ?? "Signed in" : owners[0]?.name;

  if (presentation) {
    // Presentation mode drops all chrome for a clean, room-ready timeline.
    return (
      <div className="min-h-screen">
        {children}
        <InitiativeDrawer />
        <InitiativeEditor />
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
          <ul className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-green-80 text-white" : "text-green-20 hover:bg-green-80/60 hover:text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-lime-40" />
                    )}
                    <Icon size={18} strokeWidth={1.75} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

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
          <div className="flex items-center gap-3 border-t border-green-80 px-5 py-4">
            <Avatar name={displayName} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{displayName}</div>
              <div className="truncate text-xs text-green-40">Product team · Editor</div>
            </div>
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
          <h1 className="font-display text-xl font-semibold text-green-90">
            {TITLES[pathname] ?? "Roadmap"}
          </h1>
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} strokeWidth={2} />
            New initiative
          </Button>
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
      <InitiativeEditor />
    </div>
  );
}
