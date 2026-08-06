import React, { useEffect, useRef } from 'react'
import { View, TextInput, StyleSheet, Platform } from 'react-native'
import { Palette, FontWeight, Radius } from '@/theme/colors'

/**
 * Six-digit SMS code entry.
 *
 * Rendered as six boxes but backed by ONE TextInput, deliberately. Six separate
 * inputs look identical and are what most implementations do, but they break OS
 * autofill: iOS fills `oneTimeCode` into a single field and Android's
 * `sms-otp` hint pastes the whole code at once. With six inputs the user gets one
 * digit and five empty boxes.
 *
 * The visible boxes are non-interactive text; taps anywhere focus the real input.
 */

export const OtpInput: React.FC<{
  value: string
  onChange: (v: string) => void
  /** Fired once the sixth digit lands, including on an autofill paste. */
  onComplete?: (v: string) => void
  length?: number
  autoFocus?: boolean
  editable?: boolean
  error?: boolean
}> = ({ value, onChange, onComplete, length = 6, autoFocus = true, editable = true, error }) => {
  const inputRef = useRef<TextInput>(null)
  const firedFor = useRef<string | null>(null)

  useEffect(() => {
    if (value.length === length && firedFor.current !== value) {
      firedFor.current = value
      onComplete?.(value)
    }
    if (value.length < length) firedFor.current = null
  }, [value, length, onComplete])

  const digits = value.padEnd(length, ' ').slice(0, length).split('')

  return (
    <View style={s.wrap} onTouchEnd={() => inputRef.current?.focus()}>
      {digits.map((d, i) => {
        const filled = d.trim() !== ''
        const active = i === value.length && editable
        return (
          <View
            key={i}
            style={[s.box, filled && s.boxFilled, active && s.boxActive, error && s.boxError]}
            pointerEvents="none"
          >
            <TextInput
              style={s.boxText}
              value={filled ? d : ''}
              editable={false}
              pointerEvents="none"
            />
          </View>
        )
      })}

      <TextInput
        ref={inputRef}
        style={s.hidden}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        // The two hints that let the OS fill the code without the user reading it.
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        caretHidden
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, justifyContent: 'center', position: 'relative' },
  box: {
    width: 46, height: 56, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  boxFilled: { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  boxActive: { borderColor: Palette.orange500, backgroundColor: 'rgba(251,146,60,0.08)' },
  boxError: { borderColor: '#ef4444' },
  boxText: {
    color: '#fff', fontSize: 22, fontWeight: FontWeight.bold,
    textAlign: 'center', width: '100%', padding: 0,
  },
  // Covers the boxes so a tap focuses it, but invisible.
  hidden: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0, color: 'transparent', fontSize: 1,
  },
})
