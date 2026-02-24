import { useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface SendMatchInvitePayload {
  receiver_id: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string;
  message?: string;
  availability_id?: string;
}

export function useSendMatchInvite() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const sendInvite = async (payload: SendMatchInvitePayload) => {
    if (!user) throw new Error('Not authenticated');
    setSending(true);
    try {
      const { error } = await supabase.from('match_invites').insert({
        sender_id: user.id,
        receiver_id: payload.receiver_id,
        date: payload.date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        court_location: payload.court_location || null,
        message: payload.message || null,
        status: 'pending',
      });
      if (error) throw error;

      // Notify the receiver
      await supabase.from('notifications').insert({
        user_id: payload.receiver_id,
        type: 'match_invite',
        title: 'New Match Request',
        message: `You have a new match request for ${payload.date} at ${payload.start_time}`,
        read: false,
        action_url: '/dashboard?tab=schedule',
        metadata: { date: payload.date, start_time: payload.start_time },
      });
    } finally {
      setSending(false);
    }
  };

  return { sendInvite, sending };
}
