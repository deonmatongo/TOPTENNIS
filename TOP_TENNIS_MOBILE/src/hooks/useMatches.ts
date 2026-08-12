import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { captureError } from '@/services/sentry';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';
import { useRealtimeConnection } from '@/contexts/RealtimeConnectionContext';
import { subscribeWithRetry } from '@/utils/realtimeRetry';

export interface MatchInvite {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string;
  message?: string;
  created_at: string;
  is_league_match?: boolean;
  league_match_id?: string;
  division_id?: string;
  proposed_date?: string;
  proposed_start_time?: string;
  proposed_end_time?: string;
  winner_id?: string | null;
  player1_score?: number | null;
  player2_score?: number | null;
  sender?: { first_name: string; last_name: string; skill_level?: number; profile_picture_url?: string; wins?: number; losses?: number; usta_rating?: string; competitiveness?: string; city?: string; age_range?: string };
  receiver?: { first_name: string; last_name: string; skill_level?: number; profile_picture_url?: string; wins?: number; losses?: number; usta_rating?: string; competitiveness?: string; city?: string; age_range?: string };
}

// Identity fields live on `profiles`; tennis stats live on `players` (keyed by
// user_id). Merge the two so callers get a single opponent object.
async function fetchParticipants(userIds: string[]) {
  const [{ data: profiles }, { data: players }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, profile_picture_url, city')
      .in('id', userIds),
    supabase
      .from('players')
      .select('user_id, skill_level, wins, losses, usta_rating, competitiveness, age_range')
      .in('user_id', userIds),
  ]);
  const playerMap = new Map((players || []).map(p => [p.user_id, p]));
  return new Map(
    (profiles || []).map(p => {
      const stats = playerMap.get(p.id) || {};
      return [p.id, { ...p, ...stats }];
    })
  );
}

async function notify(userId: string, type: string, title: string, message: string, actionUrl?: string, metadata?: Record<string, unknown>) {
  // insert_notification_safe dedups server-side and triggers the send-push
  // edge function via the notifications INSERT trigger.
  const { error } = await supabase.rpc('insert_notification_safe', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_action_url: actionUrl ?? null,
    p_metadata: metadata ?? {},
  });
  if (error) throw error;
}

