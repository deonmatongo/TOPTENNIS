import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PerformanceMatch {
  id: string;
  matchDate: string;
  opponentName: string;
  opponentPlayerId: string;
  leagueId: string | null;
  courtLocation: string | null;
  durationMinutes: number | null;
  isWin: boolean;
  playerIsPlayer1: boolean;
  /** Formatted tennis score from the current player's perspective: "6–4, 7–5" */
  score: string;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  /** Won every set — no set dropped */
  wonInStraightSets: boolean;
  /** Lost the first set but won the match */
  wasComeback: boolean;
  /** Won at least one set 6–0 */
  hasBagel: boolean;
  /** Match included a set tiebreak (7–6) or super/match tiebreak */
  hasTiebreak: boolean;
}

export interface PlayerPerformanceStats {
  matches: PerformanceMatch[];       // newest-first for display
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;                   // 0–100
  currentStreak: number;
  bestStreak: number;
  setsWon: number;
  setsLost: number;
  setWinRate: number;                // 0–100
  gamesWon: number;
  gamesLost: number;
  gameWinRate: number;               // 0–100
  straightSetsWins: number;
  comebackWins: number;
  bagels: number;                    // matches where player hit at least one 6–0 set
  tiebreakMatches: number;
  hoursPlayed: number;               // estimated from duration_minutes (default 90 min)
}

// ── Score helpers ─────────────────────────────────────────────────────────────

/**
 * Formats the match score from the current player's perspective.
 * e.g. "6–4, 7–5" (win) or "4–6, 5–7" (loss)
 * Super-tiebreaks are shown in brackets: "6–4, 4–6, [10–7]"
 */
function formatTennisScore(m: any, isP1: boolean): string {
  const sets: string[] = [];
  const addSet = (p1: number | null, p2: number | null) => {
    if (p1 === null || p2 === null) return;
    const my = isP1 ? p1 : p2;
    const op = isP1 ? p2 : p1;
    sets.push(`${my}–${op}`);
  };
  addSet(m.set1_player1, m.set1_player2);
  addSet(m.set2_player1, m.set2_player2);
  addSet(m.set3_player1, m.set3_player2);
  // Super/match tiebreak (replaces a 3rd set in many league formats)
  if (m.tiebreak_player1 !== null && m.tiebreak_player2 !== null) {
    const my = isP1 ? m.tiebreak_player1 : m.tiebreak_player2;
    const op = isP1 ? m.tiebreak_player2 : m.tiebreak_player1;
    sets.push(`[${my}–${op}]`);
  }
  return sets.length ? sets.join(', ') : '—';
}

function getSetStats(m: any, isP1: boolean) {
  let sW = 0, sL = 0, gW = 0, gL = 0;
  const check = (p1: number | null, p2: number | null) => {
    if (p1 === null || p2 === null) return;
    const my = isP1 ? p1 : p2;
    const op = isP1 ? p2 : p1;
    gW += my; gL += op;
    if (my > op) sW++; else sL++;
  };
  check(m.set1_player1, m.set1_player2);
  check(m.set2_player1, m.set2_player2);
  check(m.set3_player1, m.set3_player2);
  return { setsWon: sW, setsLost: sL, gamesWon: gW, gamesLost: gL };
}

function checkBagel(m: any, isP1: boolean): boolean {
  const isBagel = (p1: number | null, p2: number | null) => {
    if (p1 === null || p2 === null) return false;
    const my = isP1 ? p1 : p2, op = isP1 ? p2 : p1;
    return my === 6 && op === 0;
  };
  return isBagel(m.set1_player1, m.set1_player2) ||
         isBagel(m.set2_player1, m.set2_player2) ||
         isBagel(m.set3_player1, m.set3_player2);
}

function checkTiebreak(m: any): boolean {
  const isTB = (p1: number | null, p2: number | null) =>
    p1 !== null && p2 !== null && ((p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7));
  return (
    isTB(m.set1_player1, m.set1_player2) ||
    isTB(m.set2_player1, m.set2_player2) ||
    isTB(m.set3_player1, m.set3_player2) ||
    (m.tiebreak_player1 !== null && m.tiebreak_player2 !== null)
  );
}

