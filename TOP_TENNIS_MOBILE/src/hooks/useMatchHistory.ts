import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

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
}

export const useMatchHistory = (limit = 20) => {
  const { user } = useAuth();
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
          if (m.score) {
            const s = typeof m.score === 'string' ? JSON.parse(m.score) : m.score;
            const sets = [];
            if (s.set1_p1 !== undefined) sets.push(`${isPlayer1 ? s.set1_p1 : s.set1_p2}-${isPlayer1 ? s.set1_p2 : s.set1_p1}`);
            if (s.set2_p1 !== undefined) sets.push(`${isPlayer1 ? s.set2_p1 : s.set2_p2}-${isPlayer1 ? s.set2_p2 : s.set2_p1}`);
            if (s.set3_p1 !== undefined && s.set3_p1 !== null) sets.push(`${isPlayer1 ? s.set3_p1 : s.set3_p2}-${isPlayer1 ? s.set3_p2 : s.set3_p1}`);
            if (sets.length > 0) scoreDisplay = sets.join(', ');
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
        console.error('[useMatchHistory]', e.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user?.id, limit]);

  return { history, loading };
};
