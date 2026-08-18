import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, AuthFieldError } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'
import { SECURITY_QUESTIONS } from '@/constants/securityQuestions'
import { Palette, FontWeight, Colors, Radius } from '@/theme/colors'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Length only. Composition rules push users toward shorter, guessable passwords. */
const passwordHint = (pw: string) => {
  if (!pw) return undefined
  if (pw.length < 8) return `${8 - pw.length} more character${8 - pw.length === 1 ? '' : 's'}`
  return undefined
}

export const SignUpScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { signUp, claimProfile, checkUsername } = useAuth()

  // Tracks whether signUp() already created the account, so a username
  // collision can be retried with claimProfile() alone instead of trying (and
  // failing) to create the account a second time.
  const accountCreated = useRef(false)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)

  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0])
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [questionPickerOpen, setQuestionPickerOpen] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Debounced availability check. Advisory only: claim_username re-checks against
  // the unique constraint after the account is created, which is what closes the race.
  const [checking, setChecking] = useState(false)
  const [availableFor, setAvailableFor] = useState<string | null>(null)
  // Tracks WHY the handle is not confirmed available, so submit can say
  // "couldn't verify" instead of falsely asserting "taken".
  const [checkFailed, setCheckFailed] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    setAvailableFor(null)
    setCheckFailed(false)

    const candidate = username.trim()
    if (!USERNAME_RE.test(candidate)) {
      setChecking(false)
      return
    }

    setChecking(true)
    debounce.current = setTimeout(async () => {
      const result = await checkUsername(candidate)
      setChecking(false)
      setCheckFailed(!!result.failed)
      if (result.available) {
        setAvailableFor(candidate)
        setErrors((p) => ({ ...p, username: '' }))
      } else {
        setErrors((p) => ({ ...p, username: result.reason ?? 'That username is taken.' }))
      }
    }, 450)

    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [username, checkUsername])

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    const handle = username.trim()

    if (!handle) e.username = 'Pick a username'
    else if (!USERNAME_RE.test(handle)) {
      e.username = '3–20 characters, letters, numbers and underscores only.'
    } else if (availableFor !== handle) {
      // Three genuinely different states. Reporting "taken" for the other two
      // was the bug: it blamed the user for a lookup that never completed.
      e.username = checking
        ? 'Still checking that username…'
        : checkFailed
          ? "Couldn't check that username. Check your connection and try again."
          : 'That username is taken.'
    }

    if (!email.trim()) e.email = 'Enter your email address'
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address'

    if (!password) e.password = 'Choose a password'
    else if (password.length < 8) e.password = 'At least 8 characters'

    if (!confirm) e.confirm = 'Confirm your password'
    else if (password !== confirm) e.confirm = 'Passwords do not match'

    if (!securityAnswer.trim()) e.securityAnswer = 'Enter an answer you will remember'
    else if (securityAnswer.trim().length < 2) e.securityAnswer = 'At least 2 characters'

    if (!agree) e.agree = 'You must agree to continue'

    setErrors(e)
    return Object.keys(e).length === 0
  }, [username, availableFor, checking, checkFailed, email, password, confirm, securityAnswer, agree])

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (!accountCreated.current) {
        await signUp({ email: email.trim(), password })
        accountCreated.current = true
      }
      await claimProfile({
        username: username.trim(),
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
      })
      // No navigation call: pendingClaim clearing flips the navigator gate.
    } catch (e: any) {
      if (e instanceof AuthFieldError && e.field) {
        setErrors((p) => ({ ...p, [e.field!]: e.message }))
      } else {
        setErrors((p) => ({ ...p, form: e?.message ?? 'Could not create your account.' }))
      }
    } finally {
      setLoading(false)
    }
  }

  const handle = username.trim()
  const usernameOk = availableFor === handle && handle.length > 0

  return (
    <AuthShell
      headline="Join the community."
      subline="Create your account and start playing"
      onBack={() => navigation.goBack()}
    >
      <Field
        label="Username"
        error={errors.username}
        hint="This is how other players will find you."
        icon="at-outline"
        focused={focused === 'username'}
        busy={checking}
        ok={usernameOk}
      >
        <TextInput
          style={authStyles.input}
          placeholder="rallyking"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={username}
          onChangeText={setUsername}
          onFocus={() => setFocused('username')}
          onBlur={() => setFocused(null)}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
      </Field>

      <Field
        label="Email"
        error={errors.email}
        icon="mail-outline"
        focused={focused === 'email'}
      >
        <TextInput
          style={authStyles.input}
          placeholder="you@example.com"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={email}
          onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: '' })) }}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
      </Field>

      <Field
        label="Password"
        error={errors.password}
        hint={passwordHint(password)}
        icon="lock-closed-outline"
        focused={focused === 'password'}
      >
        <TextInput
          style={authStyles.input}
          placeholder="At least 8 characters"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={password}
          onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: '' })) }}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          // No maxLength and no character filtering: long passphrases and pasted
          // password-manager output must both work.
        />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(255,255,255,0.35)"
          />
        </TouchableOpacity>
      </Field>

      <Field
        label="Confirm Password"
        error={errors.confirm}
        icon="lock-closed-outline"
        focused={focused === 'confirm'}
      >
        <TextInput
          style={authStyles.input}
          placeholder="Re-enter your password"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: '' })) }}
          onFocus={() => setFocused('confirm')}
          onBlur={() => setFocused(null)}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </Field>

      <View style={{ gap: 6 }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Security Question
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          Used to reset your password if you forget it.
        </Text>
        <TouchableOpacity
          onPress={() => setQuestionPickerOpen(true)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: Radius.lg, paddingHorizontal: 14, minHeight: 52,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, flex: 1 }} numberOfLines={1}>
            {securityQuestion}
          </Text>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>
      </View>

      <Field
        label="Your Answer"
        error={errors.securityAnswer}
        icon="help-circle-outline"
        focused={focused === 'securityAnswer'}
      >
        <TextInput
          style={authStyles.input}
          placeholder="Enter your answer"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={securityAnswer}
          onChangeText={(v) => { setSecurityAnswer(v); setErrors((p) => ({ ...p, securityAnswer: '' })) }}
          onFocus={() => setFocused('securityAnswer')}
          onBlur={() => setFocused(null)}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Modal visible={questionPickerOpen} transparent animationType="fade" onRequestClose={() => setQuestionPickerOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setQuestionPickerOpen(false)}
        >
          <View style={{ backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingBottom: 24 }}>
            <FlatList
              data={SECURITY_QUESTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ paddingVertical: 16, paddingHorizontal: 20 }}
                  onPress={() => { setSecurityQuestion(item); setQuestionPickerOpen(false) }}
                >
                  <Text style={{ color: Colors.text, fontSize: 15 }}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        onPress={() => { setAgree((v) => !v); setErrors((p) => ({ ...p, agree: '' })) }}
        activeOpacity={0.7}
      >
        <View
          style={{
            width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
            borderColor: agree ? Palette.orange500 : 'rgba(255,255,255,0.25)',
            backgroundColor: agree ? Palette.orange500 : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {agree && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
        <Text style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 }}>
          {'I agree to the '}
          <Text
            style={{ color: Palette.orange500, fontWeight: FontWeight.semibold }}
            onPress={() => WebBrowser.openBrowserAsync('https://toptennis.app/terms')}
          >
            Terms of Service
          </Text>
          {' and '}
          <Text
            style={{ color: Palette.orange500, fontWeight: FontWeight.semibold }}
            onPress={() => WebBrowser.openBrowserAsync('https://toptennis.app/privacy')}
          >
            Privacy Policy
          </Text>
          {', including a zero-tolerance policy for objectionable content and abusive behavior.'}
        </Text>
      </TouchableOpacity>
      {!!errors.agree && <Text style={authStyles.fieldError}>{errors.agree}</Text>}

      {!!errors.form && <Text style={authStyles.fieldError}>{errors.form}</Text>}

      <SubmitButton label="Create Account" onPress={handleSubmit} loading={loading} />

      <Text style={authStyles.switchText}>
        {'Already have an account? '}
        <Text style={authStyles.switchLink} onPress={() => navigation.goBack()}>
          Sign In
        </Text>
      </Text>
    </AuthShell>
  )
}
