import { config } from '../config/index.js'
import type { MediaAttachment, TwilioWhatsAppWebhook } from '../types/webhook.js'

// ─────────────────────────────────────────────────────────────────────────────
// Media Handler
//
// Twilio stores inbound media on its CDN behind Basic Auth.
// This module:
//   1. Parses attachment metadata from the raw webhook body.
//   2. Optionally downloads and saves media (extend for S3/Supabase Storage).
//   3. Generates a proxied download URL for agent use.
// ─────────────────────────────────────────────────────────────────────────────

type MediaCategory = MediaAttachment['category']

function categorise(contentType: string): MediaCategory {
  if (contentType.startsWith('image/'))              return 'image'
  if (contentType.startsWith('audio/'))              return 'audio'
  if (contentType.startsWith('video/'))              return 'video'
  if (
    contentType === 'application/pdf' ||
    contentType.startsWith('application/vnd') ||
    contentType.startsWith('application/msword') ||
    contentType.startsWith('text/')
  ) return 'document'
  return 'other'
}

/**
 * Extracts up to 10 media attachments from the raw Twilio webhook payload.
 * Twilio sends MediaUrl0…MediaUrl9 and MediaContentType0…9 as form fields.
 */
export function parseMediaAttachments(body: TwilioWhatsAppWebhook): MediaAttachment[] {
  const count = parseInt(body.NumMedia ?? '0', 10)
  const attachments: MediaAttachment[] = []

  for (let i = 0; i < Math.min(count, 10); i++) {
    const url         = body[`MediaUrl${i}`]
    const contentType = body[`MediaContentType${i}`]

    if (!url || !contentType) continue

    attachments.push({
      index:       i,
      url,
      contentType,
      category:    categorise(contentType),
    })
  }

  return attachments
}

/**
 * Downloads a Twilio-hosted media file using Basic Auth.
 * Returns the raw ArrayBuffer — pipe to S3/Supabase Storage as needed.
 *
 * Usage:
 *   const buffer = await downloadMedia(attachment.url)
 *   await supabase.storage.from('support-media').upload(key, buffer)
 */
export async function downloadMedia(twilioMediaUrl: string): Promise<ArrayBuffer> {
  const credentials = btoa(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`)
  const res = await fetch(twilioMediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to download media: HTTP ${res.status} from ${twilioMediaUrl}`)
  }

  return res.arrayBuffer()
}

/**
 * Logs attachment metadata — replace with your storage pipeline.
 * Called immediately on inbound so the agent can see what was sent
 * before the async download completes.
 */
export function logAttachments(messageSid: string, attachments: MediaAttachment[]): void {
  if (attachments.length === 0) return

  console.log(`[media] ${messageSid} — ${attachments.length} attachment(s):`)
  attachments.forEach(a => {
    console.log(`  [${a.index}] ${a.category} (${a.contentType}) → ${a.url}`)
  })
}
