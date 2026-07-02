import React, { useState } from 'react'
import {
  TextInput, TouchableOpacity, ViewStyle, TextInputProps,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { YStack, XStack, Text } from 'tamagui'
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors'

interface InputProps extends TextInputProps {
  label?:            string
  error?:            string
  leftIcon?:         keyof typeof Ionicons.glyphMap
  rightIcon?:        keyof typeof Ionicons.glyphMap
  onRightIconPress?: () => void
  containerStyle?:   ViewStyle
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  secureTextEntry,
  ...props
}) => {
  const [focused, setFocused] = useState(false)
  const [secure, setSecure]   = useState(secureTextEntry)
  const isPassword = secureTextEntry

  const borderColor = error
    ? Colors.error
    : focused
    ? Colors.primary
    : Colors.border
  const borderWidth = focused && !error ? 2 : 1.5

  return (
    <YStack marginBottom={Spacing.md} gap={4} {...(containerStyle as any)}>
      {label && (
        <Text
          fontSize={FontSize.sm}
          color={Colors.text}
          fontWeight="500"
        >
          {label}
        </Text>
      )}

      <XStack
        alignItems="center"
        backgroundColor={Colors.surface}
        borderWidth={borderWidth}
        borderColor={borderColor}
        borderRadius={Radius.md}
        paddingHorizontal={Spacing.md}
        height={52}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={focused ? Colors.primary : Colors.textMuted}
            style={{ marginRight: Spacing.sm }}
          />
        )}

        <TextInput
          style={{
            flex: 1,
            fontSize: FontSize.md,
            color: Colors.text,
            height: '100%',
          }}
          placeholderTextColor={Colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity onPress={() => setSecure(s => !s)} style={{ marginLeft: Spacing.sm }}>
            <Ionicons
              name={secure ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress} style={{ marginLeft: Spacing.sm }}>
            <Ionicons name={rightIcon} size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </XStack>

      {error && (
        <Text fontSize={FontSize.xs} color={Colors.error} marginTop={2}>
          {error}
        </Text>
      )}
    </YStack>
  )
}
