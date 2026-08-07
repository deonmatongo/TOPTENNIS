import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useAuth, AuthFieldError } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'
import { OtpInput } from '@/components/auth/OtpInput'

const RESEND_COOLDOWN_SECONDS = 30

/**
 * Signup step 2: enter the SMS code, then claim the username.
 *
 * Two things worth knowing about the shape of this screen:
 *
 *  1. verifyOtp establishes a real session, which would normally flip the
 *     navigator into the app. It does not, because the navigator keeps the auth
 *     stack mounted while `pendingSignup` is set — otherwise this screen would
 *     unmount mid-flow and claim_identity would never run.
 *
 *  2. If the handle is taken in the race window, the verified session is kept and
 *     the user is shown a username field right here. Making them redo SMS
 *     verification to fix a name collision would be punishing them for someone
 *     else's timing.
 */
export const VerifyCodeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { pendingSignup, verifyPhoneOtp, completeSignup, resendSignupCode, cancelSignup } = useAuth()

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  // Set once the code is accepted but the handle still needs sorting out.
  const [needsUsername, setNeedsUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // If there is no pending signup this screen has nothing to act on — most
  // likely the user backed out.
  useEffect(() => {
    if (!pendingSignup) navigation.goBack()
  }, [pendingSignup, navigation])

  const finish = useCallback(
    async (usernameOverride?: string) => {
      try {
        await completeSignup(usernameOverride)
        // pendingSignup is now null, which releases the navigator gate and drops
        // the user into onboarding.
      } catch (e: any) {
        if (e instanceof AuthFieldError && e.field === 'username') {
          setNeedsUsername(true)
          setUsernameError(e.message)
        } else {
          setError(e?.message ?? 'Could not finish setting up your account.')
        }
      }
    },
    [completeSignup],
  )

  const handleVerify = useCallback(
    async (submitted: string) => {
      if (submitted.length !== 6 || busy) return
      setBusy(true)
      setError(null)
      try {
        await verifyPhoneOtp(submitted)
        await finish()
      } catch (e: any) {
        setError(e?.message ?? 'That code is incorrect or has expired.')
        setCode('')
        setCooldown(0)
      } finally {
        setBusy(false)
      }
    },
    [busy, verifyPhoneOtp, finish],
  )

  const handleResend = async () => {
    setError(null)
    setCooldown(RESEND_COOLDOWN_SECONDS)
    try {
      await resendSignupCode()
    } catch (e: any) {
      // The server enforces the real limit (3 per number per hour); this timer is
      // only a courtesy so the button is not spammed.
      setError(e?.message ?? 'Could not resend your code.')
    }
  }

  const handleBack = () => {
    cancelSignup()
    navigation.goBack()
  }

  if (needsUsername) {
    return (
      <AuthShell
        headline="Pick another username."
        subline="Your number is verified — you just need a free handle."
      >
        <Field label="Username" error={usernameError ?? undefined} icon="at-outline">
          <TextInput
            style={authStyles.input}
            placeholder="rallyking"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={newUsername}
            onChangeText={(v) => { setNewUsername(v); setUsernameError(null) }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            autoFocus
          />
        </Field>

        {!!error && <Text style={authStyles.fieldError}>{error}</Text>}

        <SubmitButton
          label="Claim username"
          loading={busy}
          onPress={async () => {
            const candidate = newUsername.trim()
            if (!/^[A-Za-z0-9_]{3,20}$/.test(candidate)) {
              setUsernameError('3–20 characters, letters, numbers and underscores only.')
              return
            }
            setBusy(true)
            await finish(candidate)
            setBusy(false)
          }}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      headline="Check your messages."
      subline={`We sent a 6-digit code to your mobile number.`}
      onBack={handleBack}
    >
      <OtpInput
        value={code}
        onChange={(v) => { setCode(v); setError(null) }}
        onComplete={handleVerify}
        editable={!busy}
        error={!!error}
      />

      {!!error && (
        <Text style={[authStyles.fieldError, { textAlign: 'center' }]}>{error}</Text>
      )}

      <SubmitButton
        label="Verify"
        onPress={() => handleVerify(code)}
        loading={busy}
        disabled={code.length !== 6}
      />

      <View style={authStyles.centered}>
        {cooldown > 0 ? (
          <Text style={authStyles.note}>You can request a new code in {cooldown}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text style={authStyles.linkText}>Send a new code</Text>
          </TouchableOpacity>
        )}
      </View>
    </AuthShell>
  )
}
