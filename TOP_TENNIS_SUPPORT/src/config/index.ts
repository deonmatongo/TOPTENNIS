import 'dotenv/config'
import { z } from 'zod'

// Validate all required env vars at startup — fail fast before any I/O.
const schema = z.object({
  TWILIO_ACCOUNT_SID:    z.string().startsWith('AC', { message: 'Must start with AC' }),
  TWILIO_AUTH_TOKEN:     z.string().min(32),
  TWILIO_WHATSAPP_FROM:  z.string().startsWith('+', { message: 'Must be E.164' }),
  WEBHOOK_BASE_URL:      z.string().url(),
  SESSION_WINDOW_MS:     z.coerce.number().default(86_400_000),
  PORT:                  z.coerce.number().default(3001),
  NODE_ENV:              z.enum(['development', 'production', 'test']).default('development'),

  // Optional — only required when using Chatwoot bridge
  CHATWOOT_BASE_URL:     z.string().url().optional(),
  CHATWOOT_API_TOKEN:    z.string().optional(),
  CHATWOOT_ACCOUNT_ID:   z.coerce.number().optional(),
  CHATWOOT_INBOX_ID:     z.coerce.number().optional(),

  // Optional AI keys
  OPENAI_API_KEY:        z.string().optional(),
  ANTHROPIC_API_KEY:     z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n')
  parsed.error.issues.forEach(i => console.error(`   ${i.path.join('.')}: ${i.message}`))
  process.exit(1)
}

export const config = parsed.data
