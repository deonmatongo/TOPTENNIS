import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, AuthFieldError } from '@/contexts/AuthContext'
import { AuthShell, Field, SubmitButton, authStyles } from '@/components/auth/AuthShell'
import { PhoneField } from '@/components/auth/PhoneField'
import { Palette, FontWeight } from '@/theme/colors'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/** Length only. Composition rules push users toward shorter, guessable passwords. */
const passwordHint = (pw: string) => {
  if (!pw) return undefined
  if (pw.length < 8) return `${8 - pw.length} more character${8 - pw.length === 1 ? '' : 's'}`
  return undefined
}

export const SignUpScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { startSignup, checkUsername } = useAuth()

  const [username, setUsername] = useState('')
  const [country, setCountry] = useState('US')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Debounced availability check. Advisory only: claim_identity re-checks against
  // the unique constraint after verification, which is what closes the race.
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

    if (!phone.replace(/\D/g, '')) e.phone = 'Enter your mobile number'

    if (!password) e.password = 'Choose a password'
    else if (password.length < 8) e.password = 'At least 8 characters'

    if (!confirm) e.confirm = 'Confirm your password'
    else if (password !== confirm) e.confirm = 'Passwords do not match'

    if (!agree) e.agree = 'You must agree to continue'

    setErrors(e)
    return Object.keys(e).length === 0
  }, [username, availableFor, checking, checkFailed, phone, password, confirm, agree])

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await startSignup({
        phone: phone.replace(/\D/g, ''),
        username: username.trim(),
        password,
        defaultCountry: country,
      })
      navigation.navigate('VerifyCode')
    } catch (e: any) {
      if (e instanceof AuthFieldError && e.field) {
        setErrors((p) => ({ ...p, [e.field === 'phone' ? 'phone' : e.field!]: e.message }))
      } else {
        setErrors((p) => ({ ...p, form: e?.message ?? 'Could not start signup.' }))
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

      <PhoneField
        country={country}
        onCountryChange={setCountry}
        value={phone}
        onChangeText={(v) => { setPhone(v); setErrors((p) => ({ ...p, phone: '' })) }}
        error={errors.phone}
      />

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

      <SubmitButton label="Send verification code" onPress={handleSubmit} loading={loading} />

      <Text style={authStyles.switchText}>
        {'Already have an account? '}
        <Text style={authStyles.switchLink} onPress={() => navigation.goBack()}>
          Sign In
        </Text>
      </Text>
    </AuthShell>
  )
}
