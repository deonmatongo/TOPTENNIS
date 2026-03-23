import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export interface PlayerProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  skill_level?: number;
  wins?: number;
  losses?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  phone?: string;
  gender?: string;
  networking_enabled?: boolean;
  profile_picture_url?: string;
  [key: string]: any;
} 

type MatchInvite = Tables<'match_invites'> & {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  proposed_date?: string;
  proposed_start_time?: string;
  proposed_end_time?: string;
  court_location?: string;
  message?: string;
  home_away_indicator?: string;
  sender?: PlayerProfile & Partial<Tables<'players'>>;
  receiver?: PlayerProfile & Partial<Tables<'players'>>;
  proposed_by?: PlayerProfile & Partial<Tables<'players'>>;
};

export const useMatchInvites = () => {
  const { user } = useAuth();
  const { subscribeToUserChanges } = useRealtime();
  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Deduplication set: tracks invite IDs for which a toast has already fired
  const notifiedIds = useRef<Set<string>>(new Set());
  // Track if we're in an error state to prevent automatic retries
  const hasErrorRef = useRef(false);

  // Use refs to prevent dependency changes from triggering re-renders
  const subscribeToUserChangesRef = useRef(subscribeToUserChanges);

  // Update refs when functions change
  useEffect(() => {
    subscribeToUserChangesRef.current = subscribeToUserChanges;
  }, [subscribeToUserChanges]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Add a small delay to ensure auth is fully resolved
    const authTimeout = setTimeout(() => {
      // Only fetch if not already in error state
      if (!hasErrorRef.current) {
        fetchInvites();
      } else {
        setLoading(false);
      }
    }, 100);

    // Set up real-time subscription using context
    const unsubscribe = subscribeToUserChangesRef.current(async (payload) => {
      if (payload.table === 'match_invites') {
        logger.debug('Real-time invite update', { payload });
        
        // Handle new invite notifications (INSERT)
        if (payload.eventType === 'INSERT') {
          const newInvite = payload.new as any;
          
          // Toast is handled by useNotifications via the notifications table row.
          // We only deduplicate to avoid double-fetching.
          if (newInvite.receiver_id === user.id && !notifiedIds.current.has(`insert:${newInvite.id}`)) {
            notifiedIds.current.add(`insert:${newInvite.id}`);
          }
        }
        
        // Handle invite status changes (UPDATE)
        if (payload.eventType === 'UPDATE') {
          const oldInvite = payload.old as any;
          const updatedInvite = payload.new as any;
          
          // Check if status changed
          const dedupeKey = `update:${updatedInvite.id}:${updatedInvite.status}`;
          if (oldInvite.status !== updatedInvite.status && !notifiedIds.current.has(dedupeKey)) {
            notifiedIds.current.add(dedupeKey);
            // Fetch the other party's profile for the notification message
            const otherUserId = updatedInvite.receiver_id === user.id
              ? updatedInvite.sender_id
              : updatedInvite.receiver_id;

            try {
              const { data: otherProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', otherUserId)
                .single();

              const otherName = otherProfile
                ? `${otherProfile.first_name} ${otherProfile.last_name}`.trim()
                : 'Opponent';

              if (updatedInvite.status === 'accepted' && updatedInvite.receiver_id === user.id) {
                toast.success(`${otherName} accepted your match invite`, { duration: 5000 });
              } else if (updatedInvite.status === 'declined' && updatedInvite.receiver_id === user.id) {
                toast.info(`${otherName} declined your match invite`, { duration: 5000 });
              } else if (updatedInvite.status === 'cancelled') {
                toast.info(`${otherName} cancelled the match`, { duration: 5000 });
              }
            } catch (error) {
              logger.warn('Failed to fetch other user profile for notification', { error });
            }
          }
        }
        
        // Refresh on insert or meaningful status change
        if (payload.eventType === 'INSERT' ||
            (payload.eventType === 'UPDATE' &&
             payload.old?.status !== payload.new?.status)) {
          // Debounce to prevent rapid successive calls
          setTimeout(() => fetchInvites(), 500);
        }
      }
    });

    return () => {
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, [user?.id]); // Only depend on user ID, not on functions that might change

  // Network connectivity listeners with debouncing
  useEffect(() => {
    let onlineTimeout: NodeJS.Timeout | null = null;
    
    const handleOnline = () => {
      console.log('Network restored - refreshing match invites');
      if (user?.id && !onlineTimeout) {
        // Debounce online refresh to prevent multiple calls
        onlineTimeout = setTimeout(() => {
          if (!hasErrorRef.current) {
            fetchInvites();
          }
          onlineTimeout = null;
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.log('Network lost - match invites may be outdated');
      toast.warning('You are offline. Match invites may not be up to date.');
      // Clear any pending online refresh
      if (onlineTimeout) {
        clearTimeout(onlineTimeout);
        onlineTimeout = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (onlineTimeout) {
        clearTimeout(onlineTimeout);
      }
    };
  }, [user?.id]);

  // Network connectivity check
  const isOnline = () => navigator.onLine;
  
  // Retry state
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  
  const fetchInvites = async (isRetry = false) => {
    // Authentication guard - ensure user is authenticated
    if (!user?.id) {
      console.warn('Cannot fetch match invites: User not authenticated');
      setLoading(false);
      return;
    }

    // Network connectivity check
    if (!isOnline()) {
      console.warn('Cannot fetch match invites: Network offline');
      toast.error('You are offline. Please check your connection.');
      setLoading(false);
      return;
    }

    // Reset error gate at the start of every fresh fetch so that a single
    // past error never permanently disables real-time live updates.
    hasErrorRef.current = false;
    
    try {
      logger.info('Fetching match invites for user:', { userId: user.id });
      
      const { data: inviteData, error } = await supabase
        .from('match_invites')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        // Handle specific error types
        if (error.code === 'PGRST116') {
          throw new Error('Match invites not found or access denied');
        } else if (error.code === '42501') {
          throw new Error('Permission denied: Cannot access match invites');
        } else if (error.message?.includes('JWT')) {
          throw new Error('Authentication expired. Please log in again.');
        } else {
          throw error;
        }
      }

      logger.info(`Fetched ${inviteData?.length || 0} match invites`, { count: inviteData?.length });

      // Batch fetch all unique profile IDs
      const uniqueUserIds = Array.from(new Set(
        (inviteData || []).flatMap(invite => [invite.sender_id, invite.receiver_id])
      ));

      // Skip profile fetch if no users to fetch
      if (uniqueUserIds.length === 0) {
        setInvites([]);
        return;
      }

      // Fetch both profiles and player data with error handling
      const [{ data: profiles, error: profilesError }, { data: players, error: playersError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', uniqueUserIds),
        supabase
          .from('players')
          .select('*')
          .in('user_id', uniqueUserIds)
      ]);

      // Handle profile/players fetch errors gracefully
      if (profilesError) {
        logger.warn('Failed to fetch profiles for match invites:', { error: profilesError.message });
      }
      if (playersError) {
        logger.warn('Failed to fetch players for match invites:', { error: playersError.message });
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const playerMap = new Map(players?.map(p => [p.user_id, p]) || []);

      const invitesWithProfiles: MatchInvite[] = (inviteData || []).map(invite => {
        const senderProfile = profileMap.get(invite.sender_id);
        const receiverProfile = profileMap.get(invite.receiver_id);
        const senderPlayer = playerMap.get(invite.sender_id);
        const receiverPlayer = playerMap.get(invite.receiver_id);

        return {
          ...invite,
          sender: senderProfile ? {
            user_id: invite.sender_id,
            ...senderProfile,
            ...(senderPlayer || {}),
          } as any : undefined,
          receiver: receiverProfile ? {
            user_id: invite.receiver_id,
            ...receiverProfile,
            ...(receiverPlayer || {}),
          } as any : undefined,
        };
      });
      
      setInvites(invitesWithProfiles);
      logger.info('Successfully loaded match invites with profiles', { count: invitesWithProfiles.length });
      
      // Reset retry count on success
      retryCountRef.current = 0;
      
    } catch (error) {
      logger.error('Error fetching match invites', { error: error.message, userId: user?.id, retryCount: retryCountRef.current });
      
      // Set error state to prevent automatic retries
      hasErrorRef.current = true;
      
      // Handle retry logic - only retry if not already in error state and not manual retry
      if (retryCountRef.current < maxRetries && !isRetry && !hasErrorRef.current) {
        retryCountRef.current++;
        logger.info(`Retrying match invites fetch (attempt ${retryCountRef.current}/${maxRetries})`, { attempt: retryCountRef.current, maxRetries });
        
        setTimeout(() => {
          fetchInvites(true);
        }, retryDelay * Math.pow(2, retryCountRef.current - 1)); // Exponential backoff
        
        return;
      }
      
      // Show appropriate error message based on error type
      let errorMessage = 'Failed to load match invites';
      
      if (error instanceof Error) {
        if (error.message.includes('offline') || error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('Permission denied')) {
          errorMessage = 'Permission denied. You may not have access to match invites.';
        } else if (error.message.includes('Authentication')) {
          errorMessage = 'Authentication expired. Please log in again.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'No match invites found.';
        }
      }
      
      // Set error state for UI components to use
      setError(errorMessage);
      
      toast.error(errorMessage, {
        action: {
          label: 'Retry',
          onClick: () => {
            // Reset error state and retry count on manual retry
            hasErrorRef.current = false;
            retryCountRef.current = 0;
            setError(null);
            fetchInvites();
          },
        },
        duration: 5000,
      });
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

    // Optimistic update - add to UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticInvite = {
      id: tempId,
      sender_id: user.id,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      response_at: null,
      sender: null,
      receiver: null,
      ...inviteData,
    };

    setInvites(prev => [...prev, optimisticInvite as any]);

    try {
      const { data, error } = await supabase
        .from('match_invites')
        .insert({
          sender_id: user.id,
          ...inviteData,
        })
        .select()
        .single();

      if (error) {
        // Rollback optimistic update on error
        setInvites(prev => prev.filter(item => item.id !== tempId));
        throw error;
      }
      
      // Replace optimistic data with real data from server
      await fetchInvites();

      // Notify the receiver
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      const senderName = senderProfile
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim()
        : 'Someone';
      
      // Idempotent insert — DB unique index prevents duplicates.
      await supabase.rpc('insert_notification_safe' as any, {
        p_user_id:    inviteData.receiver_id,
        p_type:       'match_invite',
        p_title:      'New Match Invitation',
        p_message:    `${senderName} invited you to a match on ${inviteData.date} at ${inviteData.start_time}`,
        p_action_url: '/dashboard?tab=schedule',
        p_metadata:   { match_id: data?.id, sender_id: user.id },
      });

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

    // OPTIMISTIC UPDATE: Update UI immediately for instant feedback
    const previousInvites = [...invites];

    // Helper: check if two invites overlap the same slot on the same date
    const overlapsAccepted = (inv: typeof invite) => {
      if (inv.id === inviteId) return false;
      if (inv.status !== 'pending') return false;
      if (inv.date !== invite.date) return false;
      // Must involve the current user (as sender or receiver) so only their own slots lock
      if (inv.sender_id !== user.id && inv.receiver_id !== user.id) return false;
      const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const invStart = toMin(inv.start_time); const invEnd = toMin(inv.end_time);
      const accStart = toMin(invite.start_time); const accEnd = toMin(invite.end_time);
      return invStart < accEnd && invEnd > accStart;
    };

    const conflictingIds = status === 'accepted'
      ? invites.filter(overlapsAccepted).map(inv => inv.id)
      : [];

    const optimisticInvites = invites.map(inv => {
      if (inv.id === inviteId) {
        return { ...inv, status, response_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      }
      if (conflictingIds.includes(inv.id)) {
        return { ...inv, status: 'declined' as const, response_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      }
      return inv;
    });
    setInvites(optimisticInvites);
    
    // Show success message immediately
    toast.success(`Match invite ${status}! ${status === 'accepted' ? 'The sender has been notified.' : ''}`);

    try {
      // ATOMIC TRANSACTION: Accept invite and lock slot simultaneously
      if (status === 'accepted') {
        // Use RPC function for atomic slot locking
        const { data: acceptResult, error: acceptError } = await (supabase.rpc as any)('accept_invite_and_lock_slot', {
          p_invite_id: inviteId,
          p_user_id: user.id,
          p_conflicting_invite_ids: conflictingIds
        });

        if (acceptError) {
          logger.error('Atomic slot locking failed', { error: acceptError, inviteId });
          // Rollback optimistic update on error
          setInvites(previousInvites);
          
          if (acceptError.message?.includes('already booked')) {
            toast.error('This time slot is no longer available. Please select a different time.');
          } else if (acceptError.message?.includes('concurrent update')) {
            toast.error('Another booking occurred simultaneously. Please try again.');
          } else {
            toast.error('Failed to accept match invite. Please try again.');
          }
          throw acceptError;
        }

        if (!acceptResult) {
          // Rollback on no data
          setInvites(previousInvites);
          toast.error('Failed to accept match invite');
          throw new Error('No data returned from slot locking');
        }

        logger.info('Successfully accepted invite and locked slot', { inviteId, result: acceptResult });
      } else {
        // For declined invites, just update the status
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
          logger.error('Database error declining invite', { error, inviteId, status });
          // Rollback optimistic update on error
          setInvites(previousInvites);
          toast.error(`Failed to ${status} match invite`);
          throw error;
        }

        if (!data) {
          // Rollback on no data
          setInvites(previousInvites);
          toast.error(`Failed to ${status} match invite`);
          throw new Error('No data returned from update');
        }
      }

      // Notify the other party of the response (idempotent — unique index guards duplicates).
      const otherUserId = invite.sender_id === user.id ? invite.receiver_id : invite.sender_id;
      const { data: responderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      const responderName = responderProfile
        ? `${responderProfile.first_name || ''} ${responderProfile.last_name || ''}`.trim()
        : 'Someone';
      await supabase.rpc('insert_notification_safe' as any, {
        p_user_id:    otherUserId,
        p_type:       status === 'accepted' ? 'match_accepted' : 'match_declined',
        p_title:      status === 'accepted' ? 'Match Invitation Accepted' : 'Match Invitation Declined',
        p_message:    status === 'accepted'
          ? `${responderName} accepted your match invitation`
          : `${responderName} declined your match invitation`,
        p_action_url: '/dashboard?tab=schedule',
        p_metadata:   { match_id: inviteId },
      });

      // If accepted, create a conversation between the users (in background)
      if (status === 'accepted') {
        createConversation(invite).catch(convError => {
          logger.error('Error creating conversation', { error: convError, inviteId });
        });

        // Persist conflicting invite declines to DB in background (double-booking prevention)
        if (conflictingIds.length > 0) {
          supabase
            .from('match_invites')
            .update({ status: 'declined', response_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .in('id', conflictingIds)
            .then(({ error }) => {
              if (error) logger.error('Error auto-declining conflicting invites', { error, conflictingIds });
            });
        }
      }
      
      // Refresh invites in background to get latest data
      fetchInvites().catch(err => {
        logger.error('Error refreshing invites after response', { error: err });
      });
    } catch (error: any) {
      logger.error('Error responding to match invite', { error, inviteId, status });
      // Error toast already shown above during rollback
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

      // Notify the other party of the proposed reschedule
      const invite = invites.find(i => i.id === inviteId);
      if (invite) {
        const otherUserId = invite.sender_id === user.id ? invite.receiver_id : invite.sender_id;
        const { data: proposerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        const proposerName = proposerProfile
          ? `${proposerProfile.first_name || ''} ${proposerProfile.last_name || ''}`.trim()
          : 'Someone';
        await supabase.rpc('insert_notification_safe' as any, {
          p_user_id:    otherUserId,
          p_type:       'match_rescheduled',
          p_title:      'New Time Proposed',
          p_message:    `${proposerName} proposed a new time for your match: ${newDate} at ${newStartTime}`,
          p_action_url: '/dashboard?tab=schedule',
          p_metadata:   { match_id: inviteId },
        });
      }
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

      // Notify the proposer that their new time was accepted
      const inv = invites.find(i => i.id === inviteId);
      if (inv) {
        const otherUserId = inv.sender_id === user.id ? inv.receiver_id : inv.sender_id;
        const { data: acceptorProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        const acceptorName = acceptorProfile
          ? `${acceptorProfile.first_name || ''} ${acceptorProfile.last_name || ''}`.trim()
          : 'Someone';
        await supabase.rpc('insert_notification_safe' as any, {
          p_user_id:    otherUserId,
          p_type:       'match_accepted',
          p_title:      'Proposed Time Accepted',
          p_message:    `${acceptorName} accepted your proposed match time`,
          p_action_url: '/dashboard?tab=schedule',
          p_metadata:   { match_id: inviteId },
        });
      }
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

      // Notify the other party of the cancellation
      const invite = invites.find(i => i.id === inviteId);
      if (invite && user) {
        const otherUserId = invite.sender_id === user.id ? invite.receiver_id : invite.sender_id;
        const { data: cancellerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        const cancellerName = cancellerProfile
          ? `${cancellerProfile.first_name || ''} ${cancellerProfile.last_name || ''}`.trim()
          : 'Someone';
        await supabase.rpc('insert_notification_safe' as any, {
          p_user_id:    otherUserId,
          p_type:       'match_cancelled',
          p_title:      'Match Cancelled',
          p_message:    `${cancellerName} cancelled the match`,
          p_action_url: '/dashboard?tab=schedule',
          p_metadata:   { match_id: inviteId },
        });
      }

      await fetchInvites();
      toast.success('Match invite cancelled');
    } catch (error) {
      logger.error('Error cancelling match invite', { error, inviteId });
      toast.error('Failed to cancel match invite');
      throw error;
    }
  };

  const deleteInvite = async (inviteId: string) => {
    if (!user) {
      toast.error('You must be logged in to delete invites');
      throw new Error('User not authenticated');
    }

    try {
      // Verify the user is either sender or receiver
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) {
        toast.error('Invite not found');
        throw new Error('Invite not found');
      }

      if (invite.sender_id !== user.id && invite.receiver_id !== user.id) {
        toast.error('You are not authorized to delete this invite');
        throw new Error('Unauthorized');
      }

      // Delete the invite from database
      const { error } = await supabase
        .from('match_invites')
        .delete()
        .eq('id', inviteId)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (error) {
        logger.error('Database error deleting invite', { error, inviteId });
        throw error;
      }

      await fetchInvites();
      toast.success('Invite deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting match invite', { error, inviteId });
      const errorMessage = error?.message || 'Failed to delete invite';
      toast.error(errorMessage);
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

  const getOldInvites = () => {
    const now = new Date();
    return invites.filter(invite => {
      const inviteDate = new Date(invite.date);
      // Consider invites older than today as "old"
      return inviteDate < now && (invite.status === 'pending' || invite.status === 'declined');
    });
  };

  return {
    invites,
    loading,
    error,
    sendInvite,
    respondToInvite,
    proposeNewTime,
    acceptProposedTime,
    cancelInvite,
    deleteInvite,
    getPendingInvites,
    getSentInvites,
    getConfirmedInvites,
    getOldInvites,
    isSlotBooked,
    refetch: fetchInvites,
  };
};