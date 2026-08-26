'use client';

import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';
import {
  CODE_LENGTH, classifyFailure, normaliseCode, type VerifyFailure,
} from '@/lib/verification';

/**
 * Sign-in, sign-out, and knowing who you are.
 *
 * A six-digit code, and no password anywhere in this product. A password is one
 * more thing to invent at 9pm, and the most common reason a student never comes
 * back is that they cannot get in.
 *
 * The code replaced a magic link, and the reason is worth keeping. A link can
 * only be completed in the browser that requested it, because that browser holds
 * the PKCE verifier. A student who onboards in Safari and opens the link from
 * the mail app can land in a different context, where it fails with a message
 * about a missing code verifier. A code never leaves the tab they are already
 * in, so the failure cannot happen rather than being handled.
 *
 * The cost is a hard dependency on email delivery. Supabase's built-in sender is
 * rate limited to a handful an hour and is documented as testing-only, so thirty
 * students onboarding in one evening during welcome week would hit the wall and
 * see what looks like a broken app. Custom SMTP is a launch blocker with a lead
 * time, not a launch-day task.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };

/**
 * Send a six-digit code.
 *
 * No `emailRedirectTo`, deliberately. Supabase decides between a link and a code
 * from the email template, and passing a redirect keeps a link in play. The link
 * is the thing being removed: it can only be completed in the browser that asked
 * for it, and on iOS that is routinely not the browser the student ends up in.
 */
export async function sendCode(email: string): Promise<AuthResult> {
  const client = supabase();
  if (!client) return { ok: false, message: 'Accounts are not set up in this build.' };

  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      // A student who asks for a code is telling us they want an account.
      // Making them sign up separately first would be a step for no reason.
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: friendly(error.message) };
  return { ok: true };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; failure: VerifyFailure; message: string };

/**
 * Exchange a code for a session.
 *
 * `type: 'email'` is the one that matters and is easy to get wrong: `magiclink`
 * is for a token pulled out of a link, and using it here fails with an error
 * that reads like the code is invalid rather than like the call is.
 *
 * The email is lower-cased on both send and verify. Supabase treats the address
 * as the identity, and a student who types their address with a capital on one
 * screen and not the other would otherwise be verifying against nothing.
 */
export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const client = supabase();
  if (!client) {
    return { ok: false, failure: 'unknown', message: 'Accounts are not set up in this build.' };
  }

  const token = normaliseCode(code);
  if (token.length !== CODE_LENGTH) {
    return { ok: false, failure: 'wrong', message: `A code is ${CODE_LENGTH} digits.` };
  }

  const { error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'email',
  });

  if (error) {
    return { ok: false, failure: classifyFailure(error.message), message: error.message };
  }
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
