import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell, SubmitButton, authStyles } from '@/components/auth/AuthShell'
import { OtpInput } from '@/components/auth/OtpInput'

const RESEND_COOLDOWN_SECONDS = 30

/**
 * Forgot password, step 2.
 *
 * Unlike signup, this cannot call verifyOtp locally: on the username path the
 * client is never told which phone number the code went to. verifyResetOtp posts
 * the identifier and the code to the verify-reset-code Edge Function, which
 * resolves the number server-side and returns the short-lived session.
 *
 * A wrong code and a non-existent account produce the same message, so reaching
 * this screen still reveals nothing.
 */
export const VerifyResetCodeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { verifyResetOtp, resendResetCode } = useAuth()

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleVerify = useCallback(
    async (submitted: string) => {
      if (submitted.length !== 6 || busy) return
      setBusy(true)
      setError(null)
      try {
        await verifyResetOtp(submitted)
        navigation.navigate('SetNewPassword')
      } catch (e: any) {
        setError(e?.message ?? 'That code is incorrect or has expired.')
        setCode('')
        setCooldown(0)
      } finally {
        setBusy(false)
      }
    },
    [busy, verifyResetOtp, navigation],
  )

  const handleResend = async () => {
    setError(null)
    setCooldown(RESEND_COOLDOWN_SECONDS)
    try {
      await resendResetCode()
    } catch (e: any) {
      setError(e?.message ?? 'Could not resend your code.')
    }
  }

  return (
    <AuthShell
      headline="Enter your code."
      subline="If that account exists, a 6-digit code is on its way."
      onBack={() => navigation.goBack()}
    >
      <OtpInput
        value={code}
        onChange={(v) => { setCode(v); setError(null) }}
        onComplete={handleVerify}
        editable={!busy}
        error={!!error}
      />

      {!!error && <Text style={[authStyles.fieldError, { textAlign: 'center' }]}>{error}</Text>}

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
