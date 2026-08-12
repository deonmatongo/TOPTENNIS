import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { captureError } from '@/services/sentry';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

export interface DivisionMatch {
  id: string;
  match_date: string;
  player1_name: string;
  player2_name: string;
  player1_id: string;
  player2_id: string;
  winner_id?: string;
  set1_player1?: number;
  set1_player2?: number;
  set2_player1?: number;
  set2_player2?: number;
  set3_player1?: number;
  set3_player2?: number;
  status: string;
  court_location?: string;
  home_player_id?: string;
  isUserMatch: boolean;
  userIsPlayer1: boolean;
  opponent_name: string;
  opponent_user_id: string;
  result?: 'win' | 'loss' | 'pending';
}

export const useDivisionMatches = (divisionId?: string) => {
  const { user } = useAuth();
  const channelTopic = useUniqueChannel('division-matches');
  const [matches, setMatches] = useState<DivisionMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!divisionId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        const { data: assignments } = await supabase
          .from('division_assignments')
          .select('user_id')
          .eq('division_id', divisionId)
          .eq('status', 'active');

        const userIds = (assignments || []).map((a: any) => a.user_id);
        if (userIds.length === 0) { setMatches([]); setLoading(false); return; }

        const { data: players } = await supabase
          .from('players')
          .select('id, user_id, name')
          .in('user_id', userIds);

        const playerIds = (players || []).map((p: any) => p.id);
        if (playerIds.length === 0) { setMatches([]); setLoading(false); return; }

        const { data: matchesData } = await supabase
          .from('matches')
          .select('*')
          .or(`player1_id.in.(${playerIds.join(',')}),player2_id.in.(${playerIds.join(',')})`)
          .order('match_date', { ascending: false });

        const formatted: DivisionMatch[] = (matchesData || []).map((m: any) => {
          const p1 = (players || []).find((p: any) => p.id === m.player1_id);
          const p2 = (players || []).find((p: any) => p.id === m.player2_id);
          const isUserMatch = p1?.user_id === user?.id || p2?.user_id === user?.id;
          const userIsPlayer1 = p1?.user_id === user?.id;
          const opponent_name = isUserMatch
            ? (userIsPlayer1 ? p2?.name : p1?.name) || 'Unknown'
            : '';
          const opponent_user_id = isUserMatch
            ? (userIsPlayer1 ? p2?.user_id : p1?.user_id) || ''
            : '';
          let result: 'win' | 'loss' | 'pending' = 'pending';
          if (isUserMatch && m.status === 'completed' && m.winner_id) {
            const userPlayerId = userIsPlayer1 ? m.player1_id : m.player2_id;
            result = m.winner_id === userPlayerId ? 'win' : 'loss';
          }
          return {
            id: m.id,
            match_date: m.match_date,
            player1_name: p1?.name || 'Unknown',
            player2_name: p2?.name || 'Unknown',
            player1_id: m.player1_id,
            player2_id: m.player2_id,
            winner_id: m.winner_id,
            set1_player1: m.set1_player1,
            set1_player2: m.set1_player2,
            set2_player1: m.set2_player1,
            set2_player2: m.set2_player2,
            set3_player1: m.set3_player1,
            set3_player2: m.set3_player2,
            status: m.status,
            court_location: m.court_location,
            home_player_id: m.home_player_id,
            isUserMatch,
            userIsPlayer1,
            opponent_name,
            opponent_user_id,
            result,
          };
        });

        setMatches(formatted);
      } catch (e: any) {
        captureError(e);
        if (__DEV__) console.warn('[useDivisionMatches]', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel(`${channelTopic}-${divisionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetch)
      .subscribe((status: string) => {
        if (__DEV__) console.log('[division-matches] channel status', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [divisionId, user?.id]);

  return {
    matches,
    loading,
    userMatches: matches.filter(m => m.isUserMatch),
    upcomingMatches: matches.filter(m => m.status === 'scheduled' && m.isUserMatch),
    recentMatches: matches.filter(m => m.status === 'completed' && m.isUserMatch).slice(0, 5),
  };
};
