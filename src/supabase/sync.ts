'use client';

import { supabase } from './client';
import { heronStore, type HeronState } from '@/lib/store';
import { afterPull, afterPush, decideDirection, type SyncDirection } from '@/lib/sync-rule';

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
  state: HeronState;
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

  const state = heronStore.getSnapshot();
  const now = new Date().toISOString();

  const { error } = await client
    .from('plan_state')
    .upsert(
      { user_id: userId, state, updated_at: now },
      { onConflict: 'user_id' },
    );

  if (error) return false;

  // `touch: false` because recording a sync is not a student editing their
  // week. Left true, every push would mark the device dirty again and it would
  // push forever.
  heronStore.set(afterPush(heronStore.getSnapshot(), now), { touch: false });
  return true;
}

export async function pull(userId: string): Promise<boolean> {
  const remote = await fetchRemote(userId);
  if (!remote) return false;

  // Everything this device holds, kept before the server copy lands on top.
  // The decision above is meant to be right; this is what makes it survivable
  // when it isn't.
  heronStore.stash();

  const at = new Date().toISOString();
  heronStore.set(afterPull(remote.state, at), { touch: false });
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
    heronStore.getSnapshot(),
    remote ? { updatedAt: remote.updated_at, hasContent: true } : null,
  );

  if (decision === 'push') await push(userId);
  if (decision === 'pull') await pull(userId);
  // 'conflict' deliberately does nothing. Both copies survive and the caller
  // decides what to tell the student. Losing a week silently is not on the menu.
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

/**
 * Keep the server copy current after sign-in.
 *
 * Without this the plan reaches Supabase once and starts going stale
 * immediately, which makes the backup a lie: a student who loses their phone
 * gets whatever their week looked like the moment they signed in.
 *
 * Debounced because the store fires on every keystroke in setup and every
 * checkbox on the calendar. Two seconds of quiet is the signal that a student
 * has finished doing a thing.
 *
 * Returns an unsubscribe function.
 */
export function startAutoPush(userId: string, quietMs = 2000): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let lastPushed: string | null = heronStore.getSnapshot().lastModifiedAt ?? null;

  const unsubscribe = heronStore.subscribe(() => {
    if (stopped) return;
    const modified = heronStore.getSnapshot().lastModifiedAt ?? null;
    // A sync write bumps lastSyncedAt but not lastModifiedAt, so this is what
    // stops the push from retriggering itself forever.
    if (modified === lastPushed) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopped) return;
      const at = heronStore.getSnapshot().lastModifiedAt ?? null;
      lastPushed = at;
      void push(userId).catch(() => {
        // Failed pushes are not retried here. The next edit will try again, and
        // sign-in reconciles properly. Retry loops against a dead network are
        // how a battery disappears.
      });
    }, quietMs);
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
