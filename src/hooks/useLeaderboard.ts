
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Player = Tables<'players'>;

export const useLeaderboard = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        console.log('Fetching leaderboard...');
        
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .order('wins', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching leaderboard:', error);
          setError(error.message);
          return;
        }

        console.log('Leaderboard data:', data);
        setPlayers(data);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('Failed to fetch leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return {
    players,
    leaderboard: players, // Add alias for backward compatibility
    loading,
    error
  };
};
