"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

interface AuthState {
  /** Whether sign-in is required at all. False in local/demo mode (no Supabase env). */
  authRequired: boolean;
  /** Still resolving the initial session. */
  loading: boolean;
  session: Session | null;
  email: string | null;
  /** Send a magic link. Resolves with an error message, or null on success. */
  signIn: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // In local/demo mode there is nothing to load, so we're never "loading".
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string): Promise<string | null> => {
    if (!supabase) return "Supabase is not configured.";
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Return to the workspace after clicking the link.
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/timeline` : undefined,
      },
    });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      authRequired: isSupabaseConfigured,
      loading,
      session,
      email: session?.user?.email ?? null,
      signIn,
      signOut,
    }),
    [loading, session, signIn, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
