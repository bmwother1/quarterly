'use client';

import { supabase } from './client';

/**
 * Append-only telemetry. The only thing that can answer the question the whole
 * project turns on: did the students who signed up in week 0 still open this in
 * week 4?
 *
 * Three rules, and they are the reason this file is so short.
 *
 * **It never blocks and never throws.** A student's week must not depend on a
 * network call succeeding. Every function here is fire-and-forget: if the
 * request fails, the app carries on and the event is simply lost. Losing a
 * datapoint is an acceptable cost; a spinner on a schedule is not.
 *
 * **It records what happened, never what the work was.** `detail` holds small
 * numeric facts: minutes, counts. No titles, no course names, no assignment
 * text. Retention is measurable from timestamps alone, so collecting the
 * contents of someone's coursework would be gathering data we have no use for.
 *
 * **It is append-only by grant.** The client has select and insert on
 * `app_event` and deliberately not update or delete. Retention numbers you can
 * quietly rewrite are not measurements.
 */

export type EventKind =
  | 'opened'
  | 'planned'
  | 'block_done'
  | 'block_skipped'
  | 'block_moved'
  | 'feed_synced';

/** Small numeric facts only. Anything that could name a person's work is out. */
type Detail = Record<string, number | boolean>;

export function logEvent(kind: EventKind, detail?: Detail): void {
  const client = supabase();
  if (!client) return;

  void client.auth.getSession().then(({ data }) => {
    const userId = data.session?.user.id;
    // Signed out means there is nobody to attribute this to, and RLS would
    // reject it anyway. Not an error, just nothing to do.
    if (!userId) return;

    return client
      .from('app_event')
      .insert({ user_id: userId, kind, detail: detail ?? null })
      .then(({ error }) => {
        // Swallowed on purpose. A failed insert must never surface to a student
        // who is trying to look at their week, and retrying would risk
        // double-counting the very numbers this exists to keep honest.
        if (error && process.env.NODE_ENV === 'development') {
          console.warn(`[heron] event "${kind}" not recorded:`, error.message);
        }
      });
  }).catch(() => {});
}

/**
 * One "opened" per session, not one per navigation.
 *
 * Retention counts distinct people per week, so an extra row changes no answer,
 * but a student who taps between Week and Plan twenty times a day would bury
 * the real signal under noise and make the raw table useless to read.
 */
let openLogged = false;

export function logOpen(): void {
  if (openLogged) return;
  openLogged = true;
  logEvent('opened');
}
