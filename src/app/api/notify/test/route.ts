/**
 * POST /api/notify/test  →  one notification, now, to the signed-in student's
 * own devices.
 *
 * Delivery had never been seen working end to end: the cron decides, and most
 * of the time correctly says nothing, so a student turning notifications on
 * had no way to know whether anything would ever arrive. This sends one on a
 * tap, from Settings, so the whole chain (permission, subscription, keys, the
 * push service, the service worker) is proven in ten seconds.
 *
 * Runs as the student, with their own token: RLS limits it to their own
 * subscriptions. No service-role key here.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!url || !anon || !pub || !priv) {
    return NextResponse.json({ error: 'Notifications are not configured on the server.' }, { status: 503 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: user } = await db.auth.getUser(token);
  if (!user.user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });

  const { data: subs, error } = await db
    .from('push_subscription')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', user.user.id)
    .is('disabled_at', null);
  if (error) return NextResponse.json({ error: 'Could not read your devices.' }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ error: 'No device has notifications on yet.' }, { status: 404 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:bmwother1@gmail.com', pub, priv);
  let sent = 0;
  const failed: number[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
        JSON.stringify({ title: 'Heron is set up', body: 'This is what a heads-up looks like. The next one comes 15 minutes before a block.', href: '/week' }),
      );
      sent += 1;
    } catch (e) {
      failed.push((e as { statusCode?: number }).statusCode ?? 0);
    }
  }
  return NextResponse.json({ sent, failed });
}
