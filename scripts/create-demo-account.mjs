/**
 * Creates the App Review demo account in the production Supabase database.
 * Uses plain fetch — no npm dependencies required.
 *
 * Auth model: email + password + username + security question (matches
 * TOP_TENNIS_MOBILE/src/contexts/AuthContext.tsx signUp/claimProfile flow).
 * `claim_username` and `set_security_answer` are SECURITY DEFINER RPCs that
 * require the *user's own* access token (they read auth.uid()) — there is no
 * service-role bypass, so this script signs in as the newly created user to
 * call them, exactly like the real signup flow does.
 *
 * Set environment variables before running (copy scripts/.env.example → scripts/.env):
 *   SUPABASE_SERVICE_ROLE_KEY   Service-role JWT from Settings → API
 *   DEMO_EMAIL                  Email for the demo account (e.g. appreviewer@toptennis.app)
 *   DEMO_PASSWORD               Demo account password
 *   DEMO_SECURITY_ANSWER        (optional) answer to the seeded security question
 *
 * Run:
 *   node --env-file=scripts/.env scripts/create-demo-account.mjs
 *   # or: export the vars in your shell, then: node scripts/create-demo-account.mjs
 */

const SUPABASE_URL = 'https://qrhladnnblgbobcnxjsz.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_EMAIL = process.env.DEMO_EMAIL
const DEMO_PASSWORD = process.env.DEMO_PASSWORD
const DEMO_USERNAME = 'appreviewer'
// Must be one of TOP_TENNIS_MOBILE/src/constants/securityQuestions.ts (server
// accepts any text, but the app's own UI only ever offers these).
const DEMO_SECURITY_QUESTION = 'What was the name of your first pet?'
const DEMO_SECURITY_ANSWER = process.env.DEMO_SECURITY_ANSWER || 'Rex'

if (!SERVICE_ROLE_KEY || !DEMO_EMAIL || !DEMO_PASSWORD) {
  console.error(
    'Missing required environment variables.\n' +
    'Set SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL, and DEMO_PASSWORD.\n' +
    'See scripts/.env.example.',
  )
  process.exit(1)
}

const serviceHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
}

async function api(path, { method = 'GET', body, headers = serviceHeaders } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { ok: res.ok, status: res.status, json }
}

async function main() {
  console.log(`Creating demo account: email=${DEMO_EMAIL}, username=${DEMO_USERNAME}\n`)

  // 1. Refuse to clobber an existing account silently — this script only
  //    creates a brand-new demo account. If "appreviewer" is already taken
  //    (e.g. by the old phone-based demo account), delete it manually first
  //    via the Supabase dashboard (Authentication → Users) and re-run.
  const check = await api(`/rest/v1/profiles?username=eq.${DEMO_USERNAME}&select=id`)
  if (check.ok && Array.isArray(check.json) && check.json.length > 0) {
    console.error(`ERROR: username "${DEMO_USERNAME}" already exists (id=${check.json[0].id}).`)
    console.error('Delete that auth user first (Supabase dashboard → Authentication → Users), then re-run.')
    process.exit(1)
  }

  // 2. Create the auth user with email + password, pre-confirmed.
  const createUser = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true },
  })

  if (!createUser.ok) {
    const msg = JSON.stringify(createUser.json).toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      console.error(`ERROR: email ${DEMO_EMAIL} is already registered to another account.`)
    } else {
      console.error('ERROR creating auth user:', JSON.stringify(createUser.json))
    }
    process.exit(1)
  }

  const uid = createUser.json.id
  console.log(`✓ Auth user created: id=${uid}`)

  // 3. Sign in as the new user — claim_username and set_security_answer are
  //    SECURITY DEFINER RPCs keyed off auth.uid(), which is only populated
  //    when called with the user's own access token (service role has none).
  const signIn = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  })

  if (!signIn.ok || !signIn.json.access_token) {
    console.error('ERROR signing in as new demo user:', JSON.stringify(signIn.json))
    process.exit(1)
  }

  const userHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${signIn.json.access_token}`,
    'apikey': SERVICE_ROLE_KEY,
  }
  console.log('✓ Signed in as new user to obtain access token')

  // 4. Claim the username via RPC (validates format + uniqueness server-side).
  const claimUsername = await api('/rest/v1/rpc/claim_username', {
    method: 'POST',
    body: { p_username: DEMO_USERNAME },
    headers: userHeaders,
  })

  if (!claimUsername.ok) {
    console.error('ERROR claiming username:', JSON.stringify(claimUsername.json))
    process.exit(1)
  }
  console.log(`✓ Username claimed: "${DEMO_USERNAME}"`)

  // 5. Seed a security answer so "Forgot password" is also demoable.
  const setSecurityAnswer = await api('/rest/v1/rpc/set_security_answer', {
    method: 'POST',
    body: { p_question: DEMO_SECURITY_QUESTION, p_answer: DEMO_SECURITY_ANSWER },
    headers: userHeaders,
  })

  if (!setSecurityAnswer.ok) {
    console.error('ERROR setting security answer:', JSON.stringify(setSecurityAnswer.json))
    process.exit(1)
  }
  console.log('✓ Security question/answer set')

  // 6. Verify the login path end-to-end exactly as the app does it.
  console.log('\nVerifying login via signInWithPassword...')
  const verifyLogin = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  })

  if (!verifyLogin.ok || !verifyLogin.json.access_token) {
    console.error('ERROR: login verification failed:', JSON.stringify(verifyLogin.json))
    console.error('Account created but login path returned an error — investigate above.')
    process.exit(1)
  }

  console.log('✓ Login verified successfully.\n')
  console.log('=== Demo account ready ===')
  console.log(`  Email    : ${DEMO_EMAIL}`)
  console.log(`  Password : ${DEMO_PASSWORD}`)
  console.log(`  Username : ${DEMO_USERNAME}`)
  console.log(`  User ID  : ${uid}`)
  console.log(`  Security Q: ${DEMO_SECURITY_QUESTION}`)
  console.log(`  Security A: ${DEMO_SECURITY_ANSWER}`)
  console.log('\nUpdate App Store Connect → App Review Information:')
  console.log(`  Username field : ${DEMO_EMAIL}`)
  console.log('  Password field : (the DEMO_PASSWORD you set)')
  console.log('  Notes          : This app uses email + password login. Enter the')
  console.log('                   email above in the "Email" field on the sign-in screen.')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
