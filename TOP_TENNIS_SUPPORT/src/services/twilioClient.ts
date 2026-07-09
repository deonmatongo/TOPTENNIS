import twilio from 'twilio'
import { config } from '../config/index.js'

// Singleton — reuse the same authenticated client across all requests.
export const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)

// Formatted sender used in every outbound message
export const WA_FROM = `whatsapp:${config.TWILIO_WHATSAPP_FROM}`

// ─── Session window helpers ────────────────────────────────────────────────────
//
// Meta's 24-hour rule (enforced by all BSPs including Twilio):
//
//   • USER opens a session by sending a message.
//   • For the next 24h you can send FREE-FORM messages — billed as
//     "user-initiated conversations" (cheapest tier).
//   • After 24h of user inactivity the session CLOSES.
//   • To re-open contact you MUST use a pre-approved Template Message (HSM).
//     Billed as "business-initiated conversations" (more expensive).
//   • If you try to send a free-form message outside the window, Twilio
//     returns error 63016: "Message cannot be sent outside of session."
//
// Strategy implemented here:
//   1. We track lastUserMessage in memory (replace with Supabase for prod).
//   2. Before every outbound send we call getSessionState().
//   3. If sessionOpen  → send free-form reply.
//   4. If !sessionOpen → send an approved template instead.

const sessionStore = new Map<string, Date>()   // phone → last inbound timestamp

export function recordInboundMessage(from: string): void {
  sessionStore.set(from, new Date())
}

export function getSessionState(from: string): { open: boolean; lastMessage: Date | null } {
  const last = sessionStore.get(from) ?? null
  if (!last) return { open: false, lastMessage: null }
  const ageMs = Date.now() - last.getTime()
  return { open: ageMs < config.SESSION_WINDOW_MS, lastMessage: last }
}

// ─── Send helpers ──────────────────────────────────────────────────────────────

interface SendTextOptions {
  to:   string   // E.164, e.g. "+263771234567"
  body: string
}

/**
 * Sends a free-form WhatsApp reply.  Only call this when the session is open
 * (within 24h of last user message).
 */
export async function sendWhatsAppText({ to, body }: SendTextOptions) {
  return twilioClient.messages.create({
    from: WA_FROM,
    to:   `whatsapp:${to}`,
    body,
  })
}

interface SendTemplateOptions {
  to:              string   // E.164
  templateSid:     string   // Twilio ContentSid for the approved template
  templateVariables?: Record<string, string>
}

/**
 * Sends an approved HSM template message.  Required when the 24-hour session
 * has expired and you need to proactively contact the user.
 *
 * Templates must be approved by Meta via Twilio Console →
 * Messaging → Content Editor → Templates.
 */
export async function sendWhatsAppTemplate({ to, templateSid, templateVariables }: SendTemplateOptions) {
  return twilioClient.messages.create({
    from:        WA_FROM,
    to:          `whatsapp:${to}`,
    contentSid:  templateSid,
    contentVariables: templateVariables
      ? JSON.stringify(templateVariables)
      : undefined,
  })
}
