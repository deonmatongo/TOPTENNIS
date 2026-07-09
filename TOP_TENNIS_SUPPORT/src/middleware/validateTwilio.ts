import type { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { config } from '../config/index.js'

/**
 * Verifies every inbound webhook request is genuinely from Twilio.
 *
 * Twilio signs requests using HMAC-SHA1 over (URL + sorted params)
 * and sends the signature in X-Twilio-Signature. Skipping this check
 * lets anyone POST fake messages to your endpoint.
 *
 * Must be applied BEFORE body-parser (raw body is needed for validation).
 * We use express.urlencoded() which populates req.body, and then validate.
 */
export function validateTwilioSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // In dev / test we skip validation so ngrok / curl testing works easily.
  if (config.NODE_ENV !== 'production') {
    next()
    return
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined

  if (!signature) {
    res.status(403).json({ error: 'Missing X-Twilio-Signature header' })
    return
  }

  // Reconstruct the exact URL Twilio used to sign the request.
  // If behind a reverse proxy, req.headers['x-forwarded-proto'] gives real protocol.
  const proto    = req.headers['x-forwarded-proto'] ?? req.protocol
  const fullUrl  = `${proto}://${req.hostname}${req.originalUrl}`

  const isValid = twilio.validateRequest(
    config.TWILIO_AUTH_TOKEN,
    signature,
    fullUrl,
    req.body as Record<string, string>,   // parsed by express.urlencoded
  )

  if (!isValid) {
    console.warn('[validateTwilio] Signature mismatch — rejecting request', {
      url: fullUrl,
      ip: req.ip,
    })
    res.status(403).json({ error: 'Invalid Twilio signature' })
    return
  }

  next()
}
