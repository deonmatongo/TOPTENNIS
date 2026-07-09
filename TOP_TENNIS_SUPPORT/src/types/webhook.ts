// Shape of Twilio's inbound WhatsApp webhook POST body (x-www-form-urlencoded).
// Twilio always sends strings — we parse/coerce in the controller.

export interface TwilioWhatsAppWebhook {
  // Core identifiers
  MessageSid:    string   // MM... — unique per message
  AccountSid:    string   // AC...
  From:          string   // "whatsapp:+263771234567"
  To:            string   // "whatsapp:+14155238886"

  // Message content
  Body:          string   // Plain text (empty string when media-only)
  NumMedia:      string   // "0", "1", "2" ...

  // Sender profile (populated when WhatsApp profile is public)
  ProfileName?:  string   // "John Doe"
  WaId?:         string   // "263771234567" — WA ID without +

  // Conversation-level metadata
  ButtonText?:   string   // Set when user taps a quick-reply button
  ButtonPayload?: string  // Payload attached to the button

  // Dynamic media fields — MediaUrl0…MediaUrl9, MediaContentType0…9
  [key: string]: string | undefined
}

// Parsed, typed version we pass around internally
export interface InboundMessage {
  messageSid:   string
  from:         string   // E.164, e.g. "+263771234567"
  fromRaw:      string   // original "whatsapp:+263771234567"
  to:           string   // E.164 of your Twilio number
  body:         string
  profileName:  string
  media:        MediaAttachment[]
  receivedAt:   Date
}

export interface MediaAttachment {
  index:       number
  url:         string   // Twilio CDN URL (requires Basic Auth to fetch)
  contentType: string   // "image/jpeg", "application/pdf", etc.
  category:    'image' | 'audio' | 'video' | 'document' | 'other'
}

// What our AI/triage service returns
export interface TriageResult {
  replyText:       string
  requiresHuman:   boolean   // true → escalate to live agent
  confidenceScore: number    // 0–1
  intent?:         string    // e.g. "billing_query", "match_dispute"
}

// Conversation state — stored so we can check the 24-hour session window
export interface ConversationState {
  from:            string
  lastUserMessage: Date    // most recent inbound message timestamp
  sessionOpen:     boolean // true if within SESSION_WINDOW_MS
}
