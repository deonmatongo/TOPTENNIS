import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('friend_requests')
      .select(`*, sender:players!friend_requests_sender_id_fkey(id,name,skill_level,usta_rating,profile_picture_url), receiver:players!friend_requests_receiver_id_fkey(id,name,skill_level,usta_rating,profile_picture_url)`)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [user?.id]);

  const sendFriendRequest = async (receiverId: string) => {
    const { error } = await supabase.from('friend_requests').insert({ sender_id: user!.id, receiver_id: receiverId, status: 'pending' });
    if (error) throw error;
    await fetchRequests();
  };

  const updateRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase.from('friend_requests').update({ status }).eq('id', requestId);
    if (error) throw error;
    await fetchRequests();
  };

  const getPendingRequestsCount = () => requests.filter(r => r.receiver_id === user?.id && r.status === 'pending').length;
  const pendingReceived = requests.filter(r => r.receiver_id === user?.id && r.status === 'pending');
  const pendingSent = requests.filter(r => r.sender_id === user?.id && r.status === 'pending');
  const friends = requests.filter(r => r.status === 'accepted');

  return { requests, loading, pendingReceived, pendingSent, friends, sendFriendRequest, updateRequestStatus, getPendingRequestsCount, refetch: fetchRequests };
}
