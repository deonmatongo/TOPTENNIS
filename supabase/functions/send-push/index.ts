// Supabase Edge Function — send-push
// Called by the notify_push_on_notification_insert DB trigger after every
// notifications row INSERT. Looks up the user's Expo push token from the
// profiles table and delivers the notification via the Expo Push API.
//
// Deploy with:
//   supabase functions deploy send-push --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/exponent-apis/push/send'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Verify caller provides the anon key — limits abuse while keeping trigger simple
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const bearer  = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (anonKey && bearer !== anonKey) {
    return new Response('Unauthorized', { status: 401 })
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
  }

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(pushMessage),
  })

  const result = await expoRes.json()

  // Log delivery errors from Expo
  const tickets = Array.isArray(result.data) ? result.data : [result]
  for (const ticket of tickets) {
    if (ticket.status === 'error') {
      console.error('[send-push] Expo delivery error:', JSON.stringify(ticket))
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
