// Supabase Edge Function — send-push
// Called by the notify_push_on_notification_insert DB trigger after every
// notifications row INSERT. Looks up the user's Expo push token from the
// profiles table and delivers the notification via the Expo Push API.
//
// Deploy with:
//   supabase functions deploy send-push --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://api.expo.dev/v2/push/send'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Trigger sends camelCase (userId, body) — also accept snake_case
  const userId   = (body.userId   ?? body.user_id)  as string | undefined
  const title    = body.title                         as string | undefined
  const message  = (body.body     ?? body.message)   as string | undefined
  const type     = (body.type     ?? 'general')       as string
  const metadata = (body.metadata ?? {})              as Record<string, unknown>

  if (!userId || !title) {
    return new Response('Missing required fields', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Respect the user's notification preferences ─────────────────────────────
  // app_settings is RLS-private to its owner, but the service-role client here can
  // read it. Skip delivery when the master push switch is off, or when the toggle
  // for this notification's category is off. Unknown types are always allowed.
  const CATEGORY_COLUMN: Record<string, string> = {
    friend_request:   'friend_requests',
    friend_accepted:  'friend_requests',
    match_invite:     'match_invites',
    match_accepted:   'match_accepted',
    match_confirmed:  'match_accepted',
    match_declined:   'match_declined',
    match_cancelled:  'match_declined',
    match_rescheduled:'match_reminders',
    match_scheduled:  'match_reminders',
    match_reminder:   'match_reminders',
    score_reminder:   'match_reminders',
    match_result:     'score_confirmed',
    message_received: 'messages',
    league_update:    'league_updates',
    achievement:      'achievements',
    score_submitted:  'score_submitted',
    score_confirmed:  'score_confirmed',
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('push_enabled, match_invites, match_reminders, match_accepted, match_declined, league_updates, score_submitted, score_confirmed, friend_requests, messages, achievements')
    .eq('user_id', userId)
    .maybeSingle()

  // Opt-out model: if there's no settings row yet, default to sending.
  if (settings) {
    if (settings.push_enabled === false) {
      return new Response(JSON.stringify({ skipped: 'push disabled' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const column = CATEGORY_COLUMN[type]
    if (column && (settings as Record<string, unknown>)[column] === false) {
      return new Response(JSON.stringify({ skipped: `category '${type}' disabled` }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single()

  if (!profile?.push_token) {
    return new Response(JSON.stringify({ skipped: 'no push token' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pushMessage = {
    to: profile.push_token,
    sound: 'default',
    title,
    body: message ?? '',
    data: { type, ...metadata },
    badge: 1,
    channelId: 'default',
    // 'high' maps to apns-priority:10 (immediate delivery) on iOS and
    // FCM high priority on Android. Without this, Apple/Google are allowed
    // to batch and delay the notification — the main cause of "minutes late"
    // delivery. Only omit for non-urgent background syncs.
    priority: 'high',
    // ttl:0 means deliver now-or-never rather than queuing for hours. Safe
    // for match invites and chat messages; adjust per notification type if
    // you add a background-sync category later.
    ttl: 0,
  }

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(pushMessage),
  })

  let result: Record<string, unknown>
  try {
    result = await expoRes.json()
  } catch {
    const text = await expoRes.text()
    return new Response(JSON.stringify({ error: 'Non-JSON response from Expo', raw: text }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // v2 API wraps the ticket in { data: {...} }
  const ticket = result.data as Record<string, unknown> | undefined
  if (ticket?.status === 'error') {
    console.error('[send-push] Expo delivery error:', JSON.stringify(ticket))
    // Auto-clear stale/invalid tokens so we don't keep retrying
    const errCode = (ticket.details as any)?.error
    if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
      await supabase.from('profiles').update({ push_token: null }).eq('id', userId)
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
