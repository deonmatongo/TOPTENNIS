import React, { ReactNode } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Palette, FontWeight, Radius } from '@/theme/colors'

/**
 * Shared chrome for the six auth screens.
 *
 * Extracted from the old single AuthScreen so the phone/username flow does not
 * duplicate ~120 lines of gradient, ring and field styling six times over.
 */

export const AuthShell: React.FC<{
  headline: string
  subline?: string
  onBack?: () => void
  children: ReactNode
}> = ({ headline, subline, onBack, children }) => (
  <LinearGradient colors={[Palette.navy, '#0f1e38', '#112240']} style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!!onBack && (
            <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}

          <View style={s.hero}>
            <View style={s.ring1} />
            <View style={s.ring2} />

            <View style={s.logoMark}>
              <LinearGradient colors={[Palette.orange500, Palette.orange700]} style={s.logoCircle}>
                <Ionicons name="tennisball" size={38} color="#fff" />
              </LinearGradient>
              <View style={s.logoGlow} />
            </View>

            <View style={s.logoRow}>
              <Text style={s.logoT}>Top</Text>
              <Text style={s.logoTennis}>Tennis</Text>
            </View>

            <Text style={s.headline}>{headline}</Text>
            {!!subline && <Text style={s.subline}>{subline}</Text>}
          </View>

          <View style={s.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </LinearGradient>
)

export const Field: React.FC<{
  label: string
  error?: string
  hint?: string
  icon?: string
  focused?: boolean
  flex?: number
  /** Renders a spinner inside the box — used for debounced username checks. */
  busy?: boolean
  /** Renders a tick inside the box. */
  ok?: boolean
  children: ReactNode
}> = ({ label, error, hint, icon, focused, flex, busy, ok, children }) => (
  <View style={[s.fieldWrap, flex ? { flex } : undefined]}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldBox, focused && s.fieldBoxFocused, !!error && s.fieldBoxError]}>
      {icon && (
        <Ionicons
          name={icon as never}
          size={16}
          color={focused ? Palette.orange500 : 'rgba(255,255,255,0.35)'}
          style={{ marginRight: 8 }}
        />
      )}
      {children}
      {busy && <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />}
      {!busy && ok && <Ionicons name="checkmark-circle" size={18} color="#22c55e" />}
    </View>
    {!!error && <Text style={s.fieldError}>{error}</Text>}
    {!error && !!hint && <Text style={s.fieldHint}>{hint}</Text>}
  </View>
)

export const SubmitButton: React.FC<{
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}> = ({ label, onPress, loading, disabled }) => {
  const off = loading || disabled
  return (
    <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.87} style={{ opacity: off ? 0.6 : 1 }}>
      <LinearGradient
        colors={[Palette.orange500, Palette.orange700]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.submitBtn}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  )
}

export const authStyles = StyleSheet.create({
  input: { flex: 1, fontSize: 15, color: '#fff', paddingVertical: 0 },
  linkText: { color: Palette.orange500, fontSize: 14, fontWeight: FontWeight.semibold },
  switchText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  switchLink: { color: Palette.orange500, fontWeight: FontWeight.bold },
  fieldError: { color: '#ef4444', fontSize: 11 },
  centered: { alignItems: 'center' },
  note: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 20, textAlign: 'center' },
})

const s = StyleSheet.create({
  backBtn: { position: 'absolute', top: 8, left: 12, zIndex: 10, padding: 8 },

  hero: {
    paddingHorizontal: 28, paddingTop: 40, paddingBottom: 32,
    alignItems: 'center', position: 'relative', overflow: 'hidden',
  },
  ring1: {
    position: 'absolute', left: '50%', top: 20,
    width: 280, height: 280, borderRadius: 140, marginLeft: -140,
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.08)',
  },
  ring2: {
    position: 'absolute', left: '50%', top: 50,
    width: 180, height: 180, borderRadius: 90, marginLeft: -90,
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.05)',
  },
  logoMark: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
  },
  logoGlow: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: Palette.orange500, opacity: 0.15,
    transform: [{ scaleX: 1.4 }, { scaleY: 0.4 }], top: 60,
  },
  logoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 20 },
  logoT: { color: '#fff', fontSize: 28, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  logoTennis: { color: Palette.orange500, fontSize: 28, fontWeight: FontWeight.black, letterSpacing: -0.5 },
  headline: { color: '#fff', fontSize: 30, fontWeight: FontWeight.black, letterSpacing: -0.8, marginBottom: 8, textAlign: 'center' },
  subline: { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: FontWeight.medium, textAlign: 'center' },

  form: { paddingHorizontal: 20, gap: 16 },

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
  fieldHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },

  submitBtn: { height: 54, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.3 },
})
