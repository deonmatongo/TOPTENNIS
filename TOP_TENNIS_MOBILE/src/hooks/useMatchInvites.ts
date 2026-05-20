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
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'match_invite',
        title: 'New Match Invite',
        message: `Match request for ${params.date} at ${params.startTime.slice(0, 5)}`,
        read: false,
        metadata: { invite_id: data.id },
      });
    }
    return records;
  }, [user]);

  const respondToInvite = useCallback(async (inviteId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('match_invites')
      .update({ status })
      .eq('id', inviteId);
    if (error) throw error;
  }, []);

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
      .update({ status: 'cancelled' })
      .eq('id', inviteId);
    if (error) throw error;
  }, []);

  return { fetchInvite, sendMatchInvites, respondToInvite, proposeNewTime, acceptProposedTime, cancelInvite };
}
