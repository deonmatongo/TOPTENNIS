import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type UserAvailability = Tables<'user_availability'>;

export const usePlayerAvailability = (playerId?: string) => {
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) {
      setAvailability([]);
      return;
    }

    fetchPlayerAvailability(playerId);

    // Set up real-time subscription for opponent's availability
    const channel = supabase
      .channel(`player-availability-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'user_availability',
          filter: `user_id=eq.${playerId}`
        },
        (payload) => {
          console.log('Real-time opponent availability update:', payload);
          fetchPlayerAvailability(playerId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  const fetchPlayerAvailability = async (playerUserId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', playerUserId)
        .eq('is_available', true)
        .eq('is_blocked', false)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching player availability:', error);
      toast.error('Failed to load player availability');
      setAvailability([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    availability,
    loading,
    refetch: () => playerId && fetchPlayerAvailability(playerId),
  };
};