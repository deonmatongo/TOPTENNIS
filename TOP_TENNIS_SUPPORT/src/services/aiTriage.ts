import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config/index.js'
import type { InboundMessage, MediaAttachment, TriageResult } from '../types/webhook.js'

// ─── Client ───────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a friendly customer support assistant for Top Tennis, a tennis league management platform serving players in Zimbabwe and Poland.

You help players with:
  - Match scheduling, rescheduling, and score disputes
  - League registration, standings, and division assignments
  - Account, billing, and subscription questions
  - Technical issues with the web app or mobile app
  - Venue/court bookings and availability

Tone: concise, sporty, warm. Always reply in 1–3 short sentences.
Never invent information you don't have — say "I'll pass this to a human agent" instead.
Do not repeat the user's message back to them.

If the issue is complex, the user is frustrated, or you cannot resolve it, end your reply with exactly this on its own line:
  ESCALATE: <one-sentence summary for the agent>

Otherwise do not include the word ESCALATE anywhere.
`.trim()

// ─── Conversation history (per sender, in-memory) ─────────────────────────────
// Kept in memory — survives restarts only while the process is up.
// For multi-instance deployments replace with Redis or a Supabase table.

type Turn = Anthropic.MessageParam

const MAX_HISTORY_TURNS = 10   // ~5 back-and-forth exchanges

const history = new Map<string, Turn[]>()

function getHistory(from: string): Turn[] {
  return history.get(from) ?? []
}

function appendHistory(from: string, role: 'user' | 'assistant', content: string): void {
  const turns = getHistory(from)
  turns.push({ role, content })
  // Trim oldest turns once we exceed the cap (always remove in pairs to keep roles balanced)
  while (turns.length > MAX_HISTORY_TURNS * 2) turns.splice(0, 2)
  history.set(from, turns)
}

export function clearHistory(from: string): void {
  history.delete(from)
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function callClaude(from: string, userContent: string): Promise<string> {
  appendHistory(from, 'user', userContent)

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system:     SYSTEM_PROMPT,
    messages:   getHistory(from),
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected non-text block from Claude')

  appendHistory(from, 'assistant', block.text)
  return block.text
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMediaContext(media: MediaAttachment[]): string {
  if (!media.length) return ''
  const summaries = media.map(m => `[${m.category}: ${m.contentType}]`).join(', ')
  return `\n\n[User also sent: ${summaries}]`
}

function parseEscalation(raw: string): { text: string; escalate: boolean } {
  const lines  = raw.split('\n')
  const escIdx = lines.findIndex(l => /^ESCALATE:/i.test(l.trim()))

  if (escIdx === -1) return { text: raw.trim(), escalate: false }

  const summary  = lines[escIdx].replace(/^ESCALATE:\s*/i, '').trim()
  const bodyLines = lines.filter((_, i) => i !== escIdx).join('\n').trim()

  const userText = bodyLines
    || `I'm passing your case to a live agent now. They'll follow up shortly about: "${summary}"`

  return { text: userText, escalate: true }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function triageMessage(msg: InboundMessage): Promise<TriageResult> {
  const lower = msg.body.toLowerCase().trim()

  // Hard keyword overrides — no LLM call needed
  if (['agent', 'human', 'help', '0'].includes(lower)) {
    return {
      replyText:       'Connecting you to a live agent now. 🎾 Someone will respond within 5 minutes.',
      requiresHuman:   true,
      confidenceScore: 1,
      intent:          'escalation_request',
    }
  }

  const userContent = msg.body + buildMediaContext(msg.media)
  let rawReply: string

  try {
    rawReply = await callClaude(msg.from, userContent)
  } catch (err) {
    console.error('[aiTriage] Claude API error:', err)
    // Fail gracefully — escalate to human rather than returning an error to the user
    return {
      replyText:       "Sorry, I'm having a moment! 🎾 Let me get a human agent for you right away.",
      requiresHuman:   true,
      confidenceScore: 0,
      intent:          'llm_error',
    }
  }

  const { text, escalate } = parseEscalation(rawReply)

  return {
    replyText:       text,
    requiresHuman:   escalate,
    confidenceScore: escalate ? 0.3 : 0.9,
    intent:          undefined,
  }
}
