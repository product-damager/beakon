import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * v1 ships running on in-memory seed data (see lib/store.tsx) so the app works
 * with zero setup. To move to real persistence + auth:
 *   1. Create a Supabase project.
 *   2. Run supabase/schema.sql then supabase/seed.sql in the SQL editor.
 *   3. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.
 *   4. Replace the seed initializer in lib/store.tsx with a fetch via this client.
 *
 * The publishable key (sb_publishable_...) is the browser-safe key; it uses the
 * `anon` Postgres role when logged out and `authenticated` after sign-in, so RLS
 * still governs every request. It replaces the legacy `anon` key (deprecated end
 * of 2026). We fall back to the legacy env var name if only that is present.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, publishableKey as string)
  : null;
