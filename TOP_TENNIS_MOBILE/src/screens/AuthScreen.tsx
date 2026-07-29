import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  StyleSheet, Dimensions,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as AppleAuthentication from 'expo-apple-authentication'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/services/supabase'
import { Palette, Colors, FontSize, FontWeight, Radius, Spacing } from '@/theme/colors'

const { width: W } = Dimensions.get('window')

// ── Helpers ────────────────────────────────────────────────────────────────────

const getPasswordStrength = (pw: string) => {
  if (!pw) return { score: 0, label: '', color: 'transparent', suggestions: [] as string[] }
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

// ── Field ─────────────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string
  error?: string
  icon?: string
  focused: boolean
  flex?: number
  children: React.ReactNode
}> = ({ label, error, icon, focused, flex, children }) => (
  <View style={[s.fieldWrap, flex ? { flex } : undefined]}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldBox, focused && s.fieldBoxFocused, !!error && s.fieldBoxError]}>
      {icon && (
        <Ionicons
          name={icon as any}
          size={16}
          color={focused ? Palette.orange500 : 'rgba(255,255,255,0.35)'}
          style={{ marginRight: 8 }}
        />
      )}
      {children}
    </View>
    {!!error && <Text style={s.fieldError}>{error}</Text>}
  </View>
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
  const [appleLoading, setAppleLoading] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth()

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false))
    }
  }, [])

  const handleAppleAuth = async () => {
    setAppleLoading(true)
    try { await signInWithApple() }
    catch (e: any) {
      if ((e as any)?.code === 'ERR_REQUEST_CANCELED') return
      Alert.alert('Apple Sign-In Failed', e?.message || 'Could not sign in with Apple.')
    }
    finally { setAppleLoading(false) }
  }

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    try { await signInWithGoogle() }
    catch (e: any) { Alert.alert('Google Sign-In Failed', e?.message || 'Could not sign in with Google.') }
    finally { setGoogleLoading(false) }
  }

  const pwStrength = mode === 'signup' ? getPasswordStrength(password) : null
  const clearError = (field: string) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateSignup = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'Required'
    if (!lastName.trim()) e.lastName = 'Required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    const digits = phone.replace(/\D/g, '')
    if (!phone.trim()) e.phone = 'Phone is required'
    else if (digits.length !== 10) e.phone = 'Enter a valid 10-digit number'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Min 8 characters'
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (!agreeToTerms) e.agreeToTerms = 'You must agree to continue'
    setErrors(e)
    return Object.keys(e).length === 0
  }, [firstName, lastName, email, phone, password, confirmPassword, agreeToTerms])

  const handleForgotPassword = async () => {
    if (!email.trim()) { Alert.alert('Enter your email', 'Enter your email above first.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'toptennis://reset-password' })
      if (error) throw error
      Alert.alert('Check your email', `Reset link sent to ${email.trim()}.`)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send reset email.')
    } finally { setLoading(false) }
  }

  const handleAuth = async () => {
    if (mode === 'signup') {
      if (!validateSignup()) return
      setLoading(true)
      try { await signUp(email.trim(), password, firstName.trim(), lastName.trim(), phone) }
      catch (e: any) { Alert.alert('Registration Failed', e?.message || 'Could not create account.') }
      finally { setLoading(false) }
    } else {
      if (!email.trim() || !password.trim()) { Alert.alert('Missing fields', 'Please enter your email and password.'); return }
      setLoading(true)
      try {
        await signIn(email.trim(), password)
      } catch (e: any) { Alert.alert('Sign In Failed', e?.message || 'Incorrect email or password.') }
      finally { setLoading(false) }
    }
  }

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next); setErrors({}); setPassword(''); setConfirmPassword(''); setPhone(''); setAgreeToTerms(false)
  }

  const isAnyLoading = loading || googleLoading || appleLoading

  return (
    <LinearGradient colors={[Palette.navy, '#0f1e38', '#112240']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Hero ── */}
            <View style={s.hero}>
              {/* Decorative rings */}
              <View style={s.ring1} />
              <View style={s.ring2} />

              {/* Logo mark */}
              <View style={s.logoMark}>
                <LinearGradient
                  colors={[Palette.orange500, Palette.orange700]}
                  style={s.logoCircle}
                >
                  <Ionicons name="tennisball" size={38} color="#fff" />
                </LinearGradient>
                <View style={s.logoGlow} />
              </View>

              {/* App name */}
              <View style={s.logoRow}>
                <Text style={s.logoT}>Top</Text>
                <Text style={s.logoTennis}>Tennis</Text>
              </View>

              {/* Headline */}
              <Text style={s.headline}>
                {mode === 'signin' ? 'Welcome back.' : 'Join the community.'}
              </Text>
              <Text style={s.subline}>
                {mode === 'signin'
                  ? 'Sign in to continue your game'
                  : 'Create your account and start playing'}
              </Text>
            </View>

            {/* ── Tab toggle ── */}
            <View style={s.tabWrap}>
              {(['signin', 'signup'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.tabBtn, mode === m && s.tabBtnActive]}
                  onPress={() => switchMode(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.tabLabel, mode === m && s.tabLabelActive]}>
                    {m === 'signin' ? 'Sign In' : 'Create Account'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Form ── */}
            <View style={s.form}>

              {mode === 'signup' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Field label="First Name" error={errors.firstName} focused={focusedField === 'firstName'} flex={1}>
                      <TextInput
                        style={s.input}
                        placeholder="John"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={firstName}
                        onChangeText={v => { setFirstName(v); clearError('firstName') }}
                        onFocus={() => setFocusedField('firstName')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                      />
                    </Field>
                    <Field label="Last Name" error={errors.lastName} focused={focusedField === 'lastName'} flex={1}>
                      <TextInput
                        style={s.input}
                        placeholder="Doe"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={lastName}
                        onChangeText={v => { setLastName(v); clearError('lastName') }}
                        onFocus={() => setFocusedField('lastName')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                      />
                    </Field>
                  </View>

                  <Field label="Phone Number" error={errors.phone} icon="call-outline" focused={focusedField === 'phone'}>
                    <TextInput
                      style={s.input}
                      placeholder="(555) 123-4567"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={phone}
                      onChangeText={v => { setPhone(formatPhone(v)); clearError('phone') }}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                    />
                  </Field>
                </>
              )}

              <Field label="Email Address" error={errors.email} icon="mail-outline" focused={focusedField === 'email'}>
                <TextInput
                  style={s.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={email}
                  onChangeText={v => { setEmail(v); clearError('email') }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </Field>

              <Field label="Password" error={errors.password} icon="lock-closed-outline" focused={focusedField === 'password'}>
                <TextInput
                  style={s.input}
                  placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={v => { setPassword(v); clearError('password') }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              </Field>

              {/* Password strength */}
              {mode === 'signup' && password.length > 0 && pwStrength && (
                <View style={{ gap: 6, marginTop: -4 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.1)' }} />
                    ))}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: FontWeight.semibold, color: pwStrength.color }}>
                    {pwStrength.label}
                  </Text>
                </View>
              )}

              {mode === 'signup' && (
                <Field label="Confirm Password" error={errors.confirmPassword} icon="lock-closed-outline" focused={focusedField === 'confirmPassword'}>
                  <TextInput
                    style={s.input}
                    placeholder="Re-enter your password"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword') }}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={{ padding: 4 }}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                </Field>
              )}

              {/* Terms */}
              {mode === 'signup' && (
                <>
                  <TouchableOpacity style={s.termsRow} onPress={() => { setAgreeToTerms(v => !v); clearError('agreeToTerms') }} activeOpacity={0.7}>
                    <View style={[s.checkbox, agreeToTerms && s.checkboxActive]}>
                      {agreeToTerms && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={s.termsText}>
                      {'I agree to the '}
                      <Text style={s.termsLink} onPress={() => WebBrowser.openBrowserAsync('https://toptennis.app/terms')}>Terms of Service</Text>
                      {' and '}
                      <Text style={s.termsLink} onPress={() => WebBrowser.openBrowserAsync('https://toptennis.app/privacy')}>Privacy Policy</Text>
                      {', including a zero-tolerance policy for objectionable content and abusive behavior.'}
                    </Text>
                  </TouchableOpacity>
                  {!!errors.agreeToTerms && <Text style={s.fieldError}>{errors.agreeToTerms}</Text>}
                </>
              )}

              {/* Submit */}
              <TouchableOpacity onPress={handleAuth} disabled={isAnyLoading} activeOpacity={0.87} style={{ opacity: isAnyLoading ? 0.6 : 1 }}>
                <LinearGradient
                  colors={[Palette.orange500, Palette.orange700]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.submitBtn}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.submitBtnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Forgot password */}
              {mode === 'signin' && (
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleForgotPassword} disabled={loading}>
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Apple — equal prominence to Google, required by Guideline 4.8 */}
              {appleAvailable && Platform.OS === 'ios' && (
                <View style={{ opacity: isAnyLoading ? 0.6 : 1 }} pointerEvents={isAnyLoading ? 'none' : 'auto'}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={26}
                    style={s.appleBtn}
                    onPress={handleAppleAuth}
                  />
                </View>
              )}

              {/* Google */}
              <TouchableOpacity style={[s.socialBtn, { opacity: isAnyLoading ? 0.6 : 1 }]} onPress={handleGoogleAuth} disabled={isAnyLoading} activeOpacity={0.85}>
                {googleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <View style={s.googleIcon}>
                      <Text style={{ fontSize: 13, fontWeight: FontWeight.bold, color: '#4285F4' }}>G</Text>
                    </View>
                    <Text style={s.socialBtnText}>{mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Switch mode */}
              <Text style={s.switchText}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={s.switchLink} onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero
  hero: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 36,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ring1: {
    position: 'absolute', left: '50%', top: 20,
    width: 280, height: 280, borderRadius: 140,
    marginLeft: -140,
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.08)',
  },
  ring2: {
    position: 'absolute', left: '50%', top: 50,
    width: 180, height: 180, borderRadius: 90,
    marginLeft: -90,
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.05)',
  },
  logoMark: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  logoGlow: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Palette.orange500,
    opacity: 0.15,
    transform: [{ scaleX: 1.4 }, { scaleY: 0.4 }],
    top: 60,
  },
  logoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 20 },
  logoT: { color: '#fff', fontSize: 28, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  logoTennis: { color: Palette.orange500, fontSize: 28, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  headline: { color: '#fff', fontSize: 32, fontWeight: FontWeight.black, letterSpacing: -0.8, marginBottom: 8, textAlign: 'center' },
  subline: { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: FontWeight.medium, textAlign: 'center' },

  // Tabs
  tabWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Palette.orange500 },
  tabLabel: { fontSize: 14, fontWeight: FontWeight.semibold, color: 'rgba(255,255,255,0.45)' },
  tabLabelActive: { color: '#fff' },

  // Form
  form: { paddingHorizontal: 20, gap: 16 },

  // Fields
  fieldWrap: { gap: 6 },
  fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.lg, paddingHorizontal: 14, minHeight: 52,
  },
  fieldBoxFocused: { borderColor: Palette.orange500, backgroundColor: 'rgba(251,146,60,0.07)' },
  fieldBoxError: { borderColor: '#ef4444' },
  fieldError: { color: '#ef4444', fontSize: 11 },
  input: { flex: 1, fontSize: 15, color: '#fff', paddingVertical: 0 },

  // Terms
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Palette.orange500, borderColor: Palette.orange500 },
  termsText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  termsLink: { color: Palette.orange500, fontWeight: FontWeight.semibold },

  // Submit
  submitBtn: { height: 54, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.3 },

  // Forgot
  forgotText: { color: Palette.orange500, fontSize: 14, fontWeight: FontWeight.semibold },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },

  // Apple
  appleBtn: { width: '100%', height: 52 },

  // Social
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full, height: 52,
  },
  socialBtnText: { color: '#fff', fontSize: 15, fontWeight: FontWeight.semibold },
  googleIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },

  // Switch
  switchText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  switchLink: { color: Palette.orange500, fontWeight: FontWeight.bold },
})
