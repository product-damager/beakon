import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * v1 ships running on in-memory seed data (see lib/store.tsx) so the app works
 * with zero setup. To move to real persistence + auth:
 *   1. Create a Supabase project.
 *   2. Run supabase/schema.sql then supabase/seed.sql in the SQL editor.
 *   3. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.
 *   4. Replace the seed initializer in lib/store.tsx with a fetch via this client.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anon as string)
  : null;
