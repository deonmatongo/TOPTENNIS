import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { XStack, YStack, Text } from 'tamagui'
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/theme/colors'

interface ScreenHeaderProps {
  title:         string
  subtitle?:     string
  navigation?:   any
  showBack?:     boolean
  rightElement?: React.ReactNode
  gradient?:     boolean
  centered?:     boolean
  dark?:         boolean
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title, subtitle, navigation,
  showBack = false, rightElement, centered = false, dark = false,
}) => {
  const insets = useSafeAreaInsets()
  const bg  = dark ? Colors.surfaceDark : Colors.surface
  const col = dark ? Colors.textOnDark  : Colors.text
  const sub = dark ? Colors.textOnDarkMuted : Colors.textMuted

  return (
    <YStack
      backgroundColor={bg}
      paddingHorizontal={Spacing.lg}
      paddingBottom={Spacing.md}
      paddingTop={insets.top + 4}
      borderBottomWidth={1}
      borderBottomColor={Colors.separator}
      {...(Shadow.xs as any)}
    >
      <XStack alignItems="center" minHeight={48} gap={Spacing.sm}>

        {showBack && navigation ? (
          <TouchableOpacity
            style={{
              width: 38,
              height: 38,
              borderRadius: Radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? 'rgba(255,255,255,0.10)' : Colors.backgroundAlt,
            }}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={col} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}

        <YStack
          flex={1}
          paddingHorizontal={4}
          alignItems={centered ? 'center' : 'flex-start'}
        >
          <Text
            fontSize={FontSize.xl}
            fontWeight={FontWeight.bold as any}
            color={col}
            letterSpacing={-0.4}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              fontSize={FontSize.xs}
              fontWeight={FontWeight.medium as any}
              color={sub}
              marginTop={1}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </YStack>

        <View style={{ width: 38, alignItems: 'flex-end', justifyContent: 'center' }}>
          {rightElement ?? null}
        </View>

      </XStack>
    </YStack>
  )
}
