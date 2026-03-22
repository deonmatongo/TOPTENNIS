// Supabase Edge Function — send-push
// Reads all stored PushSubscription objects for a given user and delivers
// a Web Push message to every device using VAPID authentication.
//
// Environment variables required (set in Supabase dashboard → Edge Functions → Secrets):
//   VAPID_SUBJECT      e.g. "mailto:admin@toptennis.app"
//   VAPID_PUBLIC_KEY   BCepmTz4SJSYIMfo1thaqH_-lPXRtzInBVfQlkzQzaCNCFZHWfa2zAiM60mCPY2-5AKBuLvzcYlAkWUMOtQuCdk
//   VAPID_PRIVATE_KEY  BhLvKVjrJzAbTmt4laAbJRXppLpL0Plzy-38jnpf3Bw
//   SUPABASE_URL       (automatically provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY (automatically provided by Supabase)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

// ── VAPID configuration ───────────────────────────────────────────────────────
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@toptennis.app';
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? 'BCepmTz4SJSYIMfo1thaqH_-lPXRtzInBVfQlkzQzaCNCFZHWfa2zAiM60mCPY2-5AKBuLvzcYlAkWUMOtQuCdk';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? 'BhLvKVjrJzAbTmt4laAbJRXppLpL0Plzy-38jnpf3Bw';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ── Supabase client (service role — bypasses RLS to read subscriptions) ───────
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Allow only POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: {
    userId:    string;
    title:     string;
    body?:     string;
    tag?:      string;
    actionUrl?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  if (!body.userId || !body.title) {
    return new Response('Bad Request: missing userId or title', { status: 400 });
  }

  // Fetch all push subscriptions for this user
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', body.userId);

  if (error) {
    console.error('[send-push] Failed to fetch subscriptions:', error);
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.stringify({
    title:     body.title,
    body:      body.body   ?? '',
    tag:       body.tag    ?? String(Date.now()),
    actionUrl: body.actionUrl ?? '/dashboard',
  });

  // Fan out to all subscriptions in parallel
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );

  // Remove subscriptions that are no longer valid (410 Gone / 404)
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as any;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push(subs[i].endpoint);
      } else {
        console.warn('[send-push] Delivery failed for subscription:', err?.message);
      }
    }
  });

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[send-push] Delivered to ${sent}/${subs.length} subscriptions for user ${body.userId}`);

  return new Response(JSON.stringify({ sent, total: subs.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
