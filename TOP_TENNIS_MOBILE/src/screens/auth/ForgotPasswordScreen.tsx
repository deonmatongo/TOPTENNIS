import React, { useState } from 'react'
import { Text, TextInput, TouchableOpacity } from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'

/**
 * Forgot password, step 1.
 *
 * On success this ALWAYS advances to the answer screen with a question to
 * show, whether or not the account exists — the Edge Function returns a
 * generic fallback question for an unknown email. Showing "no account with
 * that email" here would turn this screen into a free account-existence
 * oracle. The only non-advancing outcome is a rate-limit trip, which is about
 * the caller's own behaviour.
 */
export const ForgotPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getSecurityQuestion } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const question = await getSecurityQuestion(email.trim())
      navigation.navigate('ResetPassword', { question })
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      headline="Reset your password."
      subline="We'll ask your security question."
      onBack={() => navigation.goBack()}
    >
      <Field label="Email" icon="mail-outline">
        <TextInput
          style={authStyles.input}
          placeholder="you@example.com"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null) }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoFocus
        />
      </Field>

      {!!error && <Text style={authStyles.fieldError}>{error}</Text>}

      <SubmitButton label="Continue" onPress={handleSubmit} loading={loading} />

      <TouchableOpacity style={authStyles.centered} onPress={() => navigation.goBack()}>
        <Text style={authStyles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </AuthShell>
  )
}
