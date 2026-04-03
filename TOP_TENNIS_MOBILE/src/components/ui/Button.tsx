import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, FontSize, FontWeight, Spacing, Shadow, Palette } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  disabled?:  boolean;
  style?:     ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  icon?:      React.ReactNode;
  iconRight?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false,
  style, textStyle, fullWidth = false, icon, iconRight = false,
}) => {
  const isDisabled = disabled || loading;

  const spinnerColor =
    variant === 'outline' || variant === 'ghost' ? Colors.primary :
    variant === 'danger'  ? '#fff' :
    '#fff';

  const inner = loading ? (
    <ActivityIndicator size="small" color={spinnerColor} />
  ) : (
    <View style={[styles.row, iconRight && styles.rowReverse]}>
      {icon && !iconRight && <View>{icon}</View>}
      <Text style={[styles.label, textSizes[size], textColors[variant], textStyle]}>{label}</Text>
      {icon && iconRight && <View>{icon}</View>}
    </View>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress} disabled={isDisabled} activeOpacity={0.84}
        style={[fullWidth && styles.fw, isDisabled && styles.off, style]}
      >
        <LinearGradient
          colors={[Palette.orange500, Palette.orange600]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.base, btnSizes[size], Shadow.orange]}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'dark') {
    return (
      <TouchableOpacity
        onPress={onPress} disabled={isDisabled} activeOpacity={0.84}
        style={[fullWidth && styles.fw, isDisabled && styles.off, style]}
      >
        <LinearGradient
          colors={[Palette.dark800, Palette.dark700]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.base, btnSizes[size]]}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress} disabled={isDisabled} activeOpacity={0.76}
      style={[
        styles.base, containerStyles[variant], btnSizes[size],
        fullWidth && styles.fw, isDisabled && styles.off, style,
      ]}
    >
      {inner}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fw:   { width: '100%' },
  off:  { opacity: 0.45 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowReverse: { flexDirection: 'row-reverse' },
  label: { fontWeight: FontWeight.semibold },
});

const btnSizes: Record<Size, ViewStyle> = {
  xs: { paddingHorizontal: 10, paddingVertical: 5,  borderRadius: Radius.sm },
  sm: { paddingHorizontal: 14, paddingVertical: 8,  borderRadius: Radius.sm },
  md: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: Radius.md },
  lg: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: Radius.lg },
};

const containerStyles: Record<string, ViewStyle> = {
  secondary: { backgroundColor: Colors.primaryLight },
  outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: Colors.error },
};

const textSizes: Record<Size, TextStyle> = {
  xs: { fontSize: FontSize.xs },
  sm: { fontSize: FontSize.sm },
  md: { fontSize: FontSize.md },
  lg: { fontSize: FontSize.lg },
};

const textColors: Record<Variant, TextStyle> = {
  primary:   { color: '#fff' },
  secondary: { color: Colors.primaryDark },
  outline:   { color: Colors.primary },
  ghost:     { color: Colors.primary },
  danger:    { color: '#fff' },
  dark:      { color: '#fff' },
};
