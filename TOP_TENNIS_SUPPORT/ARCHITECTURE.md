# WhatsApp Customer Support — Architecture Guide

## Overview

Two separate scenarios, same Twilio number:

```
User (WhatsApp)
      │
      ▼
 Twilio BSP ──── Inbound Webhook ──────┬─────────────────────────────────
                                       │                                  │
                               Scenario 1                         Scenario 2
                          Chatwoot Direct Route             Custom Node.js AI Triage
                               │                                  │
                    Chatwoot auto-creates             Express controller parses
                    conversation + assigns            message → LLM → auto-reply
                    to available agent                or escalates to human
```

---

## Scenario 1 — Chatwoot Direct Integration

### What Chatwoot Does

Chatwoot is an open-source omnichannel helpdesk (MIT licence).
It ships with native **Twilio WhatsApp inbox** support — no custom code needed.

### Setup Steps

**Step 1 — Self-host or use Chatwoot Cloud**
```bash
# Docker (self-hosted)
docker run -d -p 3000:3000 \
  -e SECRET_KEY_BASE=$(openssl rand -hex 64) \
  -e POSTGRES_DATABASE_URL=postgres://... \
  chatwoot/chatwoot:latest bundle exec rails s
```

**Step 2 — Create a WhatsApp inbox in Chatwoot**

Chatwoot UI → Settings → Inboxes → New Inbox → WhatsApp

Fill in:
| Field | Value |
|---|---|
| Inbox Name | Top Tennis Support |
| Phone number | Your Twilio WhatsApp sender (+1...) |
| Account SID | `TWILIO_ACCOUNT_SID` |
| Auth Token | `TWILIO_AUTH_TOKEN` |

Chatwoot will generate a webhook URL like:
```
https://your-chatwoot.com/twilio/callback
```

**Step 3 — Point Twilio at Chatwoot**

Twilio Console → Messaging → Senders → WhatsApp Senders
→ Your number → Configure → Webhook URL:

```
https://your-chatwoot.com/twilio/callback   ← Chatwoot's URL
```

HTTP Method: POST  
That's it — Twilio forwards every inbound message directly to Chatwoot.

**Step 4 — Assign agents**

Chatwoot Settings → Agents → Invite → assign to the WhatsApp inbox team.
Agents see a live inbox with conversation history, can type replies,
and Chatwoot sends them back via Twilio automatically.

---

## The 24-Hour Meta Session Window

This is the single most important billing/UX rule in WhatsApp Business.

```
T+0h    User sends message → SESSION OPENS
T+0h    Agent / bot can reply freely (free-form messages) ← cheapest
T+23h   Agent can still reply freely
T+24h   SESSION CLOSES ← last user message was 24h ago
T+25h   Agent tries to reply → ERROR 63016
         Twilio returns: "Message cannot be sent outside of session"
```

### Cost Tiers (Meta pricing, via Twilio)

| Type | Trigger | Example | Cost |
|---|---|---|---|
| **User-initiated** | User messages first | Support reply within 24h | $0.005–$0.015/conversation |
| **Business-initiated** | You message first (or after window) | Proactive outreach or late reply | $0.01–$0.05/conversation |

Business-initiated always requires a **pre-approved Template Message (HSM)**.

### What Happens When an Agent Responds Late (>24h)

**Without a template configured:**
- Agent types a reply in Chatwoot
- Chatwoot sends it to Twilio
- Twilio returns 63016 error
- The message is **silently dropped** (or Chatwoot shows a delivery error)
- The user never sees it

**With a template configured (correct approach):**

```
Agent's delayed reply
       │
       ▼
  Detect session closed  ──────────────────────────────────────────►
       │                                                            │
       ▼                                               Twilio sends approved template:
  Send template instead                               "Hi {{1}}, we got your message
       │                                               about {{2}}. Reply to continue."
       ▼
  User replies → session reopens → free-form again
```

### Creating a Re-open Template in Twilio

Twilio Console → Messaging → Content Editor → Create Template

```
Template name:   support_reopen
Category:        UTILITY
Language:        English

Body:
Hi {{1}}! 👋 Our Top Tennis support team is following up on your query
about {{2}}. Reply to this message to continue the conversation.
```

After Meta approves (24–48h), copy the **Content SID** (`HX...`) 
and set it as `SUPPORT_REOPEN_TEMPLATE_SID` in your `.env`.

### Chatwoot Agent Warning Banner

Chatwoot has a built-in banner: when a conversation is outside the
24h window, agents see a yellow warning before sending. This is the
UI hint to use a template. No extra config needed.

---

## Scenario 2 — Custom Express AI-Triage Backend

### Request Flow

```
User sends WhatsApp message
         │
         ▼
    Twilio BSP
         │ POST (x-www-form-urlencoded)
         ▼
 POST /webhooks/whatsapp/inbound
         │
   validateTwilioSignature  ← HMAC-SHA1 check (security gate)
         │
   inboundWhatsAppWebhook
         │
         ├─ Parse body → InboundMessage
         ├─ Parse media attachments (0–10 files)
         ├─ recordInboundMessage() → refresh session clock
         ├─ res.send('<Response/>')  ← 200 to Twilio immediately
         │
         └─ processMessage() [async, after response sent]
                │
                ├─ triageMessage() → callLLM()
                │       └─ [ plug in OpenAI / Claude / Ollama here ]
                │
                ├─ if requiresHuman → notifyHumanAgent()
                │
                └─ getSessionState()
                        ├─ open  → sendWhatsAppText()
                        └─ closed → sendWhatsAppTemplate()
```

### Media Attachment Handling

Twilio sends media as CDN URLs in the webhook body:

```
NumMedia=2
MediaUrl0=https://api.twilio.com/2010-04-01/.../Media/ME...
MediaContentType0=image/jpeg
MediaUrl1=https://api.twilio.com/2010-04-01/.../Media/ME...
MediaContentType1=application/pdf
```

**Important:** These URLs require Twilio Basic Auth to download.
`downloadMedia()` in `src/services/mediaHandler.ts` handles this.

To store them permanently (Twilio purges after ~4h):
```typescript
// In processMessage(), after triageMessage():
for (const attachment of message.media) {
  const buffer = await downloadMedia(attachment.url)
  const key = `support/${message.messageSid}/${attachment.index}`
  await supabase.storage.from('support-media').upload(key, buffer, {
    contentType: attachment.contentType,
  })
}
```

### Plugging in an LLM

Edit `src/services/aiTriage.ts` → `callLLM()`.  
Two provider options are commented in — uncomment one and install the SDK:

```bash
# OpenAI
npm install openai

# Anthropic Claude  
npm install @anthropic-ai/sdk
```

The controller and session-window logic remain unchanged.

---

## Deployment

### Dev (ngrok tunnel)

```bash
# Terminal 1 — run the service
cd TOP_TENNIS_SUPPORT
cp .env.example .env
# fill in TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
npm install
npm run dev

# Terminal 2 — expose localhost to the internet
ngrok http 3001
# Copy the https://abc123.ngrok.io URL

# Update .env
WEBHOOK_BASE_URL=https://abc123.ngrok.io

# Update Twilio Console → WhatsApp sender → webhook:
# https://abc123.ngrok.io/webhooks/whatsapp/inbound
```

### Production (fly.io or Railway)

```bash
# fly.io
fly launch --name top-tennis-support
fly secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_WHATSAPP_FROM=+1...
fly deploy
```

Set `WEBHOOK_BASE_URL` to your deployed domain and update Twilio Console.

### Twilio Console — Webhook Configuration

Messaging → Senders → WhatsApp Senders → your number → Configure:

| Field | Value |
|---|---|
| A message comes in | `https://your-domain.com/webhooks/whatsapp/inbound` — HTTP POST |
| Status callback URL | `https://your-domain.com/webhooks/whatsapp/status` — HTTP POST |

The status callback catches delivery failures including error 63016
(message outside session window).

---

## Shared Twilio Credentials

Both the OTP Supabase Edge Functions and this support service use the same
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. They operate on different
Twilio sub-products:

| Service | Twilio Product | Key Secret |
|---|---|---|
| OTP (Edge Functions) | Verify API | `TWILIO_VERIFY_SERVICE_SID` |
| Support (this service) | Messaging API | `TWILIO_WHATSAPP_FROM` |

Keep both sets of secrets separate — the Verify SID is never needed here,
and `TWILIO_WHATSAPP_FROM` is never needed in the Edge Functions.
