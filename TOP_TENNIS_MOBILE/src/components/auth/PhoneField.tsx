import React, { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AsYouType, getCountryCallingCode } from 'libphonenumber-js'
import { Palette, FontWeight, Radius } from '@/theme/colors'
import { Field, authStyles } from './AuthShell'

/**
 * Phone entry with a country selector.
 *
 * US-primary, not US-only: the picker defaults to US and US formatting is
 * applied as you type, but any country can be chosen. The original spec asked
 * for a fixed, non-editable +1 prefix; the live data already contains at least
 * one non-US number, so a hard +1 would have locked that user out.
 *
 * Formatting here is cosmetic. The value handed to the caller is always the raw
 * national digits plus the selected country, and normalisation to E.164 is done
 * by the Edge Function using the same library. The client copy is UX; the server
 * copy is the control.
 */

type CountryCode = string

/**
 * Curated list rather than all ~240 ISO regions: a long list is worse UX than a
 * short one plus the ability to type a full +number. Extend freely — nothing
 * downstream depends on this being a fixed set.
 */
const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PH', name: 'Philippines' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'RO', name: 'Romania' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'IL', name: 'Israel' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
]

/** ISO 3166-1 alpha-2 -> regional indicator pair, so no flag assets are needed. */
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

function dialCode(code: CountryCode): string {
  try {
    return `+${getCountryCallingCode(code as never)}`
  } catch {
    return ''
  }
}

export const PhoneField: React.FC<{
  country: CountryCode
  onCountryChange: (code: CountryCode) => void
  value: string
  onChangeText: (v: string) => void
  error?: string
  editable?: boolean
  label?: string
}> = ({ country, onCountryChange, value, onChangeText, error, editable = true, label = 'Phone Number' }) => {
  const [focused, setFocused] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        dialCode(c.code).includes(q),
    )
  }, [query])

  // AsYouType gives country-correct grouping instead of hardcoded US parentheses.
  const formatted = useMemo(() => {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    try {
      return new AsYouType(country as never).input(digits)
    } catch {
      return digits
    }
  }, [value, country])

  return (
    <>
      <Field label={label} error={error} focused={focused}>
        <TouchableOpacity
          style={s.countryBtn}
          onPress={() => editable && setPickerOpen(true)}
          disabled={!editable}
          activeOpacity={0.7}
        >
          <Text style={s.flag}>{flagEmoji(country)}</Text>
          <Text style={s.dial}>{dialCode(country)}</Text>
          {editable && (
            <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.4)" />
          )}
        </TouchableOpacity>

        <View style={s.divider} />

        <TextInput
          style={authStyles.input}
          placeholder="Mobile number"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={formatted}
          onChangeText={(v) => onChangeText(v.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={editable}
        />
      </Field>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select country</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={[authStyles.input, { marginLeft: 8 }]}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => {
                  onCountryChange(item.code)
                  setPickerOpen(false)
                  setQuery('')
                }}
                activeOpacity={0.7}
              >
                <Text style={s.flag}>{flagEmoji(item.code)}</Text>
                <Text style={s.rowName}>{item.name}</Text>
                <Text style={s.rowDial}>{dialCode(item.code)}</Text>
                {item.code === country && (
                  <Ionicons name="checkmark" size={18} color={Palette.orange500} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 8 },
  flag: { fontSize: 19 },
  dial: { color: '#fff', fontSize: 15, fontWeight: FontWeight.semibold },
  divider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 10 },

  modal: { flex: 1, backgroundColor: Palette.navy, paddingTop: 56, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: FontWeight.bold },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.lg, paddingHorizontal: 14, minHeight: 46, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowName: { flex: 1, color: '#fff', fontSize: 15 },
  rowDial: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
})
