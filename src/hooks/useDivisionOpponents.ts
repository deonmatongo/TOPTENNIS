import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DivisionOpponent {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  skill_level?: number;
  wins: number;
  losses: number;
  matches_completed: number;
  full_name?: string;
  win_rate?: number;
}

export const useDivisionOpponents = (divisionId?: string) => {
  const { user } = useAuth();
  const [opponents, setOpponents] = useState<DivisionOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpponents = useCallback(async () => {
    if (!user || !divisionId) {
      setLoading(false);
      setOpponents([]);
      return;
    }

    try {
      console.log('👥 Fetching division opponents:', { userId: user.id, divisionId });

      const { data, error: fetchError } = await supabase.rpc('get_division_opponents', {
        p_user_id: user.id,
        p_division_id: divisionId
      });

      if (fetchError) {
        console.error('❌ Error fetching opponents:', fetchError);
        throw fetchError;
      }

      // Enhance opponent data
      const enhancedOpponents = (data || []).map((opponent: any) => ({
        ...opponent,
        full_name: `${opponent.first_name} ${opponent.last_name}`.trim(),
        win_rate: opponent.wins + opponent.losses > 0 
          ? Math.round((opponent.wins / (opponent.wins + opponent.losses)) * 100)
          : 0
      }));

      console.log('✅ Division opponents fetched:', enhancedOpponents.length);
      setOpponents(enhancedOpponents);
      setError(null);
    } catch (err: any) {
      console.error('❌ Error in fetchOpponents:', err);
      setError(err.message);
      toast.error('Failed to load division opponents');
    } finally {
      setLoading(false);
    }
  }, [user, divisionId]);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  // Subscribe to division changes
  useEffect(() => {
    if (!user || !divisionId) return;

    console.log('🔔 Setting up real-time subscription for division assignments');

    const channel = supabase
      .channel(`division-${divisionId}-assignments`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'division_assignments',
          filter: `division_id=eq.${divisionId}`
        },
        (payload) => {
          console.log('🔄 Division assignment update:', payload);
          fetchOpponents();
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Cleaning up division assignments subscription');
      supabase.removeChannel(channel);
    };
  }, [user, divisionId, fetchOpponents]);

  // Get opponent by ID
  const getOpponentById = useCallback((opponentId: string) => {
    return opponents.find(o => o.user_id === opponentId);
  }, [opponents]);

  // Get opponents sorted by wins
  const getOpponentsByWins = useCallback(() => {
    return [...opponents].sort((a, b) => b.wins - a.wins);
  }, [opponents]);

  // Get opponents sorted by matches completed
  const getOpponentsByActivity = useCallback(() => {
    return [...opponents].sort((a, b) => b.matches_completed - a.matches_completed);
  }, [opponents]);

  // Check if user has played opponent
  const hasPlayedOpponent = useCallback((opponentId: string) => {
    const opponent = opponents.find(o => o.user_id === opponentId);
    return opponent ? opponent.matches_completed > 0 : false;
  }, [opponents]);

  return {
    opponents,
    loading,
    error,
    refetch: fetchOpponents,
    getOpponentById,
    getOpponentsByWins,
    getOpponentsByActivity,
    hasPlayedOpponent
  };
};
