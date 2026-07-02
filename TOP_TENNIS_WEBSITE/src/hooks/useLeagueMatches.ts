import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeagueMatch {
  id: string;
  division_id: string;
  division_name?: string;
  league_id?: string;
  player1_id: string;
  player2_id: string;
  player1_first_name?: string;
  player1_last_name?: string;
  player2_first_name?: string;
  player2_last_name?: string;
  opponent_name?: string;
  opponent_id?: string;
  match_invite_id?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  timezone?: string;
  court_location?: string;
  match_number?: number;
  round_number?: number;
  is_playoff: boolean;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  winner_id?: string;
  score?: any;
  match_duration_minutes?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export const useLeagueMatches = (divisionId?: string) => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagueMatches = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('📊 Fetching league matches for user:', user.id, 'division:', divisionId);

      let query = supabase
        .from('user_league_matches')
        .select('*')
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      // Filter by division if provided
      if (divisionId) {
        query = query.eq('division_id', divisionId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Error fetching league matches:', fetchError);
        throw fetchError;
      }

      console.log('✅ League matches fetched:', data?.length || 0);
      setMatches(data || []);
      setError(null);
    } catch (err: any) {
      console.error('❌ Error in fetchLeagueMatches:', err);
      setError(err.message);
      toast.error('Failed to load league matches');
    } finally {
      setLoading(false);
    }
  }, [user, divisionId]);

  useEffect(() => {
    fetchLeagueMatches();
  }, [fetchLeagueMatches]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up real-time subscription for league matches');

    const channel = supabase
      .channel(`league-matches-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_matches',
          filter: `player1_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 League match update (player1):', payload);
          fetchLeagueMatches();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_matches',
          filter: `player2_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 League match update (player2):', payload);
          fetchLeagueMatches();
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Cleaning up league matches subscription');
      supabase.removeChannel(channel);
    };
  }, [user, fetchLeagueMatches]);

  // Get matches by status
  const getPendingMatches = useCallback(() => {
    return matches.filter(m => m.status === 'pending');
  }, [matches]);

  const getScheduledMatches = useCallback(() => {
    return matches.filter(m => m.status === 'scheduled');
  }, [matches]);

  const getCompletedMatches = useCallback(() => {
    return matches.filter(m => m.status === 'completed');
  }, [matches]);

  const getUpcomingMatches = useCallback(() => {
    return matches.filter(m => 
      (m.status === 'scheduled' || m.status === 'pending') && 
      m.scheduled_date
    );
  }, [matches]);

  // Create a league match with invite
  const createLeagueMatch = async (
    divisionId: string,
    opponentId: string,
    scheduledDate: string,
    scheduledTime: string,
    timezone: string,
    courtLocation?: string,
    message?: string
  ) => {
    if (!user) throw new Error('User not authenticated');

    try {
      console.log('📝 Creating league match:', {
        divisionId,
        opponentId,
        scheduledDate,
        scheduledTime
      });

      const { data, error } = await supabase.rpc('create_league_match_with_invite', {
        p_division_id: divisionId,
        p_player1_id: user.id,
        p_player2_id: opponentId,
        p_scheduled_date: scheduledDate,
        p_scheduled_time: scheduledTime,
        p_timezone: timezone,
        p_court_location: courtLocation || null,
        p_message: message || null
      });

      if (error) {
        console.error('❌ Error creating league match:', error);
        throw error;
      }

      console.log('✅ League match created:', data);
      toast.success('League match invitation sent!');
      
      // Refresh matches
      await fetchLeagueMatches();
      
      return data;
    } catch (err: any) {
      console.error('❌ Error in createLeagueMatch:', err);
      toast.error(err.message || 'Failed to create league match');
      throw err;
    }
  };

  // Update match status
  const updateMatchStatus = async (
    matchId: string,
    status: LeagueMatch['status']
  ) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('league_matches')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) throw error;

      toast.success('Match status updated');
      await fetchLeagueMatches();
    } catch (err: any) {
      console.error('Error updating match status:', err);
      toast.error('Failed to update match status');
      throw err;
    }
  };

  // Report match score
  const reportMatchScore = async (
    matchId: string,
    winnerId: string,
    score: any,
    durationMinutes?: number
  ) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('league_matches')
        .update({
          status: 'completed',
          winner_id: winnerId,
          score,
          match_duration_minutes: durationMinutes,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) throw error;

      toast.success('Match score reported successfully');
      await fetchLeagueMatches();
    } catch (err: any) {
      console.error('Error reporting match score:', err);
      toast.error('Failed to report match score');
      throw err;
    }
  };

  return {
    matches,
    loading,
    error,
    refetch: fetchLeagueMatches,
    getPendingMatches,
    getScheduledMatches,
    getCompletedMatches,
    getUpcomingMatches,
    createLeagueMatch,
    updateMatchStatus,
    reportMatchScore
  };
};
