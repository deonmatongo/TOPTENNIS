import React from 'react'
import { View, ViewProps, ViewStyle } from 'react-native'

/**
 * Transitional replacement for Tamagui's XStack / YStack.
 *
 * Tamagui accepted layout values as top-level props (`gap={8}`); React Native
 * wants them inside `style`. This forwards them so call sites migrate off
 * Tamagui without being rewritten — see PHASE0_AUDIT §0.2. Phase 2 replaces
 * these with the real Spec §6 primitives; nothing new should be written
 * against them.
 *
 * Anything that isn't a recognised View prop is treated as a style value, so
 * the whole ViewStyle surface works without maintaining an allowlist.
 */

const VIEW_PROPS = new Set([
  'children', 'style', 'testID', 'nativeID', 'id', 'ref', 'key',
  'pointerEvents', 'hitSlop', 'collapsable', 'focusable', 'tabIndex',
  'removeClippedSubviews', 'needsOffscreenAlphaCompositing',
  'renderToHardwareTextureAndroid', 'shouldRasterizeIOS',
  'importantForAccessibility', 'role',
])

const isViewProp = (key: string) =>
  VIEW_PROPS.has(key) ||
  key.startsWith('on') ||
  key.startsWith('accessib') ||
  key.startsWith('aria')

export type StackProps = ViewProps & ViewStyle

function split(props: StackProps, flexDirection: 'row' | 'column') {
  const style: Record<string, unknown> = { flexDirection }
  const rest: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if (key === 'style' || key === 'children') continue
    if (isViewProp(key)) rest[key] = value
    else if (value !== undefined) style[key] = value
  }

  return { style: style as ViewStyle, rest }
}

export const XStack: React.FC<StackProps> = (props) => {
  const { style, rest } = split(props, 'row')
  return <View {...rest} style={[style, props.style]}>{props.children}</View>
}

export const YStack: React.FC<StackProps> = (props) => {
  const { style, rest } = split(props, 'column')
  return <View {...rest} style={[style, props.style]}>{props.children}</View>
}
