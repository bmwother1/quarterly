'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser Supabase client, or null when the project isn't configured.
 *
 * **Why this lives outside `src/lib/`.** The domain layer is dependency-free and
 * React-free on purpose, so it runs unchanged in the terminal, in tests and in
 * the browser. Anything that talks to a network breaks that, so it lives here
 * instead.
 *
 * **Why there's no `proxy.ts` and no `@supabase/ssr`.** Next 16 renamed
 * Middleware to Proxy, and every Supabase-with-Next guide still says
 * `middleware.ts`. It doesn't matter, because this app has nothing to protect on
 * the server: every page is a client component reading localStorage, and there
 * is no server-rendered content that depends on who you are. A browser client
 * with `detectSessionInUrl` handles the whole magic-link round trip on its own.
 * Adding cookie-based session refresh would be machinery serving no request.
 *
 * **Why null is a supported answer.** Heron works today with no account at
 * all, and that has to keep being true. A student who never signs in must get
 * exactly the product they get now. So every caller treats a missing client as
 * "stay local", never as an error, and the app degrades to what it already was.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  // Both must be present. Half a configuration is a misconfiguration, and
  // failing loudly here beats a confusing 401 on the first write.
  if (!url || !anonKey) {
    cached = null;
    return cached;
  }

  cached = createClient(url, anonKey, {
    auth: {
      // The session belongs in localStorage next to everything else this app
      // stores. There is no server reading it.
      persistSession: true,
      autoRefreshToken: true,
      // Reads the code off the URL after a magic link and exchanges it, which
      // is the entire reason no callback route is needed.
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Renaming this signs out everyone currently signed in. It is a storage
      // key, not the product name, and it stays as it is. See store.ts.
      storageKey: 'quarterly.auth',
    },
  });
  return cached;
}

/** Whether syncing is even possible. Cheap enough to call in a render. */
export function syncAvailable(): boolean {
  return Boolean(url && anonKey);
}
