import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ScheduleSettings {
  start_hour: number;
  end_hour: number;
  buffer_minutes: number;
}

export const useScheduleSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ScheduleSettings>({
    start_hour: 6,
    end_hour: 22,
    buffer_minutes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_schedule_settings' as any)
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          start_hour: (data as any).start_hour,
          end_hour: (data as any).end_hour,
          buffer_minutes: (data as any).buffer_minutes,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
  };
};
