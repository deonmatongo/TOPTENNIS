import type { InboundMessage, MediaAttachment, TriageResult } from '../types/webhook.js'

// ─────────────────────────────────────────────────────────────────────────────
// AI / LLM Triage Service
//
// This module is a CLEAN PLUG-IN POINT.  Swap the placeholder body of
// `callLLM()` for your chosen provider (OpenAI, Anthropic, local Ollama, etc.)
// without touching the controller.
//
// CONTRACT:
//   Input  → user message text + optional media context
//   Output → TriageResult { replyText, requiresHuman, confidenceScore, intent }
// ─────────────────────────────────────────────────────────────────────────────

// System prompt — edit to match your support persona and Top Tennis domain.
const SYSTEM_PROMPT = `
You are a friendly customer support assistant for Top Tennis, a tennis league management platform.
You help players with:
  - Match scheduling and score disputes
  - League registration and standings
  - Account and billing questions
  - Technical issues with the app

Tone: concise, sporty, helpful. Max 3 sentences per reply.

If you cannot resolve the issue or the user is upset, reply with exactly:
  ESCALATE: <one-sentence summary of the issue>
This signals to route the conversation to a human agent.
`.trim()

// ─── Provider placeholder ─────────────────────────────────────────────────────

async function callLLM(userMessage: string): Promise<string> {
  // ── OPTION A: OpenAI ────────────────────────────────────────────────────────
  // import OpenAI from 'openai'
  // const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  // const res = await client.chat.completions.create({
  //   model: 'gpt-4o-mini',
  //   messages: [
  //     { role: 'system',  content: SYSTEM_PROMPT },
  //     { role: 'user',    content: userMessage   },
  //   ],
  //   max_tokens: 200,
  // })
  // return res.choices[0].message.content ?? ''

  // ── OPTION B: Anthropic Claude ─────────────────────────────────────────────
  // import Anthropic from '@anthropic-ai/sdk'
  // const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  // const res = await client.messages.create({
  //   model: 'claude-haiku-4-5-20251001',
  //   max_tokens: 200,
  //   system: SYSTEM_PROMPT,
  //   messages: [{ role: 'user', content: userMessage }],
  // })
  // return (res.content[0] as { text: string }).text

  // ── PLACEHOLDER (remove when you add a real provider) ──────────────────────
  console.log('[aiTriage] callLLM placeholder — user said:', userMessage)
  return `Thanks for reaching out to Top Tennis support! 🎾 I've received your message and will get back to you shortly. If this is urgent, reply with "AGENT" to speak to a person.`
}

// ─── Escalation detection ─────────────────────────────────────────────────────

function parseEscalation(rawReply: string): { text: string; escalate: boolean } {
  const match = rawReply.match(/^ESCALATE:\s*(.+)/i)
  if (match) {
    return {
      text: `I'm connecting you with a support agent right now. They'll pick up your case: "${match[1]}"`,
      escalate: true,
    }
  }
  return { text: rawReply, escalate: false }
}

// ─── Media context builder ────────────────────────────────────────────────────

function buildMediaContext(media: MediaAttachment[]): string {
  if (media.length === 0) return ''
  const summaries = media.map(m => `[${m.category}: ${m.contentType}]`).join(', ')
  return `\n\n[User also sent: ${summaries}]`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function triageMessage(msg: InboundMessage): Promise<TriageResult> {
  // Quick keyword overrides — before calling the LLM at all
  const lower = msg.body.toLowerCase().trim()

  if (lower === 'agent' || lower === 'human' || lower === 'help') {
    return {
      replyText:       'Connecting you to a live agent. Please hold — someone will respond within 5 minutes.',
      requiresHuman:   true,
      confidenceScore: 1,
      intent:          'escalation_request',
    }
  }

  const userContent = msg.body + buildMediaContext(msg.media)
  const rawReply    = await callLLM(userContent)
  const { text, escalate } = parseEscalation(rawReply)

  return {
    replyText:       text,
    requiresHuman:   escalate,
    confidenceScore: escalate ? 0.3 : 0.85,   // placeholder — replace with actual model logprobs
    intent:          undefined,
  }
}
