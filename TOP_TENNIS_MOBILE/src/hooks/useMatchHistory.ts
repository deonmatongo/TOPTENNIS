import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { captureError } from '@/services/sentry';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

export interface MatchHistoryEntry {
  id: string;
  match_date: string;
  opponent_name: string;
  opponent_id: string;
  result: 'win' | 'loss' | 'played';
  score_display: string;
  court_location?: string;
  is_league_match: boolean;
  league_name?: string;
  division_name?: string;
  status: string;
  setsWon?: number;
  setsLost?: number;
  durationMinutes?: number;
  straightSets?: boolean;
  comeback?: boolean;
  bagel?: boolean;
}

export const useMatchHistory = (limit = 20) => {
  const { user } = useAuth();
  const channelTopic = useUniqueChannel('match-history');
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        // Fetch completed league matches for this user
        const { data: leagueMatches } = await supabase
          .from('user_league_matches')
          .select('*')
          .eq('status', 'completed')
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .order('scheduled_date', { ascending: false })
          .limit(limit);

        // Fetch completed casual match invites
        const { data: casualMatches } = await supabase
          .from('match_invites')
          .select(`
            id, date, start_time, court_location, status,
            sender:profiles!match_invites_sender_id_fkey(id, first_name, last_name),
            receiver:profiles!match_invites_receiver_id_fkey(id, first_name, last_name),
            sender_id, receiver_id
          `)
          .eq('status', 'accepted')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .lt('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: false })
          .limit(limit);

        const entries: MatchHistoryEntry[] = [];

        // Process league matches
        (leagueMatches || []).forEach((m: any) => {
          const isPlayer1 = m.player1_id === user.id;
          const opponentFirstName = isPlayer1 ? m.player2_first_name : m.player1_first_name;
          const opponentLastName = isPlayer1 ? m.player2_last_name : m.player1_last_name;
          const opponentName = `${opponentFirstName || ''} ${opponentLastName || ''}`.trim() || 'Opponent';
          const opponentId = isPlayer1 ? m.player2_id : m.player1_id;

          let scoreDisplay = 'No score';
          let setsWon = 0, setsLost = 0;
          let straightSets = false, comeback = false, bagel = false;

          if (m.score) {
            const sc = typeof m.score === 'string' ? JSON.parse(m.score) : m.score;
            const sets: string[] = [];
            const rawSets: [number, number][] = [];

            const addSet = (myGames: number | undefined, oppGames: number | undefined) => {
              if (myGames === undefined || myGames === null) return;
              sets.push(`${myGames}-${oppGames ?? 0}`);
              rawSets.push([myGames, oppGames ?? 0]);
              if (myGames > (oppGames ?? 0)) setsWon++;
              else setsLost++;
            };

            addSet(isPlayer1 ? sc.set1_p1 : sc.set1_p2, isPlayer1 ? sc.set1_p2 : sc.set1_p1);
            addSet(isPlayer1 ? sc.set2_p1 : sc.set2_p2, isPlayer1 ? sc.set2_p2 : sc.set2_p1);
            if (sc.set3_p1 !== undefined && sc.set3_p1 !== null) {
              addSet(isPlayer1 ? sc.set3_p1 : sc.set3_p2, isPlayer1 ? sc.set3_p2 : sc.set3_p1);
            }

            if (sets.length > 0) scoreDisplay = sets.join(', ');

            const isWinner = m.winner_id === user.id;
            if (isWinner) {
              straightSets = setsWon === 2 && setsLost === 0;
              // comeback: lost first set, won the match
              comeback = rawSets.length >= 2 && rawSets[0][0] < rawSets[0][1];
              // bagel: any set won 6-0
              bagel = rawSets.some(([my, opp]) => my === 6 && opp === 0);
            }
          }

          entries.push({
            id: m.id,
            match_date: m.scheduled_date || m.created_at,
            opponent_name: opponentName,
            opponent_id: opponentId,
            result: m.winner_id === user.id ? 'win' : 'loss',
            score_display: scoreDisplay,
            court_location: m.court_location,
            is_league_match: true,
            league_name: m.league_name,
            division_name: m.division_name,
            status: m.status,
            setsWon,
            setsLost,
            durationMinutes: m.match_duration_minutes ?? m.duration_minutes ?? undefined,
            straightSets,
            comeback,
            bagel,
          });
        });

        // Process casual matches (past accepted invites — no winner tracked, show as played)
        (casualMatches || []).forEach((m: any) => {
          const isSender = m.sender_id === user.id;
          const other = isSender ? m.receiver : m.sender;
          const opponentName = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
          entries.push({
            id: m.id,
            match_date: m.date,
            opponent_name: opponentName,
            opponent_id: isSender ? m.receiver_id : m.sender_id,
            result: 'played', // casual matches don't track winner
            score_display: 'Casual match',
            court_location: m.court_location,
            is_league_match: false,
            status: 'completed',
          });
        });

        // Sort by date descending
        entries.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

        setHistory(entries.slice(0, limit));
      } catch (e: any) {
        captureError(e);
        if (__DEV__) console.warn('[useMatchHistory]', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();

    // Bug fix: useMatchHistory previously had no realtime subscription.
    // Subscribe to the two base tables whose changes alter the history list:
    //   - league_matches: updated by submit_league_match_score (RPC); underlies
    //     the user_league_matches view that this hook reads.
    //   - match_invites (both sides): updated by recordMatchResult() when a
    //     casual match score is recorded (winner_id / score columns are set).
    const channel = supabase
      .channel(channelTopic)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'league_matches',
      }, (payload: any) => {
        if (__DEV__) console.log('[match-history] league_matches UPDATE', payload);
        fetch();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_invites',
        filter: `sender_id=eq.${user.id}`,
      }, (payload: any) => {
        if (__DEV__) console.log('[match-history] match_invites UPDATE (sender)', payload);
        fetch();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_invites',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload: any) => {
        if (__DEV__) console.log('[match-history] match_invites UPDATE (receiver)', payload);
        fetch();
      })
      .subscribe((status: string) => {
        if (__DEV__) console.log('[match-history] channel status', status);
      });

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') fetch();
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      supabase.removeChannel(channel);
      appStateSub.remove();
    };
  }, [user?.id, limit]);

  return { history, loading };
};
