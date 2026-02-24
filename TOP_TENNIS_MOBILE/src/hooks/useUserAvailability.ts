import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface AvailabilitySlot {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_blocked?: boolean;
  notes?: string;
  privacy_level?: string;
}

export function useUserAvailability() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAvailability = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setAvailability(data || []);
    } catch (e) {
      console.error('Error fetching availability:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  const createAvailability = async (payload: {
    date: string;
    start_time: string;
    end_time: string;
    is_available?: boolean;
    notes?: string;
    privacy_level?: string;
  }) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('user_availability')
      .insert({
        user_id: user.id,
        date: payload.date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        is_available: payload.is_available ?? true,
        notes: payload.notes || null,
        privacy_level: payload.privacy_level || 'public',
      })
      .select()
      .single();
    if (error) throw error;
    await fetchAvailability();
    return data;
  };

  const updateAvailability = async (id: string, updates: Partial<AvailabilitySlot>) => {
    const { error } = await supabase
      .from('user_availability')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    await fetchAvailability();
  };

  const deleteAvailability = async (id: string) => {
    const { error } = await supabase
      .from('user_availability')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchAvailability();
  };

  return { availability, loading, fetchAvailability, createAvailability, updateAvailability, deleteAvailability };
}
