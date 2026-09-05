import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { nextNotice, violatesTone } from '@/lib/notify';
import type { HeronState } from '@/lib/store';

/**
 * The daily send.
 *
 * Runs on a schedule, works out whether each subscribed student has anything
 * worth being interrupted for, and sends at most one notification each.
 *
 * **Nothing here decides what to say.** It calls `nextNotice`, the same engine
 * the app uses for its in-app preview, with the same student state. A second
 * copy of the notification logic on the server is how the preview and the real
 * thing drift until they disagree, and the one a student sees is the one nobody
 * tested.
 *
 * **Null is the expected answer.** `nextNotice` returns nothing most of the
 * time, and that is the feature. An app that always has something to say is one
 * people mute in week two, and a muted notification is worse than none because
 * it cannot be won back.
 *
 * **Why service_role.** Sending requires reading every subscribed student's
 * plan, which row-level security correctly forbids the public key from doing.
 * This route is the only place in the codebase that holds it, it never runs in
 * a browser, and the key is never sent anywhere.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
  timezone: string;
  user_id: string;
}

function configured(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return 'NEXT_PUBLIC_SUPABASE_URL';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY';
  if (!process.env.VAPID_PRIVATE_KEY) return 'VAPID_PRIVATE_KEY';
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return 'NEXT_PUBLIC_VAPID_PUBLIC_KEY';
  return null;
}

export async function GET(request: Request) {
  /**
   * Vercel signs cron invocations with CRON_SECRET. Without this check the
   * route is a public button that makes everyone's phone buzz.
   */
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const missing = configured();
  if (missing) {
    // Named rather than generic: a silent no-op here would look identical to
    // "nobody had anything worth sending", which is the common case.
    return NextResponse.json({ error: `not configured: ${missing}` }, { status: 503 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:bmwother1@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: subs, error } = await admin
    .from('push_subscription')
    .select('endpoint, p256dh, auth_key, timezone, user_id')
    .is('disabled_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  let sent = 0;
  let quiet = 0;
  const problems: string[] = [];

  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    try {
      const { data: plan } = await admin
        .from('plan_state')
        .select('state')
        .eq('user_id', sub.user_id)
        .maybeSingle();

      // Signed in, notifications on, never synced a week. Nothing to say.
      if (!plan?.state) { quiet += 1; continue; }
      const state = plan.state as HeronState;

      const notice = nextNotice({
        blocks: state.blocks ?? [],
        assignments: state.assignments ?? [],
        commitments: state.commitments ?? [],
        now,
        tz: sub.timezone,
        lastSentAt: state.lastNotifiedAt ?? null,
      });

      if (!notice) { quiet += 1; continue; }

      /**
       * The tone rules, enforced at the last possible moment.
       *
       * `violatesTone` has existed with tests since the engine was written and
       * nothing ever called it. A banned phrase reaching a lock screen is the
       * one notification failure that cannot be taken back, so a message that
       * breaks the rules is dropped rather than softened.
       */
      const offence = violatesTone(`${notice.title} ${notice.body}`);
      if (offence) {
        problems.push(`tone: "${offence}" in ${notice.kind}`);
        continue;
      }

      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        JSON.stringify({ title: notice.title, body: notice.body, href: notice.href }),
      );

      // Stamped on the student's own state, because "one a day" is a fact about
      // them rather than about this run.
      await admin
        .from('plan_state')
        .update({ state: { ...state, lastNotifiedAt: now.toISOString() } })
        .eq('user_id', sub.user_id);

      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404 and 410 mean the browser threw this subscription away. Retrying it
      // daily forever is how a log becomes noise nobody reads.
      if (status === 404 || status === 410) {
        await admin
          .from('push_subscription')
          .update({ disabled_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint);
        problems.push(`gone: ${sub.endpoint.slice(-12)}`);
      } else {
        problems.push(`${status ?? 'error'}: ${(e as Error).message}`);
      }
    }
  }

  return NextResponse.json({
    subscriptions: subs?.length ?? 0,
    sent,
    quiet,
    problems,
    at: now.toISOString(),
  });
}