function checkComeback(m: any, isP1: boolean, isWin: boolean): boolean {
  if (!isWin || m.set1_player1 === null || m.set1_player2 === null) return false;
  const my1 = isP1 ? m.set1_player1 : m.set1_player2;
  const op1 = isP1 ? m.set1_player2 : m.set1_player1;
  return my1 < op1; // Lost first set, still won the match
}

/** Compute current and best win streaks from the chronological (asc) list */
function computeStreaks(sorted: PerformanceMatch[]): { current: number; best: number } {
  let best = 0, run = 0;
  for (const m of sorted) {
    run = m.isWin ? run + 1 : 0;
    if (run > best) best = run;
  }
  let current = 0;
  for (const m of [...sorted].reverse()) {
    if (m.isWin) current++; else break;
  }
  return { current, best };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const usePlayerPerformance = (playerId: string | undefined) => {
  const [stats, setStats] = useState<PlayerPerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!playerId) { setLoading(false); return; }
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, match_date, court_location, duration_minutes, league_id,
          player1_id, player2_id, winner_id,
          set1_player1, set1_player2,
          set2_player1, set2_player2,
          set3_player1, set3_player2,
          tiebreak_player1, tiebreak_player2,
          player1:players!player1_id(id, name),
          player2:players!player2_id(id, name)
        `)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .eq('status', 'completed')
        .not('match_date', 'is', null)
        .order('match_date', { ascending: true }); // ascending for streak calculation

      if (error) throw error;

      const perfMatches: PerformanceMatch[] = (data || []).map(r => {
        const isP1 = r.player1_id === playerId;
        const isWin = r.winner_id === playerId;
        const opp = isP1 ? (r.player2 as any) : (r.player1 as any);
        const sets = getSetStats(r, isP1);

        return {
          id: r.id,
          matchDate: r.match_date!,
          opponentName: opp?.name || 'Unknown Player',
          opponentPlayerId: (isP1 ? r.player2_id : r.player1_id) ?? '',
          leagueId: r.league_id,
          courtLocation: r.court_location,
          durationMinutes: r.duration_minutes,
          isWin,
          playerIsPlayer1: isP1,
          score: formatTennisScore(r, isP1),
          setsWon: sets.setsWon,
          setsLost: sets.setsLost,
          gamesWon: sets.gamesWon,
          gamesLost: sets.gamesLost,
          wonInStraightSets: isWin && sets.setsLost === 0,
          wasComeback: checkComeback(r, isP1, isWin),
          hasBagel: checkBagel(r, isP1),
          hasTiebreak: checkTiebreak(r),
        };
      });

      const streaks = computeStreaks(perfMatches);
      const wins = perfMatches.filter(m => m.isWin).length;
      const total = perfMatches.length;
      const sW = perfMatches.reduce((a, m) => a + m.setsWon, 0);
      const sL = perfMatches.reduce((a, m) => a + m.setsLost, 0);
      const gW = perfMatches.reduce((a, m) => a + m.gamesWon, 0);
      const gL = perfMatches.reduce((a, m) => a + m.gamesLost, 0);

      setStats({
        matches: [...perfMatches].reverse(), // newest-first for display
        totalMatches: total,
        wins,
        losses: total - wins,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
        currentStreak: streaks.current,
        bestStreak: streaks.best,
        setsWon: sW,
        setsLost: sL,
        setWinRate: (sW + sL) > 0 ? Math.round((sW / (sW + sL)) * 100) : 0,
        gamesWon: gW,
        gamesLost: gL,
        gameWinRate: (gW + gL) > 0 ? Math.round((gW / (gW + gL)) * 100) : 0,
        straightSetsWins: perfMatches.filter(m => m.wonInStraightSets).length,
        comebackWins: perfMatches.filter(m => m.wasComeback).length,
        bagels: perfMatches.filter(m => m.hasBagel && m.isWin).length,
        tiebreakMatches: perfMatches.filter(m => m.hasTiebreak).length,
        hoursPlayed: Math.round(
          perfMatches.reduce((a, m) => a + (m.durationMinutes ?? 90), 0) / 60
        ),
      });
    } catch (err) {
      console.error('[usePlayerPerformance]', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchStats();
    if (!playerId) return;

    // Re-fetch when any match involving this player is updated
    const channel = supabase
      .channel(`player-perf-${playerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, fetchStats)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, fetchStats)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[usePlayerPerformance] channel error, will retry on next render');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [playerId, fetchStats]);

  return { stats, loading, refetch: fetchStats };
};
