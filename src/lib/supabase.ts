import { createClient } from "@supabase/supabase-js";

// These two are PUBLIC (safe for the browser) — set them in Vercel's
// Environment Variables as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// NEVER put the service role key here — that one stays server-side only,
// inside /api functions, as SUPABASE_SERVICE_ROLE_KEY.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
