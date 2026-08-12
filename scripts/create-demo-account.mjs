/**
 * Creates the App Review demo account in the production Supabase database.
 * Uses plain fetch — no npm dependencies required.
 *
 * Set environment variables before running (copy scripts/.env.example → scripts/.env):
 *   SUPABASE_SERVICE_ROLE_KEY   Service-role JWT from Settings → API
 *   DEMO_PHONE                  E.164 phone for the demo account (e.g. +11234567890)
 *   DEMO_PASSWORD               Demo account password
 *
 * Run:
 *   node --env-file=scripts/.env scripts/create-demo-account.mjs
 *   # or: export the vars in your shell, then: node scripts/create-demo-account.mjs
 */

const SUPABASE_URL = 'https://qrhladnnblgbobcnxjsz.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_PHONE = process.env.DEMO_PHONE
const DEMO_PASSWORD = process.env.DEMO_PASSWORD
const DEMO_USERNAME = 'appreviewer'

if (!SERVICE_ROLE_KEY || !DEMO_PHONE || !DEMO_PASSWORD) {
  console.error(
    'Missing required environment variables.\n' +
    'Set SUPABASE_SERVICE_ROLE_KEY, DEMO_PHONE, and DEMO_PASSWORD.\n' +
    'See scripts/.env.example.',
  )
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
}

async function api(path, { method = 'GET', body, extraHeaders = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  console.log(`Creating demo account: username=${DEMO_USERNAME}, phone=${DEMO_PHONE}\n`)

  // 1. Check if username is already taken.
  const check = await api(`/rest/v1/profiles?username=eq.${DEMO_USERNAME}&select=id&limit=1`)
  if (check.ok && Array.isArray(check.json) && check.json.length > 0) {
    console.error(`ERROR: username "${DEMO_USERNAME}" already exists (id=${check.json[0].id}).`)
    console.error('Delete it first or update the password on the existing account.')
    process.exit(1)
  }

  // 2. Create the auth user with phone + password, marking the phone as
  //    confirmed so login works without a real OTP round-trip.
  const createUser = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: { phone: DEMO_PHONE, password: DEMO_PASSWORD, phone_confirm: true },
  })

  if (!createUser.ok) {
    const msg = JSON.stringify(createUser.json).toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      console.error(`ERROR: phone ${DEMO_PHONE} is already registered to another account.`)
    } else {
      console.error('ERROR creating auth user:', JSON.stringify(createUser.json))
    }
    process.exit(1)
  }

  const uid = createUser.json.id
  console.log(`✓ Auth user created: id=${uid}`)

  // 3. The handle_new_user trigger fires automatically and creates the profiles
  //    row. Set the username on it.
  const setUsername = await api(`/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    body: { username: DEMO_USERNAME },
    extraHeaders: { 'Prefer': 'return=minimal' },
  })

  if (!setUsername.ok) {
    console.error('ERROR setting username on profiles:', JSON.stringify(setUsername.json))
    process.exit(1)
  }
  console.log(`✓ profiles.username set to "${DEMO_USERNAME}"`)

  // 4. Insert the phone identity record. This is what resolve_phone_for_identifier()
  //    queries at login time — without it the username -> phone lookup returns null
  //    and every login attempt fails.
  const insertPhone = await api('/rest/v1/user_phone_identities', {
    method: 'POST',
    body: { user_id: uid, phone_e164: DEMO_PHONE, verified_at: new Date().toISOString() },
    extraHeaders: { 'Prefer': 'return=minimal' },
  })

  if (!insertPhone.ok) {
    console.error('ERROR inserting user_phone_identities:', JSON.stringify(insertPhone.json))
    process.exit(1)
  }
  console.log(`✓ user_phone_identities row created for ${DEMO_PHONE}`)

  // 5. Verify the login path end-to-end via the live Edge Function.
  console.log('\nVerifying login via login-with-username...')
  const loginRes = await fetch(`${SUPABASE_URL}/functions/v1/login-with-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: DEMO_USERNAME, password: DEMO_PASSWORD }),
  })
  const loginBody = await loginRes.json()

  if (!loginRes.ok || !loginBody.session) {
    console.error('ERROR: login verification failed:', JSON.stringify(loginBody))
    console.error('Account created but login path returned an error — investigate above.')
    process.exit(1)
  }

  console.log('✓ Login verified successfully.\n')
  console.log('=== Demo account ready ===')
  console.log(`  Username : ${DEMO_USERNAME}`)
  console.log(`  Password : ${DEMO_PASSWORD}`)
  console.log(`  Phone    : ${DEMO_PHONE}`)
  console.log(`  User ID  : ${uid}`)
  console.log('\nUpdate App Store Connect → App Review Information:')
  console.log('  Username field : appreviewer')
  console.log('  Password field : (the DEMO_PASSWORD you set)')
  console.log('  Notes          : This app uses username + password login (not email).')
  console.log('                   Enter "appreviewer" in the username field exactly as shown.')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
