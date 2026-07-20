import React, { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface ProgressRingProps {
  /** 0–100 */
  progress: number
  size?: number
  strokeWidth?: number
  /** start colour of the gradient stroke */
  fromColor?: string
  /** end colour of the gradient stroke */
  toColor?: string
  trackColor?: string
  children?: React.ReactNode
  /** ms */
  duration?: number
}

/**
 * A circular progress ring with an animated gradient stroke.
 * The arc sweeps from empty to `progress`% on mount and whenever it changes.
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 10,
  fromColor = '#FF5500',
  toColor = '#FB923C',
  trackColor = 'rgba(255,255,255,0.12)',
  children,
  duration = 1100,
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, progress))

  const sweep = useSharedValue(0)

  useEffect(() => {
    sweep.value = withTiming(clamped / 100, {
      duration,
      easing: Easing.out(Easing.cubic),
    })
  }, [clamped, duration, sweep])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - sweep.value),
  }))

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={fromColor} />
            <Stop offset="1" stopColor={toColor} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // rotate so the arc starts at 12 o'clock
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  )
}
