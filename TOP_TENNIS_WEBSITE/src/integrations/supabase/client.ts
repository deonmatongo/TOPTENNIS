import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Fallback to the project's own values — the anon key is a public/publishable key
// intentionally safe to ship in client bundles and already exposed in git history.
// Override via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your environment.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://qrhladnnblgbobcnxjsz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15_000,
    reconnectAfterMs: (tries: number) => Math.min(tries * 500, 10_000),
    timeout: 20_000,
  },
});