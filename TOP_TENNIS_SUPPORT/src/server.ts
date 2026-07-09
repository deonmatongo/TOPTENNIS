import './config/index.js'   // validate env at boot — must be first
import express from 'express'
import { config } from './config/index.js'
import { validateTwilioSignature } from './middleware/validateTwilio.js'
import { inboundWhatsAppWebhook } from './controllers/whatsappWebhook.js'

const app = express()

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Twilio webhooks are sent as application/x-www-form-urlencoded.
// express.urlencoded must come BEFORE the signature validator.
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

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
