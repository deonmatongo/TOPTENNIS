import React from 'react'
import { ViewStyle } from 'react-native'
import { YStack } from 'tamagui'
import { Colors, Radius, Shadow } from '@/theme/colors'

type CardVariant = 'default' | 'elevated' | 'flat' | 'outlined' | 'dark'

interface CardProps {
  children:  React.ReactNode
  style?:    ViewStyle
  elevated?: boolean
  variant?:  CardVariant
  padding?:  number
  radius?:   number
  onPress?:  () => void
}

const variantStyles: Record<CardVariant, object> = {
  default: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  elevated: {
    backgroundColor: Colors.surface,
    borderWidth: 0,
    ...Shadow.md,
  },
  flat: {
    backgroundColor: Colors.surfaceWarm,
  },
  outlined: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dark: {
    backgroundColor: Colors.surfaceDark,
    borderWidth: 0,
    ...Shadow.md,
  },
}

export const Card: React.FC<CardProps> = ({
  children, style, elevated = false, variant,
  padding = 16, radius, onPress,
}) => {
  const v: CardVariant = variant ?? (elevated ? 'elevated' : 'default')
  const vs = variantStyles[v]

  if (onPress) {
    return (
      <YStack
        onPress={onPress}
        pressStyle={{ opacity: 0.88, scale: 0.985 }}
        animation="fast"
        borderRadius={radius ?? Radius.lg}
        overflow="hidden"
        padding={padding}
        {...(vs as any)}
        {...(style as any)}
      >
        {children}
      </YStack>
    )
  }

  return (
    <YStack
      borderRadius={radius ?? Radius.lg}
      overflow="hidden"
      padding={padding}
      {...(vs as any)}
      {...(style as any)}
    >
      {children}
    </YStack>
  )
}
