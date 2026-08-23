'use client';

import { supabase } from './client';
import { quarterlyStore, type QuarterlyState } from '@/lib/store';
import { decideDirection, type SyncDirection } from '@/lib/sync-rule';

/**
 * Keeping a student's week in two places.
 *
 * The plan is stored as a single JSON blob that mirrors the local store exactly,
 * so syncing is "write the same object somewhere else" rather than a schema
 * translation that has to be kept in step with the client forever. Nothing
 * queries inside it; the numbers that matter live in `app_event`.
 *
 * **What this deliberately does not solve: two devices edited apart.** There is
 * no merge. The rule below picks a winner and the loser's changes are gone. That
 * is a real limitation and it is the right trade for now, because the realistic
 * case is a student on one phone, and building conflict resolution nobody will
 * see costs a week that the interviews need more. When it does need solving, the
 * `revision` column is already there for it.
 */

interface RemotePlan {
  state: QuarterlyState;
  updated_at: string;
  revision: number;
}

async function fetchRemote(userId: string): Promise<RemotePlan | null> {
  const client = supabase();
  if (!client) return null;

  const { data, error } = await client
    .from('plan_state')
    .select('state, updated_at, revision')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as RemotePlan;
}

export async function push(userId: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;

  const state = quarterlyStore.getSnapshot();
  const now = new Date().toISOString();

  const { error } = await client
    .from('plan_state')
    .upsert(
      { user_id: userId, state, updated_at: now },
      { onConflict: 'user_id' },
    );

  if (error) return false;

  // Record that this device is now level with the server. Written without
  // going through the store's mutate path so it doesn't read as a user edit.
  quarterlyStore.set({ ...quarterlyStore.getSnapshot(), lastSyncedAt: now });
  return true;
}

export async function pull(userId: string): Promise<boolean> {
  const remote = await fetchRemote(userId);
  if (!remote) return false;

  quarterlyStore.set({
    ...remote.state,
    lastSyncedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Run once on sign-in. Decides, then moves the data one way.
 *
 * Returns what it did so the caller can say so. A sync that silently replaced
 * someone's week would be the worst possible version of this feature.
 */
export async function syncOnSignIn(userId: string): Promise<SyncDirection> {
  const remote = await fetchRemote(userId);
  const decision = decideDirection(
    quarterlyStore.getSnapshot(),
    remote ? { updatedAt: remote.updated_at, hasContent: true } : null,
  );

  if (decision === 'push') await push(userId);
  if (decision === 'pull') await pull(userId);
  return decision;
}

/**
 * Make sure the profile row exists.
 *
 * `cohort_week` defaults to the week of insert, and it is the column the whole
 * retention view groups by, so this has to happen once at first sign-in and
 * never be overwritten afterwards. `ignoreDuplicates` is what guarantees the
 * second half: a later upsert must not reset which cohort a student belongs to.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const client = supabase();
  if (!client) return;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';

  await client
    .from('profile')
    .upsert({ id: userId, timezone }, { onConflict: 'id', ignoreDuplicates: true });
}
