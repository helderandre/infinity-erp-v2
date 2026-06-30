import { createClient } from "@supabase/supabase-js";

// Anon, sessionless Supabase client for server route handlers / metadata / sitemap.
// Same public project as the ERP; anon key is a public credential.
const FALLBACK_PROJECT_ID = "umlndumjfamfsswwjgoo";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtbG5kdW1qZmFtZnNzd3dqZ29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjM4MjksImV4cCI6MjA4NTA5OTgyOX0._nnXnNIMYi2XkQWRtmzudO6bWNJ0mKmUVGlptqcUPtg";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${FALLBACK_PROJECT_ID}.supabase.co`;
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_ANON_KEY;

export function createAnonServerClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
