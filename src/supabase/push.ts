'use client';

import { supabase } from './client';

/**
 * Turning notifications on, from the browser's side.
 *
 * **The constraint that decides everything here: on iOS this only works if the
 * app has been added to the home screen.** A Safari tab cannot subscribe at
 * all, and the failure is silent, so a student who taps "turn on
 * notifications" in a tab would get a permission prompt, grant it, and then
 * never receive anything. That is worse than the feature being absent, so this
 * checks for it and says so instead.
 *
 * Nothing here decides what to send. The server runs the same `nextNotice`
 * engine the app uses; this only records where to send it.
 */

export type PushState =
  | 'unsupported'      // no service worker or no Push API at all
  | 'needs-install'    // iOS, in a browser tab: must be added to the home screen
  | 'denied'           // the student said no, and only they can undo it
  | 'off'
  | 'on';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * VAPID keys are base64url; `applicationServerKey` wants raw bytes.
 *
 * Returns a real `ArrayBuffer` rather than a `Uint8Array` view. A view over
 * `ArrayBufferLike` does not satisfy `BufferSource` under current lib.dom, and
 * casting it away would hide a genuine mismatch on some runtimes.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const out = new ArrayBuffer(raw.length);
  const view = new Uint8Array(out);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Standalone means launched from the home screen rather than in a tab.
 *
 * `standalone` is the old Safari-only property and is still the reliable
 * signal on iOS; the media query covers everything else.
 */
function isStandalone(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return iosStandalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent)
    // iPadOS reports as a Mac, and the touch points are what give it away.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!VAPID_PUBLIC) return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // On iOS the Push API is simply absent in a tab, so this is the branch an
    // uninstalled iPhone lands in. Naming it properly is the difference between
    // an actionable message and "your browser is not supported".
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (Notification.permission === 'denied') return 'denied';

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  return existing ? 'on' : 'off';
}

export type EnableResult = { ok: true } | { ok: false; state: PushState; message: string };

/**
 * Ask, subscribe, and record where to send.
 *
 * Must be called from a real tap. Browsers reject a permission request that
 * did not come from a user gesture, and Safari does it silently.
 */
export async function enablePush(): Promise<EnableResult> {
  const state = await pushState();
  if (state === 'needs-install') {
    return {
      ok: false, state,
      message: 'On iPhone, add Heron to your home screen first. Share, then Add to Home Screen. Notifications only work from there.',
    };
  }
  if (state === 'unsupported') {
    return { ok: false, state, message: "This browser can't do notifications." };
  }
  if (state === 'denied') {
    return {
      ok: false, state,
      message: 'Notifications are blocked for this site. Turn them back on in your browser settings.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, state: 'denied', message: 'No notifications, then. You can turn them on later.' };
  }

  const client = supabase();
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
  const userId = data.session?.user.id;
  if (!client || !userId) {
    return {
      ok: false, state: 'off',
      message: 'Sign in first. A notification has to know whose week it is about.',
    };
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    // Without this the subscription is unauthenticated and Chrome rejects it.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC!),
  });

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    return { ok: false, state: 'off', message: 'The browser returned an incomplete subscription.' };
  }

  const { error } = await client.from('push_subscription').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
      // Re-enabling after a send failed permanently has to clear the tombstone,
      // or the row stays skipped forever and nothing ever arrives again.
      disabled_at: null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) return { ok: false, state: 'off', message: error.message };
  return { ok: true };
}

/**
 * Off means gone from both sides.
 *
 * Unsubscribing locally without deleting the row leaves the server sending to
 * an endpoint the browser has thrown away, which fails silently forever and
 * makes the logs useless.
 */
export async function disablePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase()?.from('push_subscription').delete().eq('endpoint', endpoint);
}
