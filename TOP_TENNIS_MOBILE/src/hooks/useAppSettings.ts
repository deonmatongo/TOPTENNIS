import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { setHapticsEnabled } from '@/utils/haptics';

export interface AppSettings {
  profile_visibility: 'public' | 'friends_only' | 'private';
  show_win_loss: boolean;
  show_usta_rating: boolean;
  show_location: boolean;
  networking_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  match_invites: boolean;
  match_reminders: boolean;
  match_accepted: boolean;
  match_declined: boolean;
  league_updates: boolean;
  score_submitted: boolean;
  score_confirmed: boolean;
  friend_requests: boolean;
  messages: boolean;
  achievements: boolean;
  preferred_match_duration: 30 | 60 | 90 | 120;
  preferred_surface: 'any' | 'hard' | 'clay' | 'grass' | 'indoor';
  preferred_time_of_day: 'any' | 'morning' | 'afternoon' | 'evening';
  max_travel_distance: 5 | 10 | 25 | 50;
  dark_mode: boolean;
  haptics_enabled: boolean;
  sound_effects: boolean;
  auto_confirm_scores: boolean;
  show_match_tips: boolean;
  compact_leaderboard: boolean;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  profile_visibility: 'public',
  show_win_loss: true,
  show_usta_rating: true,
  show_location: true,
  networking_enabled: true,
  push_enabled: true,
  email_enabled: false,
  match_invites: true,
  match_reminders: true,
  match_accepted: true,
  match_declined: true,
  league_updates: true,
  score_submitted: true,
  score_confirmed: true,
  friend_requests: true,
  messages: true,
  achievements: true,
  preferred_match_duration: 60,
  preferred_surface: 'any',
  preferred_time_of_day: 'any',
  max_travel_distance: 25,
  dark_mode: false,
  haptics_enabled: true,
  sound_effects: true,
  auto_confirm_scores: false,
  show_match_tips: true,
  compact_leaderboard: false,
};

export function useAppSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select(Object.keys(SETTINGS_DEFAULTS).join(','))
          .eq('user_id', user.id)
          .single();
        if (data) {
          const loaded = { ...SETTINGS_DEFAULTS };
          for (const key of Object.keys(SETTINGS_DEFAULTS) as (keyof AppSettings)[]) {
            const v = (data as any)[key];
            if (v !== undefined && v !== null) (loaded as any)[key] = v;
          }
          setSettings(loaded);
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    })();
  }, [user]);

  // Keep the global haptics switch in sync with the persisted preference.
  useEffect(() => { setHapticsEnabled(settings.haptics_enabled); }, [settings.haptics_enabled]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await supabase.from('app_settings').upsert(
        { user_id: user!.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

      // app_settings is private (RLS: owner-only), but the public profiles table is
      // what player search, match suggestions and the profile sheet read. Mirror the
      // privacy choices there so they actually take effect. Discoverability = networking
      // on AND not private; the show_* flags let other clients mask sensitive fields.
      // Best-effort: never block saving the preference if the mirror write fails.
      const MIRROR_KEYS: (keyof AppSettings)[] = [
        'networking_enabled', 'profile_visibility', 'show_win_loss', 'show_usta_rating', 'show_location',
      ];
      if (MIRROR_KEYS.some(k => k in patch)) {
        const discoverable = next.networking_enabled && next.profile_visibility !== 'private';
        try {
          await supabase.from('profiles').update({
            networking_enabled: discoverable,
            show_win_loss: next.show_win_loss,
            show_usta_rating: next.show_usta_rating,
            show_location: next.show_location,
          }).eq('id', user!.id);
        } catch { /* enforcement mirror is best-effort; app_settings remains source of truth */ }
      }
    } catch {
      setSettings(settings);
      Alert.alert('Error', 'Could not save setting. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [settings, user]);

  return { settings, update, loading, saving };
}
