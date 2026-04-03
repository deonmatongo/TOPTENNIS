import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/theme/colors';

interface ScreenHeaderProps {
  title:        string;
  subtitle?:    string;
  navigation?:  any;
  showBack?:    boolean;
  rightElement?: React.ReactNode;
  gradient?:    boolean;
  centered?:    boolean;
  dark?:        boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title, subtitle, navigation,
  showBack = false, rightElement, centered = false, dark = false,
}) => {
  const insets = useSafeAreaInsets();
  const bg  = dark ? Colors.surfaceDark : Colors.surface;
  const col = dark ? Colors.textOnDark  : Colors.text;
  const sub = dark ? Colors.textOnDarkMuted : Colors.textMuted;

  return (
    <View style={[styles.wrap, { backgroundColor: bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.row}>

        {/* Left */}
        {showBack && navigation ? (
          <TouchableOpacity
            style={[styles.iconBtn, dark ? styles.iconBtnDark : styles.iconBtnLight]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={col} />
          </TouchableOpacity>
        ) : (
          <View style={styles.side} />
        )}

        {/* Center */}
        <View style={[styles.center, centered && styles.centerAligned]}>
          <Text style={[styles.title, { color: col }, centered && { textAlign: 'center' }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: sub }, centered && { textAlign: 'center' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right */}
        <View style={styles.side}>
          {rightElement ?? null}
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    ...Shadow.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnLight: { backgroundColor: Colors.backgroundAlt },
  iconBtnDark:  { backgroundColor: 'rgba(255,255,255,0.10)' },
  side: {
    width: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  centerAligned: { alignItems: 'center' },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
});
