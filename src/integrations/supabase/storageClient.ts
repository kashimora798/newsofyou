// Second Supabase project used ONLY for file storage (images, voice notes, videos, documents).
//
// The main project (client.ts) still holds auth, the `messages` table, etc.
// New uploads go to this project so the main project's storage quota stops filling up.
// Old media keeps loading from the main project because messages store full public URLs.
//
// Override with env vars (Vite uses the VITE_ prefix, not NEXT_PUBLIC_):
//   VITE_STORAGE_SUPABASE_URL
//   VITE_STORAGE_SUPABASE_PUBLISHABLE_KEY
import { createClient } from '@supabase/supabase-js';

export const STORAGE_SUPABASE_URL: string =
  import.meta.env.VITE_STORAGE_SUPABASE_URL || "https://kejfqjqreaqtyummufiu.supabase.co";

// Publishable (anon) key — safe to ship in the browser, same as the main client's key.
export const STORAGE_SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_STORAGE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_u_yiTLLoUTfhKa9T8q4GHQ_x5FEJr_i";

// No user session lives on this project — auth stays on the main project — so
// we turn off session persistence and token refresh entirely.
export const storageClient = createClient(STORAGE_SUPABASE_URL, STORAGE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
