import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '@/theme/colors';

type CardVariant = 'default' | 'elevated' | 'flat' | 'outlined' | 'dark';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  variant?: CardVariant;
  padding?: number;
  radius?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevated = false,
  variant,
  padding = 16,
  radius,
}) => {
  const v: CardVariant = variant ?? (elevated ? 'elevated' : 'default');

  return (
    <View style={[
      styles.base,
      radius !== undefined && { borderRadius: radius },
      v === 'default'  && styles.default,
      v === 'elevated' && styles.elevated,
      v === 'flat'     && styles.flat,
      v === 'outlined' && styles.outlined,
      v === 'dark'     && styles.dark,
      { padding },
      style,
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
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
});
