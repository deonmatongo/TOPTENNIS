import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  sender?: {
    name: string;
    email: string;
    profile_picture_url?: string;
  };
  receiver?: {
    name: string;
    email: string;
    profile_picture_url?: string;
  };
}

export const useFriendRequests = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getRelationshipWith = (otherUserId?: string) => {
    if (!user || !otherUserId) return 'none' as const;

    const existing = requests.find(r =>
      (r.sender_id === user.id && r.receiver_id === otherUserId) ||
      (r.sender_id === otherUserId && r.receiver_id === user.id)
    );

    if (!existing) return 'none' as const;
    if (existing.status === 'accepted') return 'friends' as const;

    if (existing.status === 'pending') {
      if (existing.sender_id === user.id) return 'pending_sent' as const;
      return 'pending_received' as const;
    }

    return 'none' as const;
  };

  const fetchRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First get friend requests
      const { data: friendRequestsData, error: friendRequestsError } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (friendRequestsError) throw friendRequestsError;

      // Then get profile data for senders and receivers
      const userIds = new Set<string>();
      (friendRequestsData || []).forEach(req => {
        userIds.add(req.sender_id);
        userIds.add(req.receiver_id);
      });

      let profilesData: any[] = [];
      if (userIds.size > 0) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, profile_picture_url')
          .in('id', Array.from(userIds));

        // If profile enrichment fails (often due to RLS), still show requests.
        if (profilesError) {
          console.error('Error fetching profiles for friend requests:', profilesError);
        } else {
          profilesData = data || [];
        }
      }

      // Create a map of profiles for quick lookup
      const profilesMap = new Map();
      (profilesData || []).forEach(profile => profilesMap.set(profile.id, profile));

      const transformedRequests = (friendRequestsData || []).map((req: any) => {
        const senderProfile = profilesMap.get(req.sender_id);
        const receiverProfile = profilesMap.get(req.receiver_id);
        
        return {
          ...req,
          sender: senderProfile ? {
            name: `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim(),
            email: senderProfile.email,
            profile_picture_url: senderProfile.profile_picture_url
          } : undefined,
          receiver: receiverProfile ? {
            name: `${receiverProfile.first_name || ''} ${receiverProfile.last_name || ''}`.trim(), 
            email: receiverProfile.email,
            profile_picture_url: receiverProfile.profile_picture_url
          } : undefined
        };
      });

      setRequests(transformedRequests);
    } catch (err) {
      console.error('Error fetching friend requests:', err);
      setError('Failed to fetch friend requests');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId
        });

      if (error) throw error;

      // Fetch sender name for the notification message
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      const senderName = senderProfile
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim()
        : 'Someone';

      // Server-side idempotency check - prevent duplicate notifications
      const existingNotification = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', receiverId)
        .eq('type', 'friend_request')
        .eq('metadata->>sender_id', user.id)
        .single();
      
      if (!existingNotification) {
        await supabase.from('notifications').insert({
          user_id: receiverId,
          type: 'friend_request',
          title: 'New Friend Request',
          message: `${senderName} sent you a friend request`,
          read: false,
          action_url: '/dashboard?tab=friends',
          metadata: { sender_id: user.id },
        });
      } else {
        console.log('🔄 Skipping duplicate friend request notification for sender_id:', user.id);
      }

      await fetchRequests();
      return true;
    } catch (err) {
      console.error('Error sending friend request:', err);
      throw err;
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    if (!user) return;

    try {
      // Fetch the request first so we know who the sender is
      const request = requests.find(r => r.id === requestId);

      const { error, data: updated } = await supabase
        .from('friend_requests')
        .update({ status })
        .eq('id', requestId)
        .select();

      console.error('[updateRequestStatus] result:', { error, updated, requestId, status, userId: user.id });
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('No rows updated — check RLS policies on friend_requests');

      if (status === 'accepted' && request) {
        // Fetch receiver (current user) name
        const { data: receiverProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        const receiverName = receiverProfile
          ? `${receiverProfile.first_name || ''} ${receiverProfile.last_name || ''}`.trim()
          : 'Someone';

        // Server-side idempotency check - prevent duplicate acceptance notifications
        const existingAcceptNotification = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', request.sender_id)
          .eq('type', 'friend_request')
          .eq('title', 'Friend Request Accepted')
          .eq('metadata->>receiver_id', user.id)
          .eq('metadata->>request_id', requestId)
          .single();
        
        if (!existingAcceptNotification) {
          await supabase.from('notifications').insert({
            user_id: request.sender_id,
            type: 'friend_request',
            title: 'Friend Request Accepted',
            message: `${receiverName} accepted your friend request`,
            read: false,
            action_url: '/dashboard?tab=friends',
            metadata: { receiver_id: user.id, request_id: requestId },
          });
        } else {
          console.log('🔄 Skipping duplicate friend request acceptance notification for request_id:', requestId);
        }
      }

      await fetchRequests();
    } catch (err) {
      console.error('Error updating friend request:', err);
      throw err;
    }
  };

  const revokeFriendRequest = async (requestId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId)
        .eq('sender_id', user.id)
        .eq('status', 'pending');
      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error revoking friend request:', err);
      throw err;
    }
  };

  const getPendingRequestsCount = () => {
    if (!user) return 0;
    return requests.filter(req => req.receiver_id === user.id && req.status === 'pending').length;
  };

  useEffect(() => {
    fetchRequests();

    // Set up real-time subscription for friend requests
    if (user) {
      const channel = supabase
        .channel(`friend-requests-changes-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'friend_requests',
            filter: `sender_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time friend request update (sent):', payload);
            fetchRequests();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time friend request update (received):', payload);
            fetchRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    requests,
    loading,
    error,
    sendFriendRequest,
    updateRequestStatus,
    revokeFriendRequest,
    getPendingRequestsCount,
    getRelationshipWith,
    refetch: fetchRequests
  };
};