import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

export type Match = Tables<'matches'> & {
  player1?: Tables<'players'> | null;
  player2?: Tables<'players'> | null;
  winner?: Tables<'players'> | null;
};

export const useMatches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    try {
      console.log('Fetching matches...');
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:players!player1_id(name, email, skill_level, wins, losses),
          player2:players!player2_id(name, email, skill_level, wins, losses),
          winner:players!winner_id(name, email, skill_level, wins, losses)
        `)
        .order('match_date', { ascending: false });

      if (error) {
        console.error('Error fetching matches:', error);
        setError(error.message);
        return;
      }

      console.log('Matches data:', data);
      setMatches(data as Match[]);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();

    // Set up real-time subscription for matches
    const channel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'matches'
        },
        (payload) => {
          console.log('Real-time match update:', payload);
          // Refetch matches when any change occurs
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createMatch = async (matchData: {
    player2_id: string;
    match_date: string;
    court_location: string;
  }) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Get current user's player profile
      const { data: playerProfile } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!playerProfile) throw new Error('Player profile not found');

      const { data, error } = await supabase
        .from('matches')
        .insert({
          player1_id: playerProfile.id,
          player2_id: matchData.player2_id,
          match_date: matchData.match_date,
          court_location: matchData.court_location,
          status: 'scheduled'
        })
        .select(`
          *,
          player1:players!player1_id(name, email, skill_level, wins, losses),
          player2:players!player2_id(name, email, skill_level, wins, losses)
        `)
        .single();

      if (error) throw error;

      setMatches(prev => [data as Match, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating match:', err);
      throw err;
    }
  };

  const updateMatchResult = async (matchId: string, player1Score: number, player2Score: number, winnerId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .update({
          player1_score: player1Score,
          player2_score: player2Score,
          winner_id: winnerId,
          status: 'completed'
        })
        .eq('id', matchId)
        .select(`
          *,
          player1:players!player1_id(name, email, skill_level, wins, losses),
          player2:players!player2_id(name, email, skill_level, wins, losses),
          winner:players!winner_id(name, email, skill_level, wins, losses)
        `)
        .single();

      if (error) throw error;

      setMatches(prev => prev.map(match => 
        match.id === matchId ? data as Match : match
      ));
      
      return data;
    } catch (err) {
      console.error('Error updating match result:', err);
      throw err;
    }
  };

  return {
    matches,
    loading,
    error,
    refetch: fetchMatches,
    createMatch,
    updateMatchResult
  };
};
