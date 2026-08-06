import React, { useState } from 'react'
import { Text, TextInput, TouchableOpacity } from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'

/**
 * Forgot password, step 1.
 *
 * On success this ALWAYS advances to the code screen, whether or not the account
 * exists — the Edge Function returns an identical response either way. Showing
 * "no account with that username" here would turn this screen into a free
 * account-existence oracle, which is exactly what the server-side design is
 * built to prevent. The only non-advancing outcome is a rate-limit trip, which
 * is about the caller's own behaviour.
 */
export const ForgotPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { requestPasswordReset } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!identifier.trim()) {
      setError('Enter your username or phone number.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(identifier.trim())
      navigation.navigate('VerifyResetCode')
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      headline="Reset your password."
      subline="We'll text a code to the number on your account."
      onBack={() => navigation.goBack()}
    >
      <Field label="Username or phone number" icon="person-outline">
        <TextInput
          style={authStyles.input}
          placeholder="rallyking or your mobile number"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={identifier}
          onChangeText={(v) => { setIdentifier(v); setError(null) }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          autoFocus
        />
      </Field>

      {!!error && <Text style={authStyles.fieldError}>{error}</Text>}

      <SubmitButton label="Send code" onPress={handleSubmit} loading={loading} />

      <TouchableOpacity style={authStyles.centered} onPress={() => navigation.goBack()}>
        <Text style={authStyles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </AuthShell>
  )
}
