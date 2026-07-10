"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "./LoginScreen";
import { Logo } from "./Logo";

/**
 * Gates the workspace behind sign-in. In local/demo mode (no Supabase env)
 * auth is not required and children render straight through. The public share
 * page lives outside this gate.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authRequired, loading, session } = useAuth();

  if (!authRequired) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-beige-5">
        <div className="flex flex-col items-center gap-3 text-beige-60">
          <Logo size={30} tile className="animate-pulse" />
          <span className="mono-label-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
