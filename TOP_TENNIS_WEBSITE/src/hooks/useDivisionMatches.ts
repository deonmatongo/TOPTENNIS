import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DivisionMatch {
  id: string;
  match_date: string;
  player1_name: string;
  player2_name: string;
  player1_id: string;
  player2_id: string;
  winner_id?: string;
  player1_score?: number;
  player2_score?: number;
  set1_player1?: number;
  set1_player2?: number;
  set2_player1?: number;
  set2_player2?: number;
  set3_player1?: number;
  set3_player2?: number;
  status: string;
  court_location?: string;
  duration_minutes?: number;
  home_player_id?: string;
  isUserMatch: boolean;
  userIsPlayer1: boolean;
  opponent_name: string;
  result?: 'win' | 'loss' | 'pending';
}

export const useDivisionMatches = (divisionId?: string) => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<DivisionMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!divisionId) {
      setLoading(false);
      return;
    }

    const fetchDivisionMatches = async () => {
      try {
        // Get all matches involving players in this division
        const { data: divisionAssignments, error: assignmentsError } = await supabase
          .from('division_assignments')
          .select('user_id')
          .eq('division_id', divisionId)
          .eq('status', 'active');

        if (assignmentsError) throw assignmentsError;

        const divisionUserIds = divisionAssignments?.map(a => a.user_id) || [];
        
        if (divisionUserIds.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }

        // Get players info for division members
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('id, user_id, name')
          .in('user_id', divisionUserIds);

        if (playersError) throw playersError;

        const playerIds = players?.map(p => p.id) || [];

        if (playerIds.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }

        // Get matches involving these players
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .or(`player1_id.in.(${playerIds.join(',')}),player2_id.in.(${playerIds.join(',')})`)
          .order('match_date', { ascending: false });

        if (matchesError) throw matchesError;

        // Transform match data
        const formattedMatches: DivisionMatch[] = (matchesData || []).map(match => {
          const player1 = players?.find(p => p.id === match.player1_id);
          const player2 = players?.find(p => p.id === match.player2_id);
          
          const isUserMatch = player1?.user_id === user?.id || player2?.user_id === user?.id;
          const userIsPlayer1 = player1?.user_id === user?.id;
          
          let opponent_name = '';
          let result: 'win' | 'loss' | 'pending' = 'pending';
          
          if (isUserMatch) {
            opponent_name = userIsPlayer1 ? (player2?.name || 'Unknown') : (player1?.name || 'Unknown');
            if (match.status === 'completed' && match.winner_id) {
              const userPlayerId = userIsPlayer1 ? match.player1_id : match.player2_id;
              result = match.winner_id === userPlayerId ? 'win' : 'loss';
            }
          }

          return {
            id: match.id,
            match_date: match.match_date,
            player1_name: player1?.name || 'Unknown',
            player2_name: player2?.name || 'Unknown',
            player1_id: match.player1_id,
            player2_id: match.player2_id,
            winner_id: match.winner_id,
            player1_score: match.player1_score,
            player2_score: match.player2_score,
            set1_player1: match.set1_player1,
            set1_player2: match.set1_player2,
            set2_player1: match.set2_player1,
            set2_player2: match.set2_player2,
            set3_player1: match.set3_player1,
            set3_player2: match.set3_player2,
            status: match.status,
            court_location: match.court_location,
            duration_minutes: match.duration_minutes,
            home_player_id: match.home_player_id,
            isUserMatch,
            userIsPlayer1,
            opponent_name,
            result
          };
        });

        setMatches(formattedMatches);
      } catch (err) {
        console.error('Error fetching division matches:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch matches');
      } finally {
        setLoading(false);
      }
    };

    fetchDivisionMatches();

    // Set up real-time subscription
    const channel = supabase
      .channel('division-matches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          fetchDivisionMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [divisionId, user?.id]);

  return {
    matches,
    loading,
    error,
    userMatches: matches.filter(m => m.isUserMatch),
    upcomingMatches: matches.filter(m => m.status === 'scheduled' && m.isUserMatch),
    recentMatches: matches.filter(m => m.status === 'completed' && m.isUserMatch).slice(0, 5)
  };
};