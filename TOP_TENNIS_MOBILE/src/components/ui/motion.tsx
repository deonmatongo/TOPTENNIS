import React, { useEffect } from 'react'
import { StyleProp, ViewStyle, Pressable, PressableProps } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring,
  withRepeat, withSequence, Easing,
} from 'react-native-reanimated'

// ─── FadeInView ─────────────────────────────────────────────────────────────
// Entrance animation driven by a shared value (works with the reanimated jest
// mock, unlike the declarative `entering={FadeInDown}` layout builders).

interface FadeInViewProps {
  children: React.ReactNode
  /** ms before the animation starts — use for staggering a list of cards */
  delay?: number
  /** direction the content travels from */
  from?: 'down' | 'up' | 'left' | 'right' | 'none'
  distance?: number
  duration?: number
  style?: StyleProp<ViewStyle>
}

export const FadeInView: React.FC<FadeInViewProps> = ({
  children, delay = 0, from = 'down', distance = 18, duration = 480, style,
}) => {
  const p = useSharedValue(0)

  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }))
  }, [delay, duration, p])

  const anim = useAnimatedStyle(() => {
    const inv = 1 - p.value
    let translateX = 0
    let translateY = 0
    if (from === 'down') translateY = inv * distance
    else if (from === 'up') translateY = -inv * distance
    else if (from === 'left') translateX = -inv * distance
    else if (from === 'right') translateX = inv * distance
    return { opacity: p.value, transform: [{ translateX }, { translateY }] as any }
  })

  return <Animated.View style={[anim, style]}>{children}</Animated.View>
}

// ─── PressableScale ─────────────────────────────────────────────────────────
// A Pressable that springs down slightly while pressed.

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode
  scaleTo?: number
  style?: StyleProp<ViewStyle>
}

export const PressableScale: React.FC<PressableScaleProps> = ({
  children, scaleTo = 0.96, style, onPressIn, onPressOut, ...rest
}) => {
  const scale = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        onPressIn={(e) => { scale.value = withSpring(scaleTo, { damping: 20, stiffness: 420 }); onPressIn?.(e) }}
        onPressOut={(e) => { scale.value = withSpring(1, { damping: 14, stiffness: 320 }); onPressOut?.(e) }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

// ─── Pulse ────────────────────────────────────────────────────────────────────
// Gently pulses its children forever — used to draw the eye to a live streak.

export const Pulse: React.FC<{ children: React.ReactNode; active?: boolean; style?: StyleProp<ViewStyle> }> = ({
  children, active = true, style,
}) => {
  const s = useSharedValue(1)

  useEffect(() => {
    if (active) {
      s.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 620, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      s.value = withTiming(1, { duration: 200 })
    }
  }, [active, s])

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  return <Animated.View style={[anim, style]}>{children}</Animated.View>
}
