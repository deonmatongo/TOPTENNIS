import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

export interface LeagueMatch {
  id: string;
  division_id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  scheduled_date?: string;
  scheduled_time?: string;
  court_location?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  winner_id?: string;
  score?: any;
  is_playoff: boolean;
  round_number: number;
  match_number?: number;
  created_at: string;
  // derived
  isUserMatch: boolean;
  userIsPlayer1: boolean;
  opponent_name: string;
  opponent_id: string;
  result?: 'win' | 'loss' | 'pending';
  needsScoreReport: boolean;
}

export const useLeagueMatches = (divisionId?: string) => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async () => {
    if (!divisionId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Fetch league_matches with profile names via view or direct join
      const { data, error } = await supabase
        .from('user_league_matches')
        .select('*')
        .eq('division_id', divisionId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const formatted: LeagueMatch[] = (data || []).map((m: any) => {
        const userIsPlayer1 = m.player1_id === user?.id;
        const isUserMatch = m.player1_id === user?.id || m.player2_id === user?.id;
        const opponent_name = m.opponent_name || (userIsPlayer1
          ? `${m.player2_first_name} ${m.player2_last_name}`
          : `${m.player1_first_name} ${m.player1_last_name}`);
        const opponent_id = m.opponent_id || (userIsPlayer1 ? m.player2_id : m.player1_id);

        let result: 'win' | 'loss' | 'pending' = 'pending';
        if (m.status === 'completed' && m.winner_id) {
          result = m.winner_id === user?.id ? 'win' : 'loss';
        }

        return {
          id: m.id,
          division_id: m.division_id,
          player1_id: m.player1_id,
          player2_id: m.player2_id,
          player1_name: `${m.player1_first_name} ${m.player1_last_name}`,
          player2_name: `${m.player2_first_name} ${m.player2_last_name}`,
          scheduled_date: m.scheduled_date,
          scheduled_time: m.scheduled_time,
          court_location: m.court_location,
          status: m.status,
          winner_id: m.winner_id,
          score: m.score,
          is_playoff: m.is_playoff || false,
          round_number: m.round_number || 1,
          match_number: m.match_number,
          created_at: m.created_at,
          isUserMatch,
          userIsPlayer1,
          opponent_name,
          opponent_id,
          result,
          needsScoreReport: m.status === 'completed' && !m.winner_id && isUserMatch,
        };
      });

      setMatches(formatted);
    } catch (e: any) {
      console.error('[useLeagueMatches]', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();

    const channel = supabase
      .channel(`league-matches-${divisionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_matches', filter: `division_id=eq.${divisionId}` }, fetchMatches)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [divisionId, user?.id]);

  const submitScore = async (params: {
    matchId: string;
    winnerId: string;
    set1p1: number; set1p2: number;
    set2p1: number; set2p2: number;
    set3p1?: number | null; set3p2?: number | null;
    tiebreakP1?: number | null; tiebreakP2?: number | null;
    reportedByPlayerId: string;
  }) => {
    const { data, error } = await supabase.rpc('submit_league_match_score', {
      p_match_id: params.matchId,
      p_winner_id: params.winnerId,
      p_set1_p1: params.set1p1,
      p_set1_p2: params.set1p2,
      p_set2_p1: params.set2p1,
      p_set2_p2: params.set2p2,
      p_set3_p1: params.set3p1 ?? null,
      p_set3_p2: params.set3p2 ?? null,
      p_tiebreak_p1: params.tiebreakP1 ?? null,
      p_tiebreak_p2: params.tiebreakP2 ?? null,
      p_reported_by: params.reportedByPlayerId,
    });
    if (error) throw error;
    await fetchMatches();
    return data;
  };

  const scheduleMatch = async (params: {
    divisionId: string;
    opponentUserId: string;
    date: string;
    time: string;
    timezone: string;
    courtLocation: string;
    message?: string;
  }) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase.rpc('create_league_match_with_invite', {
      p_division_id: params.divisionId,
      p_player1_id: user.id,
      p_player2_id: params.opponentUserId,
      p_scheduled_date: params.date,
      p_scheduled_time: params.time,
      p_timezone: params.timezone,
      p_court_location: params.courtLocation,
      p_message: params.message ?? null,
    });
    if (error) throw error;
    await fetchMatches();
    return data;
  };

  return {
    matches,
    loading,
    refetch: fetchMatches,
    submitScore,
    scheduleMatch,
    userMatches: matches.filter(m => m.isUserMatch),
    upcomingMatches: matches.filter(m => m.isUserMatch && (m.status === 'pending' || m.status === 'scheduled')),
    completedMatches: matches.filter(m => m.isUserMatch && m.status === 'completed'),
    playoffMatches: matches.filter(m => m.is_playoff),
  };
};
