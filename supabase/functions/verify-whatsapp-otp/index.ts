// Supabase Edge Function — verify-whatsapp-otp
//
// Submits a code entered by the user to Twilio Verify and returns
// whether it is valid.  No auth required (pre-login flow).
//
// Request body:
//   { to: string (E.164), code: string (6 digits) }
//
// Response (200):
//   { valid: true }   — code correct and within TTL
//   { valid: false, error: string }  — wrong code / expired

const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!
const SERVICE_SID = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')!

const TWILIO_BASE  = `https://verify.twilio.com/v2/Services/${SERVICE_SID}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const E164_RE = /^\+[1-9]\d{7,14}$/
const CODE_RE = /^\d{6}$/

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

  let to: string, code: string
  try {
    const body = await req.json()
    to   = String(body.to   ?? '').trim()
    code = String(body.code ?? '').trim()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!E164_RE.test(to)) {
    return json({ error: 'Invalid phone number format' }, 422)
  }

  if (!CODE_RE.test(code)) {
    return json({ error: 'Code must be exactly 6 digits' }, 422)
  }

  const params = new URLSearchParams({ To: to, Code: code })

  let twilioRes: Response
  try {
    twilioRes = await fetch(`${TWILIO_BASE}/VerificationChecks`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${basicAuth()}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
  } catch (err) {
    console.error('[verify-whatsapp-otp] Network error calling Twilio:', err)
    return json({ error: 'Could not reach verification service. Try again.' }, 502)
  }

  const data = await twilioRes.json()

  if (!twilioRes.ok) {
    console.error('[verify-whatsapp-otp] Twilio error:', JSON.stringify(data))

    // 404 means the verification was never created or already expired/cancelled
    if (twilioRes.status === 404) {
      return json({ valid: false, error: 'Code expired or not found. Request a new one.' })
    }

    return json({ valid: false, error: data.message ?? 'Verification failed' })
  }

  if (data.status === 'approved' && data.valid === true) {
    return json({ valid: true })
  }

  // 'pending' means wrong code; 'canceled' or 'expired' means TTL passed
  const errorMessages: Record<string, string> = {
    pending:  'Incorrect code. Please try again.',
    canceled: 'This code has been cancelled. Request a new one.',
    expired:  'Code has expired. Request a new one.',
  }

  return json({
    valid:  false,
    error:  errorMessages[data.status] ?? 'Code could not be verified.',
  })
})
