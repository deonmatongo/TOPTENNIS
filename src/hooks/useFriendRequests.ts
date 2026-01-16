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

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Create a map of profiles for quick lookup
      const profilesMap = new Map();
      (profilesData || []).forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

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
      const { error } = await supabase
        .from('friend_requests')
        .update({ status })
        .eq('id', requestId)
        .eq('receiver_id', user.id);

      if (error) throw error;
      
      await fetchRequests();
    } catch (err) {
      console.error('Error updating friend request:', err);
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
        .channel('friend-requests-changes')
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
    getPendingRequestsCount,
    refetch: fetchRequests
  };
};