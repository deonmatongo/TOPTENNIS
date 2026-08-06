import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';
import { useRealtimeConnection } from '@/contexts/RealtimeConnectionContext';
import { subscribeWithRetry } from '@/utils/realtimeRetry';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender?: { id: string; name: string; skill_level?: number; usta_rating?: string; profile_picture_url?: string };
  receiver?: { id: string; name: string; skill_level?: number; usta_rating?: string; profile_picture_url?: string };
}

export function useFriendRequests() {
  const { user } = useAuth();
  const { connectionGeneration } = useRealtimeConnection();
  const friendTopic = useUniqueChannel('friend-requests');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    // friend_requests has no FK relationships, so embedded selects fail —
    // fetch the requests plain and join players/profiles client-side.
    const { data } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const rows = data || [];
    const userIds = Array.from(new Set(rows.flatMap(r => [r.sender_id, r.receiver_id])));

    let userMap = new Map<string, FriendRequest['sender']>();
    if (userIds.length > 0) {
      const [{ data: players }, { data: profiles }] = await Promise.all([
        supabase.from('players').select('user_id, name, skill_level, usta_rating').in('user_id', userIds),
        supabase.from('profiles').select('id, first_name, last_name, profile_picture_url').in('id', userIds),
      ]);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      userMap = new Map(userIds.map(id => {
        const player = (players || []).find(p => p.user_id === id);
        const profile = profileMap.get(id);
        return [id, {
          id,
          name: player?.name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Player',
          skill_level: player?.skill_level ?? undefined,
          usta_rating: player?.usta_rating ?? undefined,
          profile_picture_url: profile?.profile_picture_url ?? undefined,
        }];
      }));
    }

    setRequests(rows.map(r => ({
      ...r,
      sender: userMap.get(r.sender_id),
      receiver: userMap.get(r.receiver_id),
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchRequests();

    // Bug fix: useFriendRequests had no realtime subscription — incoming friend
    // requests were invisible until re-mount. Two listeners (one per FK column)
    // cover both sender and receiver roles.
    const cleanupChannel = subscribeWithRetry(() =>
      supabase
        .channel(friendTopic)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${user.id}`,
        }, (payload: any) => {
          if (__DEV__) console.log('[friends] request event (sender)', payload);
          fetchRequests();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`,
        }, (payload: any) => {
          if (__DEV__) console.log('[friends] request event (receiver)', payload);
          fetchRequests();
        }),
      'friends',
    );

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (__DEV__) console.log('[friends] app foregrounded — refetching');
        fetchRequests();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      cleanupChannel();
      appStateSub.remove();
    };
  }, [user?.id, connectionGeneration]);

  const sendFriendRequest = async (receiverId: string) => {
    const { error } = await supabase.from('friend_requests').insert({ sender_id: user!.id, receiver_id: receiverId, status: 'pending' });
    if (error) throw error;
    await fetchRequests();
  };

  const updateRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', requestId)
      .select();
    if (error) throw error;
    await fetchRequests();
  };

  const cancelRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId)
      .eq('sender_id', user!.id);
    if (error) throw error;
    await fetchRequests();
  };

  const getPendingRequestsCount = () => requests.filter(r => r.receiver_id === user?.id && r.status === 'pending').length;
  const pendingReceived = requests.filter(r => r.receiver_id === user?.id && r.status === 'pending');
  const pendingSent = requests.filter(r => r.sender_id === user?.id && r.status === 'pending');
  const friends = requests.filter(r => r.status === 'accepted');

  return { requests, loading, pendingReceived, pendingSent, friends, sendFriendRequest, updateRequestStatus, cancelRequest, getPendingRequestsCount, refetch: fetchRequests };
}
