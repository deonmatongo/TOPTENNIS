import React, { useState, useCallback, useEffect } from 'react'
import {
  View, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { YStack, XStack, Text } from 'tamagui'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/services/supabase'
import { Palette, Colors, FontSize, FontWeight, Radius, Spacing } from '@/theme/colors'
import { useBiometrics } from '@/hooks/useBiometrics'

// ── Helpers ────────────────────────────────────────────────────────────────────

const getPasswordStrength = (pw: string) => {
  if (!pw) return { score: 0, label: '', color: Colors.border, suggestions: [] as string[] }
  let score = 0
  const suggestions: string[] = []
  if (pw.length >= 8) score++; else suggestions.push('At least 8 characters')
  if (/[A-Z]/.test(pw)) score++; else suggestions.push('Add uppercase letters')
  if (/[a-z]/.test(pw)) score++; else suggestions.push('Add lowercase letters')
  if (/[0-9]/.test(pw)) score++; else suggestions.push('Add numbers')
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++; else suggestions.push('Add special characters')
  if (pw.length >= 12) score = Math.min(score + 1, 5)
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a', '#15803d']
  return { score, label: labels[Math.min(score, 5)], color: colors[Math.min(score, 5)], suggestions }
}

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// ── Field component ────────────────────────────────────────────────────────────

const Field: React.FC<{
  label:        string
  error?:       string
  icon?:        string
  focused:      boolean
  onFocus:      () => void
  onBlur:       () => void
  flex?:        number
  children:     React.ReactNode
}> = ({ label, error, icon, focused, onFocus, onBlur, flex, children }) => (
  <YStack gap={6} flex={flex}>
    <Text color={Colors.text} fontSize={FontSize.xs} fontWeight={FontWeight.bold as any} textTransform="uppercase" letterSpacing={0.5}>
      {label}
    </Text>
    <XStack
      alignItems="center"
      backgroundColor={Colors.surface}
      borderWidth={focused ? 2 : 1.5}
      borderColor={error ? Colors.error : focused ? Colors.primary : Colors.border}
      borderRadius={Radius.lg}
      paddingHorizontal={Spacing.md}
      minHeight={50}
    >
      {icon && (
        <Ionicons
          name={icon as any}
          size={16}
          color={focused ? Colors.primary : Colors.textMuted}
          style={{ marginRight: 8 }}
        />
      )}
      {children}
    </XStack>
    {!!error && (
      <Text color={Colors.error} fontSize={FontSize.xs} marginTop={-2}>{error}</Text>
    )}
  </YStack>
)

// ── Main Screen ────────────────────────────────────────────────────────────────

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const { available, biometricType, biometricLabel, credentialsStored, authenticate, saveCredentials } = useBiometrics()

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e?.message || 'Could not sign in with Google. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleBiometricSignIn = useCallback(async () => {
    setBiometricLoading(true)
    try {
      const creds = await authenticate()
      if (!creds) return
      await signIn(creds.email, creds.password)
    } catch (e: any) {
      Alert.alert('Sign In Failed', e?.message || 'Could not sign in. Please use your password.')
    } finally {
      setBiometricLoading(false)
    }
  }, [authenticate, signIn])

  useEffect(() => {
    if (available && credentialsStored && mode === 'signin') {
      const timer = setTimeout(() => handleBiometricSignIn(), 400)
      return () => clearTimeout(timer)
    }
  }, [available, credentialsStored])

  const pwStrength = mode === 'signup' ? getPasswordStrength(password) : null
  const clearError = (field: string) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateSignup = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'First name is required'
    if (!lastName.trim()) e.lastName = 'Last name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address'
    const digits = phone.replace(/\D/g, '')
    if (!phone.trim()) e.phone = 'Phone number is required'
    else if (digits.length !== 10) e.phone = 'Enter a valid 10-digit phone number'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (!agreeToTerms) e.agreeToTerms = 'You must agree to the Terms and Privacy Policy'
    setErrors(e)
    return Object.keys(e).length === 0
  }, [firstName, lastName, email, phone, password, confirmPassword, agreeToTerms])

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please enter your email address above, then tap Forgot Password.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'toptennis://reset-password',
      })
      if (error) throw error
      Alert.alert('Check your email', `A password reset link has been sent to ${email.trim()}.`)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async () => {
    if (mode === 'signup') {
      if (!validateSignup()) return
      setLoading(true)
      try {
        await signUp(email.trim(), password, firstName.trim(), lastName.trim(), phone)
      } catch (e: any) {
        Alert.alert('Registration Failed', e?.message || 'Could not create account. Please try again.')
      } finally {
        setLoading(false)
      }
    } else {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Missing fields', 'Please enter your email and password.')
        return
      }
      setLoading(true)
      try {
        await signIn(email.trim(), password)
        if (available && !credentialsStored) {
          Alert.alert(
            `Enable ${biometricLabel}`,
            `Sign in faster next time using ${biometricLabel}.`,
            [
              { text: 'Not Now', style: 'cancel' },
              { text: `Enable ${biometricLabel}`, onPress: () => saveCredentials(email.trim(), password) },
            ],
          )
        }
      } catch (e: any) {
        Alert.alert('Sign In Failed', e?.message || 'Incorrect email or password.')
      } finally {
        setLoading(false)
      }
    }
  }

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next)
    setErrors({})
    setPassword('')
    setConfirmPassword('')
    setPhone('')
    setAgreeToTerms(false)
  }

  const isAnyLoading = loading || googleLoading

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <LinearGradient
            colors={[Palette.dark900, Palette.dark700]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingTop: 56, paddingBottom: 40, alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative', overflow: 'hidden' }}
          >
            <View style={{ position: 'absolute', bottom: -20, right: -20 }}>
              <Ionicons name="tennisball" size={120} color="rgba(255,255,255,0.04)" />
            </View>
            <XStack alignItems="center" gap={2}>
              <YStack
                width={38}
                height={38}
                borderRadius={Radius.lg}
                backgroundColor={Colors.primary}
                alignItems="center"
                justifyContent="center"
              >
                <Text color="#fff" fontSize={22} fontWeight={FontWeight.black as any}>T</Text>
              </YStack>
              <Text color="#fff" fontSize={28} fontWeight={FontWeight.black as any} letterSpacing={-0.5}>opTennis</Text>
            </XStack>
            <Text color="rgba(255,255,255,0.55)" fontSize={FontSize.sm} fontWeight={FontWeight.medium as any}>
              Your tennis community
            </Text>
          </LinearGradient>

          {/* ── Mode toggle pill ── */}
          <XStack
            marginHorizontal={Spacing.lg}
            marginTop={Spacing.xl}
            backgroundColor={Colors.backgroundAlt}
            borderRadius={Radius.full}
            padding={4}
            borderWidth={1}
            borderColor={Colors.borderLight}
          >
            {(['signin', 'signup'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  ...(mode === m
                    ? { backgroundColor: Colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }
                    : {}),
                }}
                onPress={() => switchMode(m)}
              >
                <Text
                  fontSize={FontSize.sm}
                  fontWeight={FontWeight.semibold as any}
                  color={mode === m ? Colors.text : Colors.textMuted}
                >
                  {m === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>

          {/* ── Form ── */}
          <YStack padding={Spacing.lg} gap={Spacing.md}>

            {/* Signup-only: name row */}
            {mode === 'signup' && (
              <>
                <XStack gap={8}>
                  <Field
                    label="First Name"
                    error={errors.firstName}
                    focused={focusedField === 'firstName'}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    flex={1}
                  >
                    <TextInput
                      style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 }}
                      placeholder="John"
                      placeholderTextColor={Colors.textMuted}
                      value={firstName}
                      onChangeText={v => { setFirstName(v); clearError('firstName') }}
                      onFocus={() => setFocusedField('firstName')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field
                    label="Last Name"
                    error={errors.lastName}
                    focused={focusedField === 'lastName'}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                    flex={1}
                  >
                    <TextInput
                      style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 }}
                      placeholder="Doe"
                      placeholderTextColor={Colors.textMuted}
                      value={lastName}
                      onChangeText={v => { setLastName(v); clearError('lastName') }}
                      onFocus={() => setFocusedField('lastName')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                      autoComplete="family-name"
                    />
                  </Field>
                </XStack>

                <Field
                  label="Phone Number"
                  error={errors.phone}
                  icon="call-outline"
                  focused={focusedField === 'phone'}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                >
                  <TextInput
                    style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 }}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={Colors.textMuted}
                    value={phone}
                    onChangeText={v => { setPhone(formatPhone(v)); clearError('phone') }}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </Field>
              </>
            )}

            {/* Email */}
            <Field
              label="Email Address"
              error={errors.email}
              icon="mail-outline"
              focused={focusedField === 'email'}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            >
              <TextInput
                style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 }}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={v => { setEmail(v); clearError('email') }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </Field>

            {/* Password */}
            <Field
              label="Password"
              error={errors.password}
              icon="lock-closed-outline"
              focused={focusedField === 'password'}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            >
              <TextInput
                style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 }}
                placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={v => { setPassword(v); clearError('password') }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </Field>

            {/* Password strength */}
            {mode === 'signup' && password.length > 0 && pwStrength && (
              <YStack gap={4} marginTop={-4}>
                <XStack gap={4}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <View
                      key={i}
                      style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= pwStrength.score ? pwStrength.color : Colors.borderLight }}
                    />
                  ))}
                </XStack>
                <Text fontSize={FontSize.xs} fontWeight={FontWeight.semibold as any} color={pwStrength.color}>
                  {pwStrength.label}
                </Text>
                {pwStrength.suggestions.length > 0 && (
                  <Text fontSize={FontSize.xs} color={Colors.textMuted}>{pwStrength.suggestions[0]}</Text>
                )}
              </YStack>
            )}

            {/* Confirm password */}
            {mode === 'signup' && (
              <Field
                label="Confirm Password"
                error={errors.confirmPassword}
                icon="lock-closed-outline"
                focused={focusedField === 'confirmPassword'}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
              >
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 }}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword') }}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={{ padding: 4 }}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </Field>
            )}

            {/* Terms */}
            {mode === 'signup' && (
              <>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
                  onPress={() => { setAgreeToTerms(v => !v); clearError('agreeToTerms') }}
                  activeOpacity={0.7}
                >
                  <YStack
                    width={22}
                    height={22}
                    borderRadius={6}
                    borderWidth={2}
                    borderColor={agreeToTerms ? Colors.primary : Colors.border}
                    backgroundColor={agreeToTerms ? Colors.primary : 'transparent'}
                    alignItems="center"
                    justifyContent="center"
                  >
                    {agreeToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </YStack>
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 }}>
                    {'I agree to the '}
                    <Text style={{ color: Colors.primary, fontWeight: FontWeight.semibold }}>Terms</Text>
                    {' and '}
                    <Text style={{ color: Colors.primary, fontWeight: FontWeight.semibold }}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
                {!!errors.agreeToTerms && (
                  <Text color={Colors.error} fontSize={FontSize.xs} marginTop={-4}>{errors.agreeToTerms}</Text>
                )}
              </>
            )}

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={isAnyLoading}
              activeOpacity={0.87}
              style={{ borderRadius: Radius.full, overflow: 'hidden', opacity: isAnyLoading ? 0.6 : 1 }}
            >
              <LinearGradient
                colors={[Palette.orange500, Palette.orange700]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text color="#fff" fontSize={FontSize.md} fontWeight={FontWeight.bold as any} letterSpacing={0.3}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Forgot password */}
            {mode === 'signin' && (
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleForgotPassword} disabled={loading}>
                <Text color={Colors.primary} fontSize={FontSize.sm} fontWeight={FontWeight.semibold as any}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <XStack alignItems="center" gap={Spacing.md}>
              <View style={{ flex: 1, height: 1, backgroundColor: Colors.borderLight }} />
              <Text color={Colors.textMuted} fontSize={FontSize.sm} fontWeight={FontWeight.medium as any}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: Colors.borderLight }} />
            </XStack>

            {/* Google */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: Colors.surface,
                borderWidth: 1.5,
                borderColor: Colors.border,
                borderRadius: Radius.full,
                height: 52,
                opacity: isAnyLoading ? 0.6 : 1,
              }}
              onPress={handleGoogleAuth}
              disabled={isAnyLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <>
                  <YStack width={22} height={22} borderRadius={11} backgroundColor="#fff" alignItems="center" justifyContent="center" borderWidth={1} borderColor="#e5e7eb">
                    <Text style={{ fontSize: 13, fontWeight: FontWeight.bold, color: '#4285F4', lineHeight: 17 }}>G</Text>
                  </YStack>
                  <Text color={Colors.text} fontSize={FontSize.md} fontWeight={FontWeight.semibold as any}>
                    {mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Biometric */}
            {mode === 'signin' && available && credentialsStored && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  backgroundColor: Colors.primaryLight,
                  borderWidth: 1.5,
                  borderColor: Colors.primaryMuted,
                  borderRadius: Radius.full,
                  height: 52,
                  opacity: isAnyLoading || biometricLoading ? 0.6 : 1,
                }}
                onPress={handleBiometricSignIn}
                disabled={isAnyLoading || biometricLoading}
                activeOpacity={0.85}
              >
                {biometricLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline'}
                      size={22}
                      color={Colors.primary}
                    />
                    <Text color={Colors.primary} fontSize={FontSize.md} fontWeight={FontWeight.semibold as any}>
                      Sign in with {biometricLabel}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Switch mode */}
            <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text
                style={{ color: Colors.primary, fontWeight: FontWeight.bold }}
                onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              >
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
