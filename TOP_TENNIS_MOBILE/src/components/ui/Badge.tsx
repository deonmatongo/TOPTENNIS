import React from 'react'
import { View, ViewStyle } from 'react-native'
import { XStack, Text } from 'tamagui'
import { FontSize, FontWeight, Radius, Spacing, Palette } from '@/theme/colors'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' | 'dark'

interface BadgeProps {
  label:    string
  variant?: BadgeVariant
  style?:   ViewStyle
  dot?:     boolean
}

const MAP: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: Palette.greenBg,   text: Palette.green600, dot: Palette.green500  },
  warning: { bg: Palette.yellowBg,  text: '#B45309',        dot: Palette.yellow500 },
  error:   { bg: Palette.redBg,     text: Palette.red600,   dot: Palette.red500    },
  info:    { bg: Palette.blueBg,    text: Palette.blue600,  dot: Palette.blue500   },
  primary: { bg: Palette.orange50,  text: Palette.orange600,dot: Palette.orange500 },
  default: { bg: Palette.gray150,   text: Palette.gray600,  dot: Palette.gray400   },
  dark:    { bg: Palette.dark700,   text: Palette.white,    dot: Palette.orange500 },
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style, dot = false }) => {
  const { bg, text, dot: dotColor } = MAP[variant]

  return (
    <XStack
      backgroundColor={bg}
      paddingHorizontal={Spacing.sm + 2}
      paddingVertical={4}
      borderRadius={Radius.full}
      alignItems="center"
      alignSelf="flex-start"
      gap={4}
      {...(style as any)}
    >
      {dot && (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
      )}
      <Text
        fontSize={FontSize.xs}
        color={text}
        fontWeight={FontWeight.semibold as any}
        letterSpacing={0.1}
      >
        {label}
      </Text>
    </XStack>
  )
}