export const useMatches = () => {
  const { user } = useAuth();
  const { connectionGeneration } = useRealtimeConnection();
  const channelName = useUniqueChannel('matches-invites');
  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const checkPastDueMatches = useCallback(async (allInvites: MatchInvite[]) => {
    const now = new Date();
    const pastDue = allInvites.filter(i =>
      i.status === 'accepted' &&
      !i.winner_id &&
      new Date(`${i.date}T${i.start_time}`) < now
    );
    if (pastDue.length === 0) return;

    const matchIds = pastDue.map(i => i.id);
    const { data: existing } = await supabase
      .from('notifications')
      .select('metadata')
      .eq('type', 'score_reminder')
      .in('metadata->>match_id', matchIds);

    const alreadyNotified = new Set((existing || []).map((n: any) => n.metadata?.match_id));
    const toNotify = pastDue.filter(i => !alreadyNotified.has(i.id));
    if (toNotify.length === 0) return;

    await Promise.allSettled(
      toNotify.flatMap(i => [i.sender_id, i.receiver_id].map(uid =>
        notify(
          uid,
          'score_reminder',
          'Record Match Score',
          'Your match has ended. Please record the score so the leaderboard stays up to date.',
          '/dashboard?tab=schedule',
          { match_id: i.id },
        )
      ))
    );
  }, []);

  const fetchInvites = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('match_invites')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = new Set<string>();
      (data || []).forEach(i => { userIds.add(i.sender_id); userIds.add(i.receiver_id); });

      const profileMap = await fetchParticipants(Array.from(userIds));

      const enriched: MatchInvite[] = (data || []).map(i => ({
        ...i,
        sender: profileMap.get(i.sender_id),
        receiver: profileMap.get(i.receiver_id),
      }));

      setInvites(enriched);
      checkPastDueMatches(enriched).catch(() => {});
    } catch (e) {
      captureError(e);
      if (__DEV__) console.warn('Error fetching matches:', e);
    } finally {
      setLoading(false);
    }
  }, [user, checkPastDueMatches]);

  const respondToInvite = useCallback(async (inviteId: string, status: 'accepted' | 'declined') => {
    if (!user) throw new Error('Not signed in');

    if (status === 'accepted') {
      // Server-side: accepts the invite, marks both players' overlapping
      // availability slots as booked, and auto-declines conflicting invites.
      const { data, error } = await supabase.rpc('accept_invite_and_lock_slot', {
        p_invite_id: inviteId,
        p_user_id: user.id,
        p_conflicting_invite_ids: [],
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Could not accept invite');
    } else {
      const { error } = await supabase
        .from('match_invites')
        .update({ status, response_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', inviteId)
        .eq('receiver_id', user.id);
      if (error) throw error;
      // Free any slots that were held for this invite (no-op if none)
      await supabase.rpc('unlock_slots_for_invite', { p_invite_id: inviteId, p_user_id: user.id });
    }

    const invite = invites.find(i => i.id === inviteId);
    if (invite) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Someone';
      await notify(
        invite.sender_id,
        status === 'accepted' ? 'match_accepted' : 'match_declined',
        status === 'accepted' ? 'Match Accepted' : 'Match Declined',
        status === 'accepted'
          ? `${name} accepted your match invitation`
          : `${name} declined your match invitation`,
        '/dashboard?tab=schedule',
        { match_id: inviteId },
      ).catch(() => {});
    }

    await fetchInvites();
  }, [user, invites, fetchInvites]);

  /**
   * Record the result of a casual (non-league) match.
   * The caller is the winner. Updates match_invites and increments
   * win/loss counters on both players rows (the leaderboard source).
   */
  const recordMatchResult = useCallback(async (
    matchId: string,
    winnerId: string,
    senderSetsWon: number,
    receiverSetsWon: number,
  ) => {
    // 1. Persist result on the match invite
    const { error } = await supabase
      .from('match_invites')
      .update({
        winner_id: winnerId,
        player1_score: senderSetsWon,
        player2_score: receiverSetsWon,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId);
    if (error) throw error;

    // 2. Determine loser id from the cached invites
    const invite = invites.find(i => i.id === matchId);
    if (invite) {
      const loserId = winnerId === invite.sender_id ? invite.receiver_id : invite.sender_id;

      // Win/loss counters live on players (profiles has no wins/losses columns)
      const { data: playerRows } = await supabase
        .from('players')
        .select('id, user_id, wins, losses, total_matches')
        .in('user_id', [winnerId, loserId]);

      const playerMap = new Map((playerRows || []).map(p => [p.user_id, p]));
      const winnerPlayer = playerMap.get(winnerId);
      const loserPlayer  = playerMap.get(loserId);

      const updates: any[] = [];
      if (winnerPlayer) {
        updates.push(supabase.from('players').update({
          wins: (winnerPlayer.wins || 0) + 1,
          total_matches: (winnerPlayer.total_matches || 0) + 1,
        }).eq('user_id', winnerId));
      }
      if (loserPlayer) {
        updates.push(supabase.from('players').update({
          losses: (loserPlayer.losses || 0) + 1,
          total_matches: (loserPlayer.total_matches || 0) + 1,
        }).eq('user_id', loserId));
      }
      await Promise.allSettled(updates);

      // 3. Notify the opponent
      if (user) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        const myName = myProfile
          ? `${myProfile.first_name} ${myProfile.last_name}`.trim()
          : 'Your opponent';

        const notifiedUserId = user.id === invite.sender_id ? invite.receiver_id : invite.sender_id;
        const didOppWin = winnerId === notifiedUserId;

        await notify(
          notifiedUserId,
          'match_result',
          didOppWin ? 'Match Result — You Won!' : 'Match Result Logged',
          didOppWin
            ? `${myName} has logged the match result. You won ${receiverSetsWon}–${senderSetsWon} in sets.`
            : `${myName} has logged the match result. They won ${senderSetsWon}–${receiverSetsWon} in sets.`,
          '/matches',
          { match_id: matchId },
        ).catch(() => {}); // non-critical
      }
    }

    await fetchInvites();
  }, [invites, user, fetchInvites]);

  const pendingReceived = invites.filter(
    i => i.status === 'pending' && i.receiver_id === user?.id
  );
  const upcoming = invites.filter(
    i => i.status === 'accepted' && new Date(`${i.date}T${i.start_time}`) >= new Date()
  );
  const history = invites.filter(
    i => i.status === 'accepted' && new Date(`${i.date}T${i.start_time}`) < new Date()
  );

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchInvites();

    // Bug fix: useMatches previously had no realtime subscription. When another
    // user inserted a match_invites row (sending you an invite), this hook never
    // heard about it — the invite only appeared on app re-open because the hook
    // re-mounted. Adding two .on() listeners (one per FK column) covers both
    // sender and receiver sides; Supabase doesn't support OR across columns in a
    // single filter clause.
    const cleanupChannel = subscribeWithRetry(() =>
      supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'match_invites',
          filter: `sender_id=eq.${user.id}`,
        }, (payload: any) => {
          if (__DEV__) console.log('[matches] invite event (sender)', payload);
          fetchInvites();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'match_invites',
          filter: `receiver_id=eq.${user.id}`,
        }, (payload: any) => {
          if (__DEV__) console.log('[matches] invite event (receiver)', payload);
          fetchInvites();
        }),
      'matches',
    );

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (__DEV__) console.log('[matches] app foregrounded — refetching');
        fetchInvites();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      cleanupChannel();
      appStateSub.remove();
    };
  }, [user, fetchInvites, connectionGeneration]);

  return { invites, loading, pendingReceived, upcoming, history, respondToInvite, recordMatchResult, refetch: fetchInvites };
};
