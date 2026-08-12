import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { selection as hapticSelection } from '@/utils/haptics';
import Animated, { ZoomIn, FadeIn } from 'react-native-reanimated';
import { Palette, Font } from '@/theme/colors';
import { useResponsive } from '@/hooks/useResponsive';

/** Phone tab bar compact height (pill), excluding the safe-area inset. */
export const TAB_BAR_HEIGHT = 62;

const PILL_RADIUS = 28;
const PILL_BG     = 'rgba(11,21,38,0.95)';
const PILL_BORDER = 'rgba(255,255,255,0.10)';
const ACTIVE_FILL = 'rgba(249,115,22,0.28)';
const ICON_INACTIVE  = 'rgba(255,255,255,0.48)';
const LABEL_INACTIVE = 'rgba(255,255,255,0.38)';

type TabMeta = { focused: string; unfocused: string; label: string };

const TAB_META: Record<string, TabMeta> = {
  Home:     { focused: 'home',             unfocused: 'home-outline',             label: 'Home'     },
  Schedule: { focused: 'calendar',         unfocused: 'calendar-outline',         label: 'Schedule' },
  Matches:  { focused: 'tennisball',       unfocused: 'tennisball-outline',       label: 'Matches'  },
  Messages: { focused: 'chatbubbles',      unfocused: 'chatbubbles-outline',      label: 'Messages' },
  Settings: { focused: 'person-circle',   unfocused: 'person-circle-outline',   label: 'Profile'  },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isTablet, isLandscape, sidebarWidth } = useResponsive();
  const insets = useSafeAreaInsets();

  const items = state.routes.map((route, index) => {
    const isFocused = state.index === index;
    const meta: TabMeta = TAB_META[route.name] ?? {
      focused: 'circle.fill', unfocused: 'circle', label: route.name,
    };
    const badge = descriptors[route.key].options.tabBarBadge as number | undefined;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        hapticSelection();
        navigation.navigate({ name: route.name, merge: true } as any);
      }
    };

    return { key: route.key, isFocused, meta, badge, onPress };
  });

  // ── Tablet: left sidebar ──────────────────────────────────────────────────
  if (isTablet) {
    const showLabel = isLandscape;
    return (
      <View style={[sb.container, { width: sidebarWidth, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={sb.logoWrap}>
          <Ionicons name="tennisball" size={showLabel ? 26 : 22} color={Palette.orange500} />
          {showLabel && <Text style={sb.logoText}>Top Tennis</Text>}
        </View>

        <View style={sb.divider} />

        {items.map(({ key, isFocused, meta, badge, onPress }) => (
          <TouchableOpacity
            key={key}
            onPress={onPress}
            activeOpacity={0.7}
            style={[sb.item, !showLabel && sb.itemCenter]}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: isFocused }}
          >
            <View style={[sb.iconBox, isFocused && sb.iconBoxActive]}>
              <Ionicons
                name={(isFocused ? meta.focused : meta.unfocused) as any}
                size={22}
                color={isFocused ? '#fff' : ICON_INACTIVE}
              />
              {!!badge && badge > 0 && (
                <View style={sb.badge}>
                  <Text style={sb.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </View>
            {showLabel && (
              <Text style={[sb.label, isFocused && sb.labelActive]} numberOfLines={1}>
                {meta.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ── Hide when focused screen requests it (e.g. chat conversation open) ──────
  const focusedOptions = descriptors[state.routes[state.index].key]?.options as any;
  if (focusedOptions?.tabBarStyle?.display === 'none') return null;

  // ── Phone: floating pill tab bar ──────────────────────────────────────────
  return (
    <View style={[bt.wrapper, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      <View style={bt.pill}>
        {items.map(({ key, isFocused, meta, badge, onPress }) => (
          <TouchableOpacity
            key={key}
            onPress={onPress}
            activeOpacity={0.8}
            style={bt.tab}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: isFocused }}
          >
            <View style={bt.inner}>
              <Animated.View
                key={`icon-${key}-${isFocused}`}
                entering={isFocused ? ZoomIn.springify().damping(14).stiffness(300) : FadeIn.duration(120)}
              >
                <Ionicons
                  name={(isFocused ? meta.focused : meta.unfocused) as any}
                  size={22}
                  color={isFocused ? Palette.orange500 : ICON_INACTIVE}
                />
              </Animated.View>
              <Text
                style={[bt.label, isFocused && bt.labelActive]}
                maxFontSizeMultiplier={1.3}
                allowFontScaling
              >
                {meta.label}
              </Text>
            </View>

            {!!badge && badge > 0 && (
              <View style={bt.pip}>
                <Text style={bt.pipText}>{badge > 9 ? '9+' : badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Sidebar styles ─────────────────────────────────────────────────────────────
const sb = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: Palette.navy,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 100,
    alignItems: 'stretch',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  logoText: {
    fontSize: 15,
    fontFamily: Font.black,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 8,
    marginBottom: 2,
    borderRadius: 12,
  },
  itemCenter: {
    justifyContent: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: Palette.orange500,
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontFamily: Font.medium,
    color: LABEL_INACTIVE,
    flex: 1,
  },
  labelActive: {
    color: '#FFFFFF',
    fontFamily: Font.semibold,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Palette.orange500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Palette.navy,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: Font.black,
  },
});

// ── Bottom pill styles ─────────────────────────────────────────────────────────
const bt = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  pill: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: PILL_RADIUS,
    backgroundColor: PILL_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PILL_BORDER,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 20,
  } as any,
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 52,
  },
  label: {
    fontSize: 10,
    fontFamily: Font.regular,
    color: LABEL_INACTIVE,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  labelActive: {
    color: Palette.orange500,
    fontFamily: Font.semibold,
  },
  pip: {
    position: 'absolute',
    top: 8,
    right: 12,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: PILL_BG,
  },
  pipText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: Font.black,
  },
});
