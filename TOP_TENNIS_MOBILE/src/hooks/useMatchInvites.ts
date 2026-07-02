import { useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface MatchInviteRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string | null;
  message?: string | null;
  created_at: string;
  proposed_date?: string | null;
  proposed_start_time?: string | null;
  proposed_end_time?: string | null;
  proposed_by_user_id?: string | null;
  sender?: { first_name: string; last_name: string; profile_picture_url?: string | null };
  receiver?: { first_name: string; last_name: string; profile_picture_url?: string | null };
}

export function useMatchInvites() {
  const { user } = useAuth();

  const fetchInvite = useCallback(async (id: string): Promise<MatchInviteRecord | null> => {
    const { data, error } = await supabase
      .from('match_invites')
      .select(`
        *,
        sender:profiles!match_invites_sender_id_fkey(first_name,last_name,profile_picture_url),
        receiver:profiles!match_invites_receiver_id_fkey(first_name,last_name,profile_picture_url)
      `)
      .eq('id', id)
      .single();
    if (error) return null;
    return data as MatchInviteRecord;
  }, []);

  const sendMatchInvites = useCallback(async (params: {
    receiverIds: string[];
    date: string;
    startTime: string;
    endTime: string;
    courtLocation?: string;
    message?: string;
  }): Promise<MatchInviteRecord[]> => {
    if (!user) throw new Error('Not authenticated');
    const records: MatchInviteRecord[] = [];
    for (const receiverId of params.receiverIds) {
      const { data, error } = await supabase
        .from('match_invites')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          date: params.date,
          start_time: params.startTime,
          end_time: params.endTime,
          court_location: params.courtLocation || null,
          message: params.message || null,
          status: 'pending',
        })
        .select(`
          *,
          sender:profiles!match_invites_sender_id_fkey(first_name,last_name,profile_picture_url),
          receiver:profiles!match_invites_receiver_id_fkey(first_name,last_name,profile_picture_url)
        `)
        .single();
      if (error) throw error;
      records.push(data as MatchInviteRecord);
      await supabase.rpc('insert_notification_safe', {
        p_user_id: receiverId,
        p_type: 'match_invite',
        p_title: 'New Match Invite',
        p_message: `Match request for ${params.date} at ${params.startTime.slice(0, 5)}`,
        p_action_url: null,
        p_metadata: { invite_id: data.id },
      });
    }
    return records;
  }, [user]);

  const respondToInvite = useCallback(async (inviteId: string, status: 'accepted' | 'declined') => {
    if (!user) throw new Error('Not authenticated');
    if (status === 'accepted') {
      // Accepts + books both players' availability slots + declines conflicts
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
        .update({ status, response_at: new Date().toISOString() })
        .eq('id', inviteId);
      if (error) throw error;
      await supabase.rpc('unlock_slots_for_invite', { p_invite_id: inviteId, p_user_id: user.id });
    }
  }, [user]);

  const proposeNewTime = useCallback(async (
    inviteId: string, date: string, startTime: string, endTime: string,
  ) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('match_invites')
      .update({
        proposed_date: date,
        proposed_start_time: startTime,
        proposed_end_time: endTime,
        proposed_by_user_id: user.id,
        proposed_at: new Date().toISOString(),
        status: 'pending',
      })
      .eq('id', inviteId);
    if (error) throw error;
  }, [user]);

  const acceptProposedTime = useCallback(async (invite: MatchInviteRecord) => {
    const { error } = await supabase
      .from('match_invites')
      .update({
        date: invite.proposed_date,
        start_time: invite.proposed_start_time,
        end_time: invite.proposed_end_time,
        proposed_date: null,
        proposed_start_time: null,
        proposed_end_time: null,
        proposed_by_user_id: null,
        status: 'accepted',
      })
      .eq('id', invite.id);
    if (error) throw error;
  }, []);

  const cancelInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase
      .from('match_invites')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: user?.id ?? null,
      })
      .eq('id', inviteId);
    if (error) throw error;
    // Free any availability slots held for this match
    if (user) {
      await supabase.rpc('unlock_slots_for_invite', { p_invite_id: inviteId, p_user_id: user.id });
    }
  }, [user]);

  return { fetchInvite, sendMatchInvites, respondToInvite, proposeNewTime, acceptProposedTime, cancelInvite };
}
