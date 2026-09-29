import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const usingSupabase = process.env.NEXT_PUBLIC_STORAGE === 'supabase';

let client: SupabaseClient | null = null;

/** Browser Supabase client, created on first use. The session is kept in localStorage by supabase-js. */
export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    client = createClient(url, key);
  }
  return client;
}
