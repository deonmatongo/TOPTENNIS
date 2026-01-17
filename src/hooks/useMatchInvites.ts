import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useBrowserNotifications } from './useBrowserNotifications';
import { logger } from '@/utils/logger';

type MatchInvite = Tables<'match_invites'> & {
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  receiver?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  proposed_by?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
};

export const useMatchInvites = () => {
  const { user } = useAuth();
  const { subscribeToUserChanges } = useRealtime();
  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendNotification } = useBrowserNotifications();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchInvites();

    // Set up real-time subscription using context
    const unsubscribe = subscribeToUserChanges(async (payload) => {
      if (payload.table === 'match_invites') {
        logger.debug('Real-time invite update', { payload });
        
        // Handle new invite notifications (INSERT)
        if (payload.eventType === 'INSERT') {
          const newInvite = payload.new as any;
          
          // Only show notification if current user is receiver
          if (newInvite.receiver_id === user.id) {
            // Fetch sender profile for notification
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', newInvite.sender_id)
              .single();
            
            if (senderProfile) {
              const senderName = `${senderProfile.first_name} ${senderProfile.last_name}`;
              const message = `New match invite from ${senderName}!`;
              
              toast.info(message, {
                duration: 5000,
              });
              
              // Send browser notification with click action
              sendNotification('New Match Invite', {
                body: message,
                tag: newInvite.id,
                clickUrl: '/dashboard?tab=schedule',
              });
            }
          }
        }
        
        // Handle invite status changes (UPDATE)
        if (payload.eventType === 'UPDATE') {
          const oldInvite = payload.old as any;
          const updatedInvite = payload.new as any;
          
          // Check if status changed
          if (oldInvite.status !== updatedInvite.status) {
            // If current user is the sender, notify them of receiver's response
            if (updatedInvite.sender_id === user.id) {
              const { data: receiverProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', updatedInvite.receiver_id)
                .single();
              
              if (receiverProfile) {
                const receiverName = `${receiverProfile.first_name} ${receiverProfile.last_name}`;
                
                if (updatedInvite.status === 'accepted') {
                  const message = `${receiverName} accepted your match invite!`;
                  toast.success(message, {
                    duration: 5000,
                  });
                  
                  sendNotification('Match Invite Accepted', {
                    body: message,
                    tag: updatedInvite.id,
                    clickUrl: '/dashboard?tab=schedule',
                  });
                } else if (updatedInvite.status === 'declined') {
                  const message = `${receiverName} declined your match invite`;
                  toast.info(message, {
                    duration: 5000,
                  });
                  
                  sendNotification('Match Invite Declined', {
                    body: message,
                    tag: updatedInvite.id,
                    clickUrl: '/dashboard?tab=schedule',
                  });
                }
              }
            }
            
            // If current user is the receiver and status changed to cancelled
            if (updatedInvite.receiver_id === user.id && updatedInvite.status === 'cancelled') {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', updatedInvite.sender_id)
                .single();
              
              if (senderProfile) {
                const senderName = `${senderProfile.first_name} ${senderProfile.last_name}`;
                const message = `${senderName} cancelled the match`;
                toast.info(message, {
                  duration: 5000,
                });
                
                sendNotification('Match Cancelled', {
                  body: message,
                  tag: updatedInvite.id,
                  clickUrl: '/dashboard?tab=schedule',
                });
              }
            }
          }
        }
        
        // Always refresh invites list for both users
        fetchInvites();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, subscribeToUserChanges, sendNotification]);

  const fetchInvites = async () => {
    try {
      const { data: inviteData, error } = await supabase
        .from('match_invites')
        .select('*')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Batch fetch all unique profile IDs
      const uniqueUserIds = Array.from(new Set(
        (inviteData || []).flatMap(invite => [invite.sender_id, invite.receiver_id])
      ));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', uniqueUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const invitesWithProfiles: MatchInvite[] = (inviteData || []).map(invite => ({
        ...invite,
        sender: profileMap.get(invite.sender_id),
        receiver: profileMap.get(invite.receiver_id),
      }));
      
      setInvites(invitesWithProfiles);
    } catch (error) {
      logger.error('Error fetching match invites', { error });
      toast.error('Failed to load match invites');
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async (inviteData: {
    receiver_id: string;
    availability_id?: string;
    date: string;
    start_time: string;
    end_time: string;
    court_location?: string;
    message?: string;
  }) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('match_invites')
        .insert({
          sender_id: user.id,
          ...inviteData,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchInvites();
      toast.success('Match invite sent successfully');
      return data;
    } catch (error) {
      logger.error('Error sending match invite', { error });
      toast.error('Failed to send match invite');
      throw error;
    }
  };

  const respondToInvite = async (inviteId: string, status: 'accepted' | 'declined') => {
    if (!user) {
      toast.error('You must be logged in to respond to invites');
      throw new Error('User not authenticated');
    }

    try {
      // First, verify the user is the receiver of this invite
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) {
        toast.error('Invite not found');
        throw new Error('Invite not found');
      }

      if (invite.receiver_id !== user.id) {
        toast.error('You are not authorized to respond to this invite');
        throw new Error('Unauthorized');
      }

      // Update the invite status
      const { data, error } = await supabase
        .from('match_invites')
        .update({ 
          status,
          response_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', inviteId)
        .eq('receiver_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Database error responding to invite', { error, inviteId, status });
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      // If accepted, create a conversation between the users
      if (status === 'accepted') {
        try {
          await createConversation(invite);
        } catch (convError) {
          logger.error('Error creating conversation', { error: convError, inviteId });
          // Don't fail the whole operation if conversation creation fails
        }
      }
      
      await fetchInvites();
      toast.success(`Match invite ${status}! ${status === 'accepted' ? 'The sender has been notified.' : ''}`);
    } catch (error: any) {
      logger.error('Error responding to match invite', { error, inviteId, status });
      const errorMessage = error?.message || `Failed to ${status} match invite`;
      toast.error(errorMessage);
      throw error;
    }
  };

  const proposeNewTime = async (
    inviteId: string,
    newDate: string,
    newStartTime: string,
    newEndTime: string
  ) => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      const { error } = await supabase
        .from('match_invites')
        .update({
          proposed_date: newDate,
          proposed_start_time: newStartTime,
          proposed_end_time: newEndTime,
          proposed_by_user_id: user.id,
          proposed_at: new Date().toISOString(),
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', inviteId);

      if (error) throw error;

      toast.success("New time proposed!");
      await fetchInvites();
    } catch (error) {
      logger.error('Error proposing new time', { error, inviteId });
      toast.error("Failed to propose new time");
    }
  };

  const acceptProposedTime = async (inviteId: string) => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      // Get the current invite to access proposed times
      const { data: invite, error: fetchError } = await supabase
        .from('match_invites')
        .select('*')
        .eq('id', inviteId)
        .single();

      if (fetchError) throw fetchError;
      if (!invite?.proposed_date) {
        toast.error("No proposed time found");
        return;
      }

      // Update with proposed time as the actual time and mark as accepted
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
          proposed_at: null,
          status: 'accepted',
          response_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', inviteId);

      if (error) throw error;

      toast.success("Proposed time accepted!");
      await fetchInvites();
    } catch (error) {
      logger.error('Error accepting proposed time', { error, inviteId });
      toast.error("Failed to accept proposed time");
    }
  };

  const getConfirmedInvites = () => {
    return invites.filter(invite => invite.status === 'accepted');
  };

  const isSlotBooked = (date: string, startTime: string, endTime: string, userId?: string) => {
    return invites.some(invite => {
      if (invite.status !== 'accepted') return false;
      if (userId && invite.sender_id !== userId && invite.receiver_id !== userId) return false;
      if (invite.date !== date) return false;
      
      return (
        (startTime >= invite.start_time && startTime < invite.end_time) ||
        (endTime > invite.start_time && endTime <= invite.end_time) ||
        (startTime <= invite.start_time && endTime >= invite.end_time)
      );
    });
  };

  const createConversation = async (invite: MatchInvite) => {
    try {
      // Send an initial message to create the conversation
      const senderName = `${invite.sender?.first_name} ${invite.sender?.last_name}`;
      const receiverName = `${invite.receiver?.first_name} ${invite.receiver?.last_name}`;
      
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id === invite.sender_id ? invite.sender_id : invite.receiver_id,
          receiver_id: user?.id === invite.sender_id ? invite.receiver_id : invite.sender_id,
          subject: 'Match Confirmed',
          content: `Great! Our match for ${invite.date} at ${invite.start_time} is confirmed. Looking forward to playing with you!`,
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Error creating conversation in hook', { error });
    }
  };

  const cancelInvite = async (inviteId: string, reason?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('match_invites')
        .update({ 
          status: 'cancelled',
          response_at: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || null,
          cancelled_by_user_id: user?.id
        })
        .eq('id', inviteId);

      if (error) throw error;
      
      await fetchInvites();
      toast.success('Match invite cancelled');
    } catch (error) {
      logger.error('Error cancelling match invite', { error, inviteId });
      toast.error('Failed to cancel match invite');
      throw error;
    }
  };

  const getPendingInvites = () => {
    return invites.filter(invite => 
      invite.status === 'pending' && invite.receiver_id === user?.id
    );
  };

  const getSentInvites = () => {
    return invites.filter(invite => 
      invite.sender_id === user?.id
    );
  };

  return {
    invites,
    loading,
    sendInvite,
    respondToInvite,
    proposeNewTime,
    acceptProposedTime,
    cancelInvite,
    getPendingInvites,
    getSentInvites,
    getConfirmedInvites,
    isSlotBooked,
    refetch: fetchInvites,
  };
};