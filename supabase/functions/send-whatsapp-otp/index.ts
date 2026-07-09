// Supabase Edge Function — send-whatsapp-otp
//
// Calls Twilio Verify to dispatch an OTP via WhatsApp (or SMS fallback).
// No auth required — this is called during the pre-login signup flow.
//
// Required Supabase secrets (set via `supabase secrets set`):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_VERIFY_SERVICE_SID
//
// Request body:
//   { to: string (E.164), channel?: 'whatsapp' | 'sms' }

const ACCOUNT_SID  = Deno.env.get('TWILIO_ACCOUNT_SID')!
const AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN')!
const SERVICE_SID  = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!

const TWILIO_BASE  = `https://verify.twilio.com/v2/Services/${SERVICE_SID}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const E164_RE = /^\+[1-9]\d{7,14}$/

function basicAuth(): string {
  return btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let to: string, channel: string
  try {
    const body = await req.json()
    to      = String(body.to ?? '').trim()
    channel = body.channel === 'sms' ? 'sms' : 'whatsapp'
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!E164_RE.test(to)) {
    return json({ error: 'Phone number must be in E.164 format (e.g. +263771234567)' }, 422)
  }

  const params = new URLSearchParams({ To: to, Channel: channel })

  let twilioRes: Response
  try {
    twilioRes = await fetch(`${TWILIO_BASE}/Verifications`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${basicAuth()}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
  } catch (err) {
    console.error('[send-whatsapp-otp] Network error calling Twilio:', err)
    return json({ error: 'Could not reach verification service. Try again.' }, 502)
  }

  const data = await twilioRes.json()

  if (!twilioRes.ok) {
    console.error('[send-whatsapp-otp] Twilio error:', JSON.stringify(data))
    // Map common Twilio error codes to user-friendly messages
    const msg = TWILIO_ERROR_MAP[data.code] ?? data.message ?? 'Failed to send code'
    return json({ error: msg, twilioCode: data.code }, twilioRes.status >= 500 ? 502 : 422)
  }

  return json({ success: true, channel: data.channel, status: data.status })
})

const TWILIO_ERROR_MAP: Record<number, string> = {
  20003: 'Invalid Twilio credentials — contact support.',
  20404: 'Verification service not found — contact support.',
  21211: 'Invalid phone number.',
  21614: 'Phone number is not capable of receiving SMS.',
  60200: 'Invalid phone number.',
  60203: 'Max send attempts reached. Please wait before requesting a new code.',
  60212: 'Too many requests. Please wait before trying again.',
  63016: 'WhatsApp message failed. Use SMS as fallback.',
  63038: 'WhatsApp channel not enabled for this service.',
}
