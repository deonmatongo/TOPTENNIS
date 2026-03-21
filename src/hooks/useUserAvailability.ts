import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type UserAvailability = Tables<'user_availability'>;

export const useUserAvailability = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasErrorRef = useRef(false);

  const { subscribeToUserChanges } = useRealtime();

  // Define fetchAvailability before useEffect to avoid 'used before declaration' error
  const fetchAvailability = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Reset error gate on every explicit fetch so a past error never permanently
    // blocks future loads (same pattern used in useMatchInvites).
    hasErrorRef.current = false;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', user.id)
        .neq('booking_status', 'booked')
        .order('date', { ascending: true });

      if (error) throw error;

      setAvailability(data ?? []);

    } catch (err) {
      console.error('Error fetching availability:', err);
      hasErrorRef.current = true;
      setError('Failed to load availability');

      toast.error('Failed to load availability', {
        action: {
          label: 'Retry',
          onClick: () => fetchAvailability(),
        },
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Use refs to prevent dependency changes from triggering re-renders
  const subscribeToUserChangesRef = useRef(subscribeToUserChanges);
  
  // Update refs when functions change
  useEffect(() => {
    subscribeToUserChangesRef.current = subscribeToUserChanges;
  }, [subscribeToUserChanges]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError(null);
      return;
    }

    fetchAvailability();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribeToUserChangesRef.current((payload) => {
      if (payload.table !== 'user_availability') return;

      // Slot just got booked — remove it immediately without a full refetch
      if (payload.eventType === 'UPDATE' && payload.new?.booking_status === 'booked') {
        setAvailability(prev => prev.filter(slot => slot.id !== payload.new.id));
        return;
      }

      // For INSERT / DELETE / other UPDATEs, debounce a full refetch
      if (!hasErrorRef.current &&
          (payload.eventType === 'INSERT' ||
           payload.eventType === 'DELETE' ||
           payload.eventType === 'UPDATE')) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!hasErrorRef.current) fetchAvailability();
        }, 500);
      }
    });

    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [user?.id, fetchAvailability]);

  const createAvailability = async (availabilityData: {
    date: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
    notes?: string;
    privacy_level?: string;
    recurrence_rule?: string;
  }) => {
    if (!user) return;

    // Validate that date/time is not in the past
    const now = new Date();
    const availDate = new Date(availabilityData.date + 'T' + availabilityData.start_time);
    
    // Only check if it's clearly in the past (give 1 minute buffer for processing time)
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    if (availDate < oneMinuteAgo) {
      toast.error('Cannot create availability for past dates or times');
      throw new Error('Cannot create availability for past dates or times');
    }

    // Optimistic update - add to UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticData = {
      id: tempId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_blocked: false,
      ...availabilityData,
    } as UserAvailability;

    setAvailability(prev => [...prev, optimisticData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));

    try {
      const { data, error } = await supabase
        .from('user_availability')
        .insert({
          user_id: user.id,
          ...availabilityData,
          booking_status: 'available',
        })
        .select()
        .single();

      if (error) {
        setAvailability(prev => prev.filter(item => item.id !== tempId));
        throw error;
      }

      setAvailability(prev =>
        prev.map(item => item.id === tempId ? data : item)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );

      toast.success('Availability updated');
      return data;
    } catch (error) {
      console.error('Error creating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const updateAvailability = async (id: string, updates: Partial<UserAvailability>) => {
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setAvailability(prev => 
        prev.map(item => item.id === id ? data : item)
      );
      
      toast.success('Availability updated');
      return data;
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const deleteAvailability = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setAvailability(prev => prev.filter(item => item.id !== id));
      toast.success('Availability removed');
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to remove availability');
      throw error;
    }
  };

  return {
    availability,
    loading,
    error,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    fetchAvailability,
  };
};