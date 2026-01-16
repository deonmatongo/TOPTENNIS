import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NotificationSettings {
  id: string;
  user_id: string;
  enable_match_invites: boolean;
  enable_match_accepted: boolean;
  enable_match_declined: boolean;
  enable_match_cancelled: boolean;
  enable_match_rescheduled: boolean;
  enable_friend_requests: boolean;
  enable_league_updates: boolean;
  browser_notifications: boolean;
  email_notifications: boolean;
  respect_tab_focus: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  notification_sound: string;
  group_similar_notifications: boolean;
}

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) {
        // If no settings exist, create default
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
          return;
        }
        throw error;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .insert({ user_id: user!.id })
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  };

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('user_id', user!.id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast.success('Notification settings updated');
      return data;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('Failed to update settings');
      throw error;
    }
  };

  const isInQuietHours = (): boolean => {
    if (!settings?.quiet_hours_enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = settings.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = settings.quiet_hours_end.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours
    if (startMinutes > endMinutes) {
      return currentTime >= startMinutes || currentTime < endMinutes;
    }
    
    return currentTime >= startMinutes && currentTime < endMinutes;
  };

  const shouldShowNotification = (type: string): boolean => {
    if (!settings) return true; // Default to showing if no settings

    if (isInQuietHours()) return false;

    const typeMap: Record<string, keyof NotificationSettings> = {
      'match_invite': 'enable_match_invites',
      'match_accepted': 'enable_match_accepted',
      'match_declined': 'enable_match_declined',
      'match_cancelled': 'enable_match_cancelled',
      'match_rescheduled': 'enable_match_rescheduled',
      'friend_request': 'enable_friend_requests',
      'league_update': 'enable_league_updates',
    };

    const settingKey = typeMap[type];
    return settingKey ? settings[settingKey] as boolean : true;
  };

  return {
    settings,
    loading,
    updateSettings,
    isInQuietHours,
    shouldShowNotification,
  };
};
