import React, { useState } from 'react'
import { Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, AuthFieldError } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'

/**
 * Forgot password, step 2 — answer the security question and choose a new
 * password in one screen. verifySecurityAnswer mints a short-lived session
 * server-side (no email/SMS sent); setNewPassword then saves the password and
 * revokes every session, this one included, so the user is signed out and
 * returned to the login screen on success.
 */
export const ResetPasswordScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { verifySecurityAnswer, setNewPassword } = useAuth()
  const question: string = route?.params?.question ?? 'Your security question'

  const [answer, setAnswer] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const e: Record<string, string> = {}
    if (!answer.trim()) e.answer = 'Enter your answer'
    if (!password) e.password = 'Choose a password'
    else if (password.length < 8) e.password = 'At least 8 characters'
    if (!confirm) e.confirm = 'Confirm your password'
    else if (password !== confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      await verifySecurityAnswer(answer.trim())
      await setNewPassword(password)
      Alert.alert(
        'Password updated',
        'You have been signed out everywhere. Sign in with your new password.',
      )
      navigation.navigate('Login')
    } catch (err: any) {
      if (err instanceof AuthFieldError && err.field) {
        setErrors({ [err.field]: err.message })
      } else {
        setErrors({ form: err?.message ?? 'Could not reset your password.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell headline="Answer & choose a password." subline={question} onBack={() => navigation.goBack()}>
      <Field label="Your Answer" error={errors.answer} icon="help-circle-outline">
        <TextInput
          style={authStyles.input}
          placeholder="Enter your answer"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={answer}
          onChangeText={(v) => { setAnswer(v); setErrors((p) => ({ ...p, answer: '' })) }}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </Field>

      <Field label="New password" error={errors.password} icon="lock-closed-outline">
        <TextInput
          style={authStyles.input}
          placeholder="At least 8 characters"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={password}
          onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: '' })) }}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(255,255,255,0.35)"
          />
        </TouchableOpacity>
      </Field>

      <Field label="Confirm new password" error={errors.confirm} icon="lock-closed-outline">
        <TextInput
          style={authStyles.input}
          placeholder="Re-enter your password"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: '' })) }}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </Field>

      {!!errors.form && <Text style={authStyles.fieldError}>{errors.form}</Text>}

      <Text style={authStyles.note}>
        Saving this will sign you out on every device.
      </Text>

      <SubmitButton label="Save password" onPress={handleSubmit} loading={loading} />
    </AuthShell>
  )
}
