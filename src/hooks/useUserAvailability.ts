import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

  // Incrementing this causes the subscription effect to re-run with a fresh channel
  const [subscriptionKey, setSubscriptionKey] = useState(0);

  const fetchAvailability = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

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

  // ── Dedicated realtime subscription ──────────────────────────────────────
  // Owned directly by this hook (not shared through RealtimeContext) so it
  // can be reliably recreated on error via subscriptionKey.
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError(null);
      return;
    }

    fetchAvailability();

    const channelName = `user-availability-${user.id}-${subscriptionKey}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_availability',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const incoming = payload.new as UserAvailability;
            if (incoming.booking_status === 'booked') return;

            // Apply the real record as a targeted patch:
            // – replace any optimistic (temp-*) entry
            // – skip if the real ID is already present (success handler beat us)
            setAvailability(prev => {
              if (prev.some(s => s.id === incoming.id)) return prev;
              const withoutTemps = prev.filter(s => !s.id.startsWith('temp-'));
              return [...withoutTemps, incoming].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
            });
            return;
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as UserAvailability;
            if (updated.booking_status === 'booked') {
              setAvailability(prev => prev.filter(s => s.id !== updated.id));
            } else {
              setAvailability(prev => prev.map(s => s.id === updated.id ? updated : s));
            }
            return;
          }

          if (payload.eventType === 'DELETE' && payload.old?.id) {
            setAvailability(prev => prev.filter(s => s.id !== payload.old!.id));
            return;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useUserAvailability] Channel error — recreating in 3 s');
          // Incrementing subscriptionKey forces this effect to re-run with a new channel
          setTimeout(() => setSubscriptionKey(k => k + 1), 3000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, subscriptionKey, fetchAvailability]);

  // ── Tab visibility: refetch on return to tab ──────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchAvailability();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    if (availDate < oneMinuteAgo) {
      toast.error('Cannot create availability for past dates or times');
      throw new Error('Cannot create availability for past dates or times');
    }

    // Optimistic update — add to UI immediately with a temp ID
    const tempId = `temp-${Date.now()}`;
    const optimisticData = {
      id: tempId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_blocked: false,
      booking_status: 'available',
      ...availabilityData,
    } as UserAvailability;

    setAvailability(prev =>
      [...prev, optimisticData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );

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
        // Roll back optimistic entry
        setAvailability(prev => prev.filter(item => item.id !== tempId));
        throw error;
      }

      // Replace the temp entry with the confirmed record.
      // The realtime INSERT handler may have already done this — in that case
      // the temp entry is already gone and this is a no-op (data.id already present).
      setAvailability(prev => {
        if (prev.some(s => s.id === data.id)) {
          // Realtime already applied the real record; just remove any leftover temp
          return prev.filter(s => s.id !== tempId);
        }
        return prev
          .map(item => item.id === tempId ? data : item)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });

      toast.success('Availability updated');
      return data;
    } catch (error) {
      console.error('Error creating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const updateAvailability = async (id: string, updates: Partial<UserAvailability>) => {
    // Optimistic update
    setAvailability(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));

    try {
      const { data, error } = await supabase
        .from('user_availability')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Revert — refetch to restore correct state
        fetchAvailability();
        throw error;
      }

      setAvailability(prev => prev.map(item => item.id === id ? data : item));
      toast.success('Availability updated');
      return data;
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const deleteAvailability = async (id: string) => {
    // Optimistic removal
    setAvailability(prev => prev.filter(item => item.id !== id));

    try {
      const { error } = await supabase
        .from('user_availability')
        .delete()
        .eq('id', id);

      if (error) {
        // Revert
        fetchAvailability();
        throw error;
      }

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
