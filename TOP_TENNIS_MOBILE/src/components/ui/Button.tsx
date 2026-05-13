import React from 'react'
import {
  TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { XStack, Text } from 'tamagui'
import { Colors, Radius, FontSize, FontWeight, Shadow, Palette } from '@/theme/colors'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps {
  label:      string
  onPress:    () => void
  variant?:   Variant
  size?:      Size
  loading?:   boolean
  disabled?:  boolean
  style?:     ViewStyle
  textStyle?: TextStyle
  fullWidth?: boolean
  icon?:      React.ReactNode
  iconRight?: boolean
}

const sizeMap: Record<Size, { px: number; py: number; radius: number; fontSize: number }> = {
  xs: { px: 10, py: 5,  radius: Radius.sm, fontSize: FontSize.xs },
  sm: { px: 14, py: 8,  radius: Radius.sm, fontSize: FontSize.sm },
  md: { px: 20, py: 13, radius: Radius.md, fontSize: FontSize.md },
  lg: { px: 24, py: 16, radius: Radius.lg, fontSize: FontSize.lg },
}

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false,
  style, textStyle, fullWidth = false, icon, iconRight = false,
}) => {
  const isDisabled = disabled || loading
  const s = sizeMap[size]

  const spinnerColor = variant === 'outline' || variant === 'ghost' ? Colors.primary : '#fff'
  const content = loading ? (
    <ActivityIndicator size="small" color={spinnerColor} />
  ) : (
    <XStack
      alignItems="center"
      gap={6}
      flexDirection={iconRight ? 'row-reverse' : 'row'}
    >
      {icon && <>{icon}</>}
      <Text
        color={textColors[variant]}
        fontSize={s.fontSize}
        fontWeight={FontWeight.semibold as any}
        {...(textStyle as any)}
      >
        {label}
      </Text>
    </XStack>
  )

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.82}
        style={[fullWidth ? { width: '100%' } : {}, isDisabled ? { opacity: 0.45 } : {}, style]}
      >
        <LinearGradient
          colors={[Palette.orange500, Palette.orange700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: s.px,
            paddingVertical: s.py,
            borderRadius: s.radius,
            ...Shadow.orange,
          }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  if (variant === 'dark') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.82}
        style={[fullWidth ? { width: '100%' } : {}, isDisabled ? { opacity: 0.45 } : {}, style]}
      >
        <LinearGradient
          colors={[Palette.dark800, Palette.dark700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: s.px,
            paddingVertical: s.py,
            borderRadius: s.radius,
          }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  const containerStyle = containerStyles[variant]

  return (
    <XStack
      onPress={onPress}
      disabled={isDisabled}
      pressStyle={{ opacity: 0.72, scale: 0.97 }}
      animation="fast"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal={s.px}
      paddingVertical={s.py}
      borderRadius={s.radius}
      opacity={isDisabled ? 0.45 : 1}
      width={fullWidth ? '100%' : undefined}
      {...containerStyle}
      {...(style as any)}
    >
      {content}
    </XStack>
  )
}

const textColors: Record<Variant, string> = {
  primary:   '#fff',
  secondary: Colors.primaryDark,
  outline:   Colors.primary,
  ghost:     Colors.primary,
  danger:    '#fff',
  dark:      '#fff',
}

const containerStyles: Record<string, object> = {
  secondary: { backgroundColor: Colors.primaryLight },
  outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: Colors.error },
}
