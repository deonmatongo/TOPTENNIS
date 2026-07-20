import './config/index.js'   // validate env at boot — must be first
import express from 'express'
import { join } from 'node:path'
import { config } from './config/index.js'
import { validateTwilioSignature } from './middleware/validateTwilio.js'
import { inboundWhatsAppWebhook } from './controllers/whatsappWebhook.js'

const app = express()

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Twilio webhooks are sent as application/x-www-form-urlencoded.
// express.urlencoded must come BEFORE the signature validator.
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// ─── Landing ──────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Top Tennis Support</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1b1b2b 0%, #0d0d18 60%);
    color: #f4f4f8;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 520px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
  }
  .logo { font-size: 44px; line-height: 1; margin-bottom: 18px; }
  h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .sub { color: rgba(255,255,255,0.55); font-size: 14px; margin-top: 4px; }
  .badge {
    display: inline-flex; align-items: center; gap: 7px;
    margin-top: 20px; padding: 7px 14px;
    background: rgba(74,222,128,0.14); border: 1px solid rgba(74,222,128,0.35);
    color: #4ade80; border-radius: 999px; font-size: 13px; font-weight: 700;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: .45; transform: scale(1.5);} }
  .section-title { margin-top: 30px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,0.4); font-weight: 700; }
  ul { list-style: none; margin-top: 12px; display: grid; gap: 8px; }
  li {
    display: flex; align-items: center; gap: 10px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 12px 14px; font-size: 14px;
  }
  .m { font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 6px; letter-spacing: .5px; }
  .get { background: rgba(59,130,246,0.18); color: #93c5fd; }
  .post { background: rgba(255,85,0,0.18); color: #ff9a5c; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #f4f4f8; }
  .foot { margin-top: 26px; font-size: 12px; color: rgba(255,255,255,0.35); }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🎾</div>
    <h1>Top Tennis Support</h1>
    <div class="sub">WhatsApp customer-support webhook service</div>
    <div class="badge"><span class="dot"></span> Running · ${config.NODE_ENV}</div>

    <a href="/dashboard" style="display:block;margin-top:22px;text-align:center;text-decoration:none;background:#ff5500;color:#fff;font-weight:800;padding:14px;border-radius:14px;">Open Agent Console →</a>

    <div class="section-title">Endpoints</div>
    <ul>
      <li><span class="m get">GET</span><code>/health</code></li>
      <li><span class="m post">POST</span><code>/webhooks/whatsapp/inbound</code></li>
      <li><span class="m post">POST</span><code>/webhooks/whatsapp/status</code></li>
    </ul>

    <div class="foot">Local development mode — external APIs not connected.</div>
  </div>
</body>
</html>`)
})

// ─── Agent console (support dashboard) ────────────────────────────────────────
app.get('/dashboard', (_req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'dashboard.html'))
})

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'top-tennis-support', ts: new Date().toISOString() })
})

// ─── WhatsApp inbound webhook ─────────────────────────────────────────────────
// Order matters: validate signature first, then run controller
app.post(
  '/webhooks/whatsapp/inbound',
  validateTwilioSignature,
  inboundWhatsAppWebhook,
)

// ─── Twilio status callback (optional — tracks delivery failures) ─────────────
app.post('/webhooks/whatsapp/status', (req, res) => {
  const { MessageSid, MessageStatus, ErrorCode } = req.body as Record<string, string>
  if (ErrorCode) {
    console.error(`[status] ❌ Delivery failed — SID: ${MessageSid} Status: ${MessageStatus} Error: ${ErrorCode}`)
    // 63016 = message outside session window (you tried to send without a template)
    // 63038 = WhatsApp channel not enabled
  } else {
    console.log(`[status] SID: ${MessageSid} → ${MessageStatus}`)
  }
  res.sendStatus(204)
})

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`\n🎾 Top Tennis Support service running`)
  console.log(`   http://localhost:${config.PORT}`)
  console.log(`   Webhook: ${config.WEBHOOK_BASE_URL}/webhooks/whatsapp/inbound`)
  console.log(`   Environment: ${config.NODE_ENV}\n`)
})
