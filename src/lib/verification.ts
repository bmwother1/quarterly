/**
 * The rules around typing a six-digit code, kept away from the network.
 *
 * Everything here is pure so it can be tested without Supabase, because the
 * cases that matter are the ones that are awkward to reach on purpose: a code
 * that expired while the student was reading their email, a fourth wrong
 * attempt, a resend pressed twice in a second.
 *
 * **Why a code and not a link.** A magic link can only be completed in the
 * browser that asked for it, because that browser holds the PKCE verifier. On
 * iOS a student who onboards in Safari and opens the mail app can easily end up
 * in a different context, and the link then fails with a message about a code
 * verifier that means nothing to anyone. A code never leaves the tab they are
 * already looking at, so the whole class of problem disappears rather than being
 * worked around.
 */

/** Six digits, and nothing else is worth sending to the server. */
export const CODE_LENGTH = 6;

/**
 * How many wrong guesses before we stop accepting any.
 *
 * Six digits is a million combinations, so this is not really about brute force
 * against one code. It is about the case where a student is reading the wrong
 * email, or an old one: after three failures the useful advice is "get a fresh
 * code", not "try again".
 */
export const MAX_ATTEMPTS = 3;

/** Seconds before a resend is allowed. Stops a double tap sending two codes. */
export const RESEND_COOLDOWN_S = 30;

export type VerifyFailure = 'wrong' | 'expired' | 'rate-limited' | 'unknown';

export interface VerifyState {
  attempts: number;
  /** Locked out until a new code is requested. */
  exhausted: boolean;
}

export function freshVerifyState(): VerifyState {
  return { attempts: 0, exhausted: false };
}

/** A failed attempt. Returns the new state rather than mutating. */
export function recordFailure(state: VerifyState): VerifyState {
  const attempts = state.attempts + 1;
  return { attempts, exhausted: attempts >= MAX_ATTEMPTS };
}

/** Requesting a new code clears the count. The old code is dead anyway. */
export function resetAfterResend(): VerifyState {
  return freshVerifyState();
}

/** Digits only, capped. Paste from an email often carries spaces or a newline. */
export function normaliseCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function isComplete(code: string): boolean {
  return normaliseCode(code).length === CODE_LENGTH;
}

/**
 * What Supabase's error actually means, in terms a student can act on.
 *
 * Expiry and a wrong code need opposite advice: one says get a new code, the
 * other says check the one you have. Showing "invalid token" for both is how a
 * student concludes the app is broken and stops.
 *
 * Anything unrecognised passes through as `unknown` and shows the original
 * message, because inventing a friendly explanation for an error we have never
 * seen is how real failures get hidden.
 */
export function classifyFailure(message: string): VerifyFailure {
  const m = message.toLowerCase();
  if (m.includes('expired') || m.includes('has expired')) return 'expired';
  if (m.includes('rate limit') || m.includes('too many')) return 'rate-limited';
  if (m.includes('invalid') || m.includes('token') || m.includes('otp')) return 'wrong';
  return 'unknown';
}

export function messageFor(failure: VerifyFailure, state: VerifyState, original: string): string {
  if (state.exhausted) return 'That code has had three tries. Send a new one and use that instead.';

  switch (failure) {
    case 'expired':
      return 'That code has expired. Send a new one.';
    case 'rate-limited':
      return 'Too many codes just went out. Wait a couple of minutes and try again.';
    case 'wrong': {
      const left = MAX_ATTEMPTS - state.attempts;
      return left === 1
        ? "That code isn't right. One more try before you'll need a new one."
        : `That code isn't right. ${left} tries left.`;
    }
    default:
      return original;
  }
}

/**
 * Seconds still to wait, given when the last code went out.
 *
 * Clamped at both ends. The upper clamp is the one that matters: device clocks
 * move, and a backwards jump makes `elapsed` negative, which *adds* to the wait.
 * Unclamped, a phone whose clock slipped an hour would leave the resend button
 * disabled for an hour, with nothing on screen explaining why.
 */
export function cooldownRemaining(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  const elapsed = Math.floor((now - lastSentAt) / 1000);
  const remaining = RESEND_COOLDOWN_S - elapsed;
  return Math.min(RESEND_COOLDOWN_S, Math.max(0, remaining));
}
