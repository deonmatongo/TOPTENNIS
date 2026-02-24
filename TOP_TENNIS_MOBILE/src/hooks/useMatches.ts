import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  sender?: { first_name: string; last_name: string; skill_level?: number; profile_picture_url?: string; wins?: number; losses?: number; usta_rating?: string; competitiveness?: string; city?: string };
  receiver?: { first_name: string; last_name: string; skill_level?: number; profile_picture_url?: string };
}

export const useMatches = () => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [loading, setLoading] = useState(true);

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

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, skill_level, profile_picture_url')
        .in('id', Array.from(userIds));

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: MatchInvite[] = (data || []).map(i => ({
        ...i,
        sender: profileMap.get(i.sender_id),
        receiver: profileMap.get(i.receiver_id),
      }));

      setInvites(enriched);
    } catch (e) {
      console.error('Error fetching matches:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const respondToInvite = useCallback(async (inviteId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('match_invites')
      .update({ status, response_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('receiver_id', user?.id);
    if (error) throw error;

    if (user) {
      const invite = invites.find(i => i.id === inviteId);
      if (invite) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Someone';
        await supabase.from('notifications').insert({
          user_id: invite.sender_id,
          type: status === 'accepted' ? 'match_accepted' : 'match_declined',
          title: status === 'accepted' ? 'Match Accepted' : 'Match Declined',
          message: status === 'accepted'
            ? `${name} accepted your match invitation`
            : `${name} declined your match invitation`,
          read: false,
          action_url: '/dashboard?tab=schedule',
          metadata: { match_id: inviteId },
        });
      }
    }

    await fetchInvites();
  }, [user, invites, fetchInvites]);

  const pendingReceived = invites.filter(
    i => i.status === 'pending' && i.receiver_id === user?.id
  );
  const upcoming = invites.filter(
    i => i.status === 'accepted' && new Date(`${i.date}T${i.start_time}`) >= new Date()
  );
  const history = invites.filter(
    i => i.status === 'accepted' && new Date(`${i.date}T${i.start_time}`) < new Date()
  );

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  return { invites, loading, pendingReceived, upcoming, history, respondToInvite, refetch: fetchInvites };
};
