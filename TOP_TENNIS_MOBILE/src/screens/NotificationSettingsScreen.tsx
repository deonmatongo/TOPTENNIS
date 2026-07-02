import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

interface NotifSettings {
  match_invites: boolean;
  match_accepted: boolean;
  match_declined: boolean;
  match_reminders: boolean;
  league_updates: boolean;
  score_submitted: boolean;
  score_confirmed: boolean;
  friend_requests: boolean;
  messages: boolean;
  achievements: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  match_invites: true,
  match_accepted: true,
  match_declined: true,
  match_reminders: true,
  league_updates: true,
  score_submitted: true,
  score_confirmed: true,
  friend_requests: true,
  messages: true,
  achievements: true,
  push_enabled: true,
  email_enabled: false,
};

const SECTIONS = [
  {
    title: 'Match Notifications',
    icon: 'tennisball-outline' as const,
    color: Colors.primary,
    items: [
      { key: 'match_invites', label: 'Match Invitations', desc: 'When someone invites you to a match' },
      { key: 'match_accepted', label: 'Match Accepted', desc: 'When your invitation is accepted' },
      { key: 'match_declined', label: 'Match Declined', desc: 'When your invitation is declined' },
      { key: 'match_reminders', label: 'Match Reminders', desc: '24h and 1h before your match' },
    ],
  },
  {
    title: 'League Notifications',
    icon: 'trophy-outline' as const,
    color: '#f59e0b',
    items: [
      { key: 'league_updates', label: 'League Updates', desc: 'Division standings and league news' },
      { key: 'score_submitted', label: 'Score Submitted', desc: 'When opponent reports a score' },
      { key: 'score_confirmed', label: 'Score Confirmed', desc: 'When your score is confirmed' },
    ],
  },
  {
    title: 'Social Notifications',
    icon: 'people-outline' as const,
    color: '#3b82f6',
    items: [
      { key: 'friend_requests', label: 'Friend Requests', desc: 'New friend requests and acceptances' },
      { key: 'messages', label: 'Messages', desc: 'New messages from other players' },
      { key: 'achievements', label: 'Achievements', desc: 'When you unlock a new achievement' },
    ],
  },
];

export const NotificationSettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // Mobile notification prefs live on app_settings (the deployed
      // notification_settings table has the web app's older enable_* schema)
      const { data } = await supabase
        .from('app_settings')
        .select(Object.keys(DEFAULT_SETTINGS).join(','))
        .eq('user_id', user.id)
        .single();
      if (data) {
        const loaded = { ...DEFAULT_SETTINGS };
        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof NotifSettings)[]) {
          const v = (data as any)[key];
          if (typeof v === 'boolean') loaded[key] = v;
        }
        setSettings(loaded);
      }
    } catch {
      // Table may not exist yet — use defaults
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof NotifSettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ user_id: user!.id, ...updated, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (e: any) {
      // Revert on failure
      setSettings(settings);
      Alert.alert('Error', 'Failed to save setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMuteAll = () => {
    Alert.alert(
      'Mute All Notifications',
      'This will disable all in-app notifications. You can re-enable them individually.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute All',
          style: 'destructive',
          onPress: async () => {
            const allOff = Object.keys(settings).reduce((acc, k) => ({ ...acc, [k]: false }), {}) as NotifSettings;
            setSettings(allOff);
            await supabase.from('app_settings').upsert({ user_id: user!.id, ...allOff }, { onConflict: 'user_id' });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScreenHeader title="Notification Settings" subtitle="Manage your alerts" navigation={navigation} showBack />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Delivery method */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="notifications-outline" size={18} color="#8b5cf6" />
              </View>
              <Text style={styles.sectionTitle}>Delivery Method</Text>
              {saving && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 'auto' }} />}
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Receive alerts on your device</Text>
              </View>
              <Switch
                value={settings.push_enabled}
                onValueChange={v => updateSetting('push_enabled', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.primaryMuted }}
                thumbColor={settings.push_enabled ? Colors.primary : Colors.textMuted}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDesc}>Receive a daily digest via email</Text>
              </View>
              <Switch
                value={settings.email_enabled}
                onValueChange={v => updateSetting('email_enabled', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.primaryMuted }}
                thumbColor={settings.email_enabled ? Colors.primary : Colors.textMuted}
              />
            </View>
          </View>

          {/* Per-category sections */}
          {SECTIONS.map(section => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: section.color + '20' }]}>
                  <Ionicons name={section.icon} size={18} color={section.color} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.items.map((item, idx) => (
                <View
                  key={item.key}
                  style={[styles.settingRow, idx < section.items.length - 1 && styles.settingRowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={settings[item.key as keyof NotifSettings] as boolean}
                    onValueChange={v => updateSetting(item.key as keyof NotifSettings, v)}
                    trackColor={{ false: Colors.borderLight, true: Colors.primaryMuted }}
                    thumbColor={settings[item.key as keyof NotifSettings] ? Colors.primary : Colors.textMuted}
                    disabled={!settings.push_enabled}
                  />
                </View>
              ))}
            </View>
          ))}

          {/* Mute all */}
          <TouchableOpacity style={styles.muteBtn} onPress={handleMuteAll}>
            <Ionicons name="notifications-off-outline" size={18} color={Colors.error} />
            <Text style={styles.muteBtnText}>Mute All Notifications</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Changes are saved automatically. Push notification permissions can be managed in your device settings.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxxl },

  section: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.background },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },

  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  settingLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  settingDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  muteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.error },
  muteBtnText: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.semibold },

  footer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.lg },
});
