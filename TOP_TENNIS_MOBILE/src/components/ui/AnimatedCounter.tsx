import React, { useEffect, useState } from 'react'
import { Text, TextProps, TextStyle, StyleProp } from 'react-native'

interface AnimatedCounterProps {
  value: number
  /** ms */
  duration?: number
  /** appended after the number, e.g. "%" */
  suffix?: string
  style?: StyleProp<TextStyle>
}

/**
 * Counts up from 0 to `value` over `duration` ms using requestAnimationFrame.
 * Re-runs whenever `value` changes.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps & TextProps> = ({
  value,
  duration = 900,
  suffix = '',
  style,
  ...rest
}) => {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf: number
    let start: number | null = null
    const from = 0
    const to = value

    const tick = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(to)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <Text style={style} {...rest}>
      {display}{suffix}
    </Text>
  )
}
