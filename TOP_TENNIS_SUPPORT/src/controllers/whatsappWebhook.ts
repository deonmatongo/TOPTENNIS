import type { Request, Response } from 'express'
import type { TwilioWhatsAppWebhook, InboundMessage } from '../types/webhook.js'
import {
  recordInboundMessage,
  getSessionState,
  sendWhatsAppText,
  sendWhatsAppTemplate,
} from '../services/twilioClient.js'
import { triageMessage } from '../services/aiTriage.js'
import { parseMediaAttachments, logAttachments } from '../services/mediaHandler.js'

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks/whatsapp/inbound
//
// Twilio calls this URL synchronously and expects a 200 within ~15s.
// Strategy:
//   1. Parse + validate body immediately.
//   2. Respond 200 to Twilio right away (keeps the webhook healthy).
//   3. Kick off async processing (AI → reply) without blocking the response.
//
// This decouples Twilio's timeout from your LLM latency.
// ─────────────────────────────────────────────────────────────────────────────

export async function inboundWhatsAppWebhook(req: Request, res: Response): Promise<void> {

  // ── 1. Parse raw webhook body ─────────────────────────────────────────────
  const raw = req.body as TwilioWhatsAppWebhook

  // Basic sanity — Twilio always provides these fields
  if (!raw.From || !raw.MessageSid) {
    res.status(400).json({ error: 'Missing required Twilio fields' })
    return
  }

  // Strip "whatsapp:" prefix → plain E.164
  const from = raw.From.replace(/^whatsapp:/, '')
  const to   = raw.To.replace(/^whatsapp:/, '')

  // Parse media attachments (0–10 files)
  const media = parseMediaAttachments(raw)
  logAttachments(raw.MessageSid, media)

  // Structured message object passed to all downstream services
  const message: InboundMessage = {
    messageSid:  raw.MessageSid,
    from,
    fromRaw:     raw.From,
    to,
    body:        raw.Body ?? '',
    profileName: raw.ProfileName ?? from,
    media,
    receivedAt:  new Date(),
  }

  console.log(`[webhook] ← ${message.profileName} (${message.from}): "${message.body}"`, {
    messageSid: message.messageSid,
    mediaCount: media.length,
  })

  // ── 2. Record inbound message to refresh the 24-hour session clock ────────
  recordInboundMessage(from)

  // ── 3. Acknowledge Twilio immediately (empty TwiML = no auto-reply) ───────
  // Returning an empty <Response/> tells Twilio "received, handle it yourself"
  res.set('Content-Type', 'text/xml')
  res.status(200).send('<Response/>')

  // ── 4. Process asynchronously — runs after Twilio gets its 200 ───────────
  processMessage(message).catch(err => {
    console.error(`[webhook] Async processing failed for ${message.messageSid}:`, err)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Async message processor
// ─────────────────────────────────────────────────────────────────────────────

async function processMessage(message: InboundMessage): Promise<void> {
  // ── A. AI / LLM triage ────────────────────────────────────────────────────
  const triage = await triageMessage(message)

  console.log(`[triage] intent=${triage.intent ?? 'unknown'} confidence=${triage.confidenceScore} escalate=${triage.requiresHuman}`)

  // ── B. If human is needed, notify your agents (Chatwoot, Slack, etc.) ─────
  if (triage.requiresHuman) {
    await notifyHumanAgent(message, triage.replyText)
    // Still send the user an acknowledgement so they don't feel dropped
  }

  // ── C. Check the 24-hour Meta session window ──────────────────────────────
  const { open } = getSessionState(message.from)

  if (open) {
    // Session is open → free-form reply allowed
    await sendWhatsAppText({
      to:   message.from,
      body: triage.replyText,
    })
    console.log(`[webhook] → replied to ${message.from} (session open)`)
  } else {
    // Session closed → must use an approved template message.
    // Replace SUPPORT_REOPEN_TEMPLATE_SID with your Twilio ContentSid.
    const templateSid = process.env.SUPPORT_REOPEN_TEMPLATE_SID

    if (templateSid) {
      await sendWhatsAppTemplate({
        to:         message.from,
        templateSid,
        templateVariables: { 1: message.profileName },
      })
      console.log(`[webhook] → sent template to ${message.from} (session closed)`)
    } else {
      // No template configured → log and skip rather than error
      console.warn(`[webhook] Session closed for ${message.from} and no SUPPORT_REOPEN_TEMPLATE_SID set. Cannot reply.`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Human escalation bridge
//
// Plug in your notification mechanism:
//   - Chatwoot API (see docs/chatwoot-bridge.md)
//   - Supabase insert → DB trigger → push notification to agent app
//   - Slack webhook
// ─────────────────────────────────────────────────────────────────────────────

async function notifyHumanAgent(message: InboundMessage, summary: string): Promise<void> {
  // ── OPTION: Chatwoot API ──────────────────────────────────────────────────
  // const chatwootBaseUrl  = process.env.CHATWOOT_BASE_URL
  // const chatwootToken    = process.env.CHATWOOT_API_TOKEN
  // const accountId        = process.env.CHATWOOT_ACCOUNT_ID
  // const inboxId          = process.env.CHATWOOT_INBOX_ID
  //
  // if (chatwootBaseUrl && chatwootToken) {
  //   await fetch(`${chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations`, {
  //     method:  'POST',
  //     headers: { api_access_token: chatwootToken, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       inbox_id:   inboxId,
  //       contact_id: message.from,  // pre-create contact or use identifier
  //       additional_attributes: { summary, messageSid: message.messageSid },
  //     }),
  //   })
  // }

  // ── Placeholder: log escalation ───────────────────────────────────────────
  console.log(`[escalation] 🚨 Human agent needed for ${message.profileName} (${message.from})`)
  console.log(`[escalation] Summary: ${summary}`)
  console.log(`[escalation] Original message: "${message.body}"`)
}
