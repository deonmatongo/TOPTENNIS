import React, { useCallback, useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { Font } from '@/theme/colors'

// ── Layout constants ──────────────────────────────────────────────────────────
const ITEM_H  = 46          // height of each row in pts
const SIDE    = 2           // rows visible above and below the selected row
const TOTAL_H = ITEM_H * (SIDE * 2 + 1)   // 230 pt tall widget

// ── Data helpers ─────────────────────────────────────────────────────────────
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const today = new Date()
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return { year: y, month: m - 1, day: d }
  }
  return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() }
}

// ── Single wheel column ───────────────────────────────────────────────────────
interface WheelColumnProps {
  items: string[]
  selectedIndex: number
  onSelect: (index: number) => void
  flex: number
  selectionColor: string
  textColor: string
}

function WheelColumn({
  items, selectedIndex, onSelect, flex, selectionColor, textColor,
}: WheelColumnProps) {
  const ref = useRef<ScrollView>(null)
  // Track the last index we programmatically scrolled to so we don't fight
  // with an in-flight user gesture.
  const programmaticIdx = useRef(selectedIndex)

  // Initial positioning (no animation).
  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false })
  }, [])

  // When the parent changes selectedIndex (e.g. month → fewer days clamping),
  // scroll to the new position.
  useEffect(() => {
    if (programmaticIdx.current !== selectedIndex) {
      programmaticIdx.current = selectedIndex
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true })
    }
  }, [selectedIndex])

  return (
    <View style={{ flex, height: TOTAL_H, overflow: 'hidden' }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: SIDE * ITEM_H }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.max(
            0,
            Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)),
          )
          programmaticIdx.current = idx
          onSelect(idx)
        }}
      >
        {items.map((label, i) => {
          const dist    = Math.abs(i - selectedIndex)
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.2
          const size    = dist === 0 ? 17 : 14
          const weight  = dist === 0 ? Font.semibold : Font.regular
          return (
            <View key={i} style={styles.item}>
              <Text style={{ fontSize: size, fontFamily: weight, color: textColor, opacity }}>
                {label}
              </Text>
            </View>
          )
        })}
      </ScrollView>

      {/* Selection-row highlight */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.selectionFrame]}>
        <View style={[styles.selectionHighlight, { borderColor: selectionColor }]} />
      </View>
    </View>
  )
}

// ── Public component ──────────────────────────────────────────────────────────
interface DateWheelPickerProps {
  /** ISO date string YYYY-MM-DD, or '' for today */
  value: string
  onChange: (date: string) => void
  /** Smallest year shown. Defaults to current year. */
  minYear?: number
  /** Largest year shown. Defaults to current year + 1. */
  maxYear?: number
}

export function DateWheelPicker({
  value,
  onChange,
  minYear,
  maxYear,
}: DateWheelPickerProps) {
  const { colors: c } = useTheme()

  const today = new Date()
  const yMin  = minYear ?? today.getFullYear()
  const yMax  = maxYear ?? today.getFullYear() + 1

  const { year: selYear, month: selMonth, day: selDay } = parseDate(value)

  // Clamp to the allowed year range.
  const clampedYear  = Math.max(yMin, Math.min(yMax, selYear))
  const clampedMonth = Math.max(0, Math.min(11, selMonth))
  const maxDay       = daysInMonth(clampedYear, clampedMonth)
  const clampedDay   = Math.max(1, Math.min(selDay, maxDay))

  const years  = Array.from({ length: yMax - yMin + 1 }, (_, i) => String(yMin + i))
  const days   = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'))

  const yearIdx  = clampedYear - yMin
  const monthIdx = clampedMonth
  const dayIdx   = clampedDay - 1

  const emit = useCallback((y: number, mo: number, d: number) => {
    const safe = Math.min(d, daysInMonth(y, mo))
    onChange(
      `${y}-${String(mo + 1).padStart(2, '0')}-${String(safe).padStart(2, '0')}`,
    )
  }, [onChange])

  return (
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Month */}
      <WheelColumn
        items={MONTH_LABELS}
        selectedIndex={monthIdx}
        onSelect={(i) => emit(clampedYear, i, clampedDay)}
        flex={5}
        selectionColor={c.border}
        textColor={c.text}
      />

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      {/* Day */}
      <WheelColumn
        items={days}
        selectedIndex={dayIdx}
        onSelect={(i) => emit(clampedYear, clampedMonth, i + 1)}
        flex={2}
        selectionColor={c.border}
        textColor={c.text}
      />

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      {/* Year */}
      <WheelColumn
        items={years}
        selectedIndex={yearIdx}
        onSelect={(i) => emit(yMin + i, clampedMonth, clampedDay)}
        flex={3}
        selectionColor={c.border}
        textColor={c.text}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  selectionFrame: {
    justifyContent: 'center',
  },
  selectionHighlight: {
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
