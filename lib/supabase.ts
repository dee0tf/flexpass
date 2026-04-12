import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// True singleton — only ONE SupabaseClient instance ever exists.
// This prevents race conditions where multiple GoTrueClient instances
// each fire their own INITIAL_SESSION event with stale data.
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        persistSession: typeof window !== "undefined",  // only persist on client
        autoRefreshToken: true,
      },
    });
  }
  return _supabase;
}

// Server-side Supabase client (for use in Server Components, API Routes, Server Actions)
export const createServerSupabase = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
};

// Default export for convenience — guaranteed singleton
export const supabase = getSupabase();
