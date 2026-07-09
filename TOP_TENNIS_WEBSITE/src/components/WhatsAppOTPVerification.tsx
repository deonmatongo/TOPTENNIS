import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2, MessageSquare, Phone, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhatsAppOTPVerificationProps {
  /** Called with the verified E.164 phone number on success */
  onVerified: (phoneNumber: string) => void
  /** Optional — renders a "Skip for now" link */
  onSkip?: () => void
  className?: string
  /** Pre-fill from the registration form so the user doesn't retype their number */
  initialPhone?: { dialCode: string; local: string }
}

type Step = 'phone' | 'code'
type Channel = 'whatsapp' | 'sms'

const COUNTRY_CODES = [
  { label: '🇿🇼 Zimbabwe', dial: '+263' },
  { label: '🇵🇱 Poland',   dial: '+48'  },
  { label: '🇿🇦 S. Africa', dial: '+27'  },
  { label: '🇬🇧 UK',        dial: '+44'  },
  { label: '🇺🇸 USA',       dial: '+1'   },
] as const

const OTP_TTL_SECONDS = 180 // 3 minutes — matches Twilio Verify default

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function maskPhone(e164: string): string {
  // +263771234567  →  +263 *** **** 567
  if (e164.length < 7) return e164
  return `${e164.slice(0, 4)} *** **** ${e164.slice(-3)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WhatsAppOTPVerification({
  onVerified,
  onSkip,
  className,
  initialPhone,
}: WhatsAppOTPVerificationProps) {
  // --- Step state ---
  const [step, setStep]     = useState<Step>('phone')
  const [channel, setChannel] = useState<Channel>('whatsapp')

  // --- Phone input ---
  const [dialCode, setDialCode]     = useState(initialPhone?.dialCode ?? '+263')
  const [localNumber, setLocalNumber] = useState(initialPhone?.local ?? '')
  const [phoneError, setPhoneError]   = useState('')

  // --- OTP input ---
  const [otp, setOtp]             = useState('')
  const [otpError, setOtpError]   = useState('')

  // --- Loading ---
  const [sending,   setSending]   = useState(false)
  const [verifying, setVerifying] = useState(false)

  // --- Countdown ---
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const e164 = `${dialCode}${localNumber.replace(/\D/g, '')}`

  // -------------------------------------------------------------------------
  // Countdown management
  // -------------------------------------------------------------------------

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSecondsLeft(OTP_TTL_SECONDS)
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // -------------------------------------------------------------------------
  // Phone validation
  // -------------------------------------------------------------------------

  function validatePhone(): boolean {
    const digits = localNumber.replace(/\D/g, '')
    if (!digits) {
      setPhoneError('Phone number is required')
      return false
    }
    if (digits.length < 6 || digits.length > 13) {
      setPhoneError('Enter a valid local phone number')
      return false
    }
    setPhoneError('')
    return true
  }

  // -------------------------------------------------------------------------
  // Send OTP
  // -------------------------------------------------------------------------

  async function sendOtp(requestedChannel: Channel) {
    if (!validatePhone()) return
    setSending(true)
    setOtpError('')

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-otp', {
        body: { to: e164, channel: requestedChannel },
      })

      if (error || data?.error) {
        setPhoneError(data?.error ?? error?.message ?? 'Failed to send code. Try again.')
        return
      }

      setChannel(requestedChannel)
      setStep('code')
      startCountdown()
    } catch {
      setPhoneError('Network error. Please check your connection.')
    } finally {
      setSending(false)
    }
  }

  // -------------------------------------------------------------------------
  // Verify OTP
  // -------------------------------------------------------------------------

  async function verifyOtp() {
    if (otp.length !== 6) {
      setOtpError('Please enter all 6 digits')
      return
    }
    setVerifying(true)
    setOtpError('')

    try {
      const { data, error } = await supabase.functions.invoke('verify-whatsapp-otp', {
        body: { to: e164, code: otp },
      })

      if (error || data?.error) {
        setOtpError(data?.error ?? error?.message ?? 'Verification failed. Try again.')
        setOtp('')
        return
      }

      if (!data?.valid) {
        setOtpError(data?.error ?? 'Incorrect code. Please try again.')
        setOtp('')
        return
      }

      if (timerRef.current) clearInterval(timerRef.current)
      onVerified(e164)
    } catch {
      setOtpError('Network error. Please check your connection.')
    } finally {
      setVerifying(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const progress = (secondsLeft / OTP_TTL_SECONDS) * 100
  const countdownUrgent = secondsLeft <= 30
  const expired = secondsLeft === 0

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={cn('w-full space-y-6', className)}>

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Phone input                                                */}
      {/* ------------------------------------------------------------------ */}
      {step === 'phone' && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              {/* WhatsApp icon (inline SVG — no external CDN) */}
              <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <Label className="text-sm font-semibold text-foreground">
                Verify via WhatsApp
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              We'll send a 6-digit code to your WhatsApp.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local-number" className="text-sm font-medium text-foreground">
              Phone Number
            </Label>
            <div className="flex gap-2">
              {/* Country code selector */}
              <Select value={dialCode} onValueChange={setDialCode}>
                <SelectTrigger className="w-36 h-12 shrink-0 font-mono text-sm" aria-label="Country code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map(c => (
                    <SelectItem key={c.dial} value={c.dial}>
                      {c.label} ({c.dial})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Local number */}
              <Input
                id="local-number"
                type="tel"
                inputMode="numeric"
                placeholder="771 234 567"
                value={localNumber}
                onChange={e => {
                  setLocalNumber(e.target.value)
                  if (phoneError) setPhoneError('')
                }}
                onKeyDown={e => { if (e.key === 'Enter') sendOtp('whatsapp') }}
                className={cn(
                  'h-12 font-mono tracking-wide',
                  phoneError && 'border-red-500 focus-visible:ring-red-500'
                )}
                disabled={sending}
                aria-describedby={phoneError ? 'phone-error' : undefined}
                aria-invalid={!!phoneError}
              />
            </div>

            {phoneError && (
              <p id="phone-error" role="alert" className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {phoneError}
              </p>
            )}

            <p className="text-xs text-muted-foreground font-mono">
              Full number: {localNumber ? e164 : `${dialCode}...`}
            </p>
          </div>

          <Button
            type="button"
            className="w-full h-12 font-bold bg-[#25D366] hover:bg-[#1ebe57] text-white gap-2"
            onClick={() => sendOtp('whatsapp')}
            disabled={sending}
          >
            {sending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Send Code via WhatsApp
              </>
            )}
          </Button>

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Skip verification for now
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 2 — OTP entry                                                  */}
      {/* ------------------------------------------------------------------ */}
      {step === 'code' && (
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {channel === 'whatsapp' ? (
                <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              ) : (
                <Phone className="w-5 h-5 text-primary" aria-hidden="true" />
              )}
              <Label className="text-sm font-semibold text-foreground">
                Enter Verification Code
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Sent via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to{' '}
              <span className="font-mono">{maskPhone(e164)}</span>
            </p>
          </div>

          {/* OTP slots */}
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={val => {
                setOtp(val)
                if (otpError) setOtpError('')
              }}
              disabled={verifying || expired}
              aria-label="Verification code"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className={cn(
                      'w-12 h-14 text-xl font-bold',
                      otpError && 'border-red-500',
                    )}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>

            {otpError && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {otpError}
              </p>
            )}
          </div>

          {/* Countdown bar */}
          <div className="space-y-1.5" aria-live="polite" aria-atomic="true">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Code expires in</span>
              <span className={cn(
                'font-mono font-semibold tabular-nums transition-colors',
                countdownUrgent ? 'text-red-500' : 'text-foreground'
              )}>
                {expired ? 'Expired' : formatCountdown(secondsLeft)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000 ease-linear',
                  expired       ? 'w-0 bg-red-500' :
                  countdownUrgent ? 'bg-red-500'   : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={secondsLeft}
                aria-valuemax={OTP_TTL_SECONDS}
                aria-valuemin={0}
                aria-label="Code expiry"
              />
            </div>
          </div>

          {/* Verify button */}
          <Button
            type="button"
            className="w-full h-12 font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            onClick={verifyOtp}
            disabled={verifying || expired || otp.length !== 6}
          >
            {verifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                Verifying…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Verify Code
              </>
            )}
          </Button>

          {/* Resend + fallback row */}
          <div className="space-y-2 pt-1">
            {/* Resend via same channel */}
            <button
              type="button"
              onClick={() => sendOtp(channel)}
              disabled={sending || secondsLeft > 0}
              className={cn(
                'w-full text-xs text-center underline underline-offset-2 transition-colors',
                secondsLeft > 0
                  ? 'text-muted-foreground/50 cursor-not-allowed no-underline'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {sending ? 'Sending…' : secondsLeft > 0
                ? `Resend available in ${formatCountdown(secondsLeft)}`
                : 'Resend code'}
            </button>

            {/* SMS fallback — only shown when WhatsApp was used */}
            {channel === 'whatsapp' && (
              <button
                type="button"
                onClick={() => sendOtp('sms')}
                disabled={sending}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                Didn't get the code? Send via SMS instead.
              </button>
            )}

            {/* Change number */}
            <button
              type="button"
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current)
                setStep('phone')
                setOtp('')
                setOtpError('')
              }}
              className="w-full text-xs text-center text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Wrong number? Go back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
