import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Palette, Colors, FontSize, Font, Spacing, Radius } from '@/theme/colors';
import { selection as hapticSelection } from '@/utils/haptics';

// ─── Section page header ──────────────────────────────────────────────────────

export function SectionPageHeader({
  title, subtitle, onBack, saving,
}: { title: string; subtitle?: string; onBack: () => void; saving?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[Palette.dark900, Palette.dark700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[ph.wrap, { paddingTop: insets.top + Spacing.md }]}
    >
      <TouchableOpacity
        style={ph.back}
        onPress={onBack}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={ph.title}>{title}</Text>
        {subtitle ? <Text style={ph.sub}>{subtitle}</Text> : null}
      </View>
      {saving && <ActivityIndicator size="small" color="#fff" />}
    </LinearGradient>
  );
}
const ph = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  sub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
});

// ─── Section card wrapper ─────────────────────────────────────────────────────

export const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <View style={sc.card}>{children}</View>
);
const sc = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
});

// ─── Row components ───────────────────────────────────────────────────────────

export function NavRow({
  icon, label, desc, color, onPress, danger = false, last = false,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; desc?: string; color: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[nr.row, !last && nr.border]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={desc ? `${label}. ${desc}` : label}
    >
      <View style={[nr.icon, { backgroundColor: (danger ? Colors.error : color) + '18' }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nr.label, danger && { color: Colors.error }]}>{label}</Text>
        {desc ? <Text style={nr.desc}>{desc}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}
const nr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});

export function SettingRow({
  label, desc, value, onValueChange, disabled = false, last = false,
}: { label: string; desc?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; last?: boolean }) {
  return (
    <View style={[sr.row, !last && sr.border, disabled && sr.disabled]}>
      <View style={{ flex: 1 }}>
        <Text style={sr.label}>{label}</Text>
        {desc ? <Text style={sr.desc}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { hapticSelection(); onValueChange(v); }}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: Colors.borderLight, true: Colors.primaryMuted }}
        thumbColor={value && !disabled ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  disabled: { opacity: 0.45 },
  label: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
});

export function ChipRow<T extends string | number>({
  options, value, onSelect, last = false,
}: { options: { label: string; value: T }[]; value: T; onSelect: (v: T) => void; last?: boolean }) {
  return (
    <View style={[cr.wrap, !last && cr.border]}>
      {options.map(o => (
        <TouchableOpacity
          key={String(o.value)}
          style={[cr.chip, value === o.value && cr.chipActive]}
          onPress={() => { hapticSelection(); onSelect(o.value); }}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          accessibilityLabel={o.label}
        >
          <Text style={[cr.chipText, value === o.value && cr.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const cr = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  chip: { paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Font.medium },
  chipTextActive: { color: Colors.primaryDark, fontFamily: Font.semibold },
});

export function LabelRow({ label, desc, last = false }: { label: string; desc?: string; last?: boolean }) {
  return (
    <View style={[lr.row, !last && lr.border]}>
      <Text style={lr.label}>{label}</Text>
      {desc ? <Text style={lr.desc}>{desc}</Text> : null}
    </View>
  );
}
const lr = StyleSheet.create({
  row: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  label: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  desc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

// ─── Shared safe screen wrapper ───────────────────────────────────────────────

export function SettingsSafeScreen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={[]}>
      <StatusBar style="light" />
      {children}
    </SafeAreaView>
  );
}

export const sharedContent = StyleSheet.create({
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },
});
