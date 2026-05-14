import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { captureError } from '@/services/sentry';

export interface AvailabilitySlot {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_blocked: boolean;
  notes?: string;
}

export function usePlayerAvailability(playerUserId?: string) {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async (uid: string) => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', uid)
      .eq('is_available', true)
      .eq('is_blocked', false)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      captureError(error);
      if (__DEV__) console.error('[usePlayerAvailability]', error.message);
    }
    setAvailability(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!playerUserId) { setAvailability([]); return; }
    fetch(playerUserId);
  }, [playerUserId]);

  return { availability, loading, refetch: () => playerUserId && fetch(playerUserId) };
}
