'use client';

import { supabase } from './client';

/**
 * Deleting an account, for real.
 *
 * Before this, "Delete my data" cleared localStorage and nothing else. A student
 * who had ever signed in left behind their email, their whole schedule as JSON,
 * and every open and completion they had logged, on a server with no route to
 * reach it. The control said "there is no copy anywhere else" while there was.
 *
 * Two steps, in this order, and the order matters.
 *
 * The server goes first. If the local wipe went first and the network call then
 * failed, the student would see their week vanish and reasonably conclude they
 * were done, while the server copy stayed exactly where it was. Failing before
 * anything is destroyed is recoverable; failing halfway is not.
 */

export type DeleteResult =
  | { ok: true; hadAccount: boolean }
  | { ok: false; message: string };

export async function deleteServerAccount(): Promise<DeleteResult> {
  const client = supabase();
  // No Supabase configured means there was never a server copy to remove.
  if (!client) return { ok: true, hadAccount: false };

  const { data } = await client.auth.getSession();
  if (!data.session) return { ok: true, hadAccount: false };

  // A Postgres function, not four deletes from here. Every table cascades from
  // auth.users, so one row removes the profile, the plan, the telemetry and the
  // push subscriptions together. Doing it client-side would leave the email
  // behind, which is the part a student most wants gone.
  const { error } = await client.rpc('delete_own_account');
  if (error) {
    return {
      ok: false,
      message: `Your account could not be deleted, so nothing was removed. ${error.message}`,
    };
  }

  // The session is now a token for a user that no longer exists. Clearing it
  // locally avoids an app that believes it is signed in as a deleted account.
  await client.auth.signOut();
  return { ok: true, hadAccount: true };
}
