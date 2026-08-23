'use client';

import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';

/**
 * Sign-in, sign-out, and knowing who you are.
 *
 * Magic link only. There is no password anywhere in this product, which is a
 * decision rather than an omission: a password is one more thing to invent at
 * 9pm, and the single most common reason a student never comes back to an app
 * is that they cannot get into it. A link in an inbox has no failure mode that
 * ends in "reset your password".
 *
 * The cost is a hard dependency on email delivery. Supabase's built-in sender is
 * rate limited to a handful an hour and is documented as testing-only, so thirty
 * students onboarding in one evening during welcome week would hit the wall and
 * see what looks like a broken app. Custom SMTP is a launch blocker with a lead
 * time, not a launch-day task.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };

/**
 * Send a sign-in link.
 *
 * `emailRedirectTo` has to be an absolute URL and has to be on Supabase's
 * allow-list, or the link silently lands on the project's default site instead
 * of back here. Built from the live origin so it works on localhost, on a
 * preview deploy, and on the real domain without three code paths.
 */
export async function sendMagicLink(email: string): Promise<AuthResult> {
  const client = supabase();
  if (!client) return { ok: false, message: 'Accounts are not set up in this build.' };

  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${window.location.origin}/week`,
      // A student who taps the link is telling us they want an account. Making
      // them do a separate signup first would be a second step for no reason.
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: friendly(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

export async function currentSession(): Promise<Session | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * Watch the session.
 *
 * Returns an unsubscribe function. Fires on sign-in, sign-out, token refresh,
 * and once shortly after load when the magic-link code in the URL is exchanged,
 * which is the event the account screen is actually waiting for.
 */
export function onAuthChange(fn: (session: Session | null) => void): () => void {
  const client = supabase();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => fn(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Turn Supabase's wording into something a student can act on.
 *
 * Only rewrites messages where the original is actively misleading. Anything
 * unrecognised passes through, because inventing a friendly message for an error
 * we haven't seen is how real failures get hidden.
 */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many sign-in emails just went out. Try again in a few minutes.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return "That email address doesn't look right.";
  }
  return message;
}
