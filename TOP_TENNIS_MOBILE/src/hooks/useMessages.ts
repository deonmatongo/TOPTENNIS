import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { captureError } from '@/services/sentry';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  subject?: string;
  read: boolean;
  created_at: string;
  sender?: { first_name: string; last_name: string; profile_picture_url?: string };
  receiver?: { first_name: string; last_name: string; profile_picture_url?: string };
}

export interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserPicture?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export const useMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = new Set<string>();
      (data || []).forEach(m => { userIds.add(m.sender_id); userIds.add(m.receiver_id); });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, profile_picture_url')
        .in('id', Array.from(userIds));

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: Message[] = (data || []).map(m => ({
        ...m,
        sender: profileMap.get(m.sender_id),
        receiver: profileMap.get(m.receiver_id),
      }));

      setMessages(enriched);
    } catch (e) {
      captureError(e);
      if (__DEV__) console.error('Error fetching messages:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const sendMessage = useCallback(async (receiverId: string, content: string, subject?: string) => {
    if (!user) return;
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      subject,
      read: false,
    });
    if (error) throw error;
    await fetchMessages();
  }, [user, fetchMessages]);

  const markAsRead = useCallback(async (senderId: string) => {
    if (!user) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', user.id)
      .eq('read', false);
    await fetchMessages();
  }, [user, fetchMessages]);

  const conversations: Conversation[] = (() => {
    if (!user) return [];
    const map = new Map<string, Conversation>();
    messages.forEach(m => {
      const isIncoming = m.receiver_id === user.id;
      const otherId = isIncoming ? m.sender_id : m.receiver_id;
      const otherProfile = isIncoming ? m.sender : m.receiver;
      const otherName = otherProfile
        ? `${otherProfile.first_name} ${otherProfile.last_name}`.trim()
        : 'Unknown';

      const otherPicture = (otherProfile as any)?.profile_picture_url;
      if (!map.has(otherId)) {
        map.set(otherId, {
          otherUserId: otherId,
          otherUserName: otherName,
          otherUserPicture: otherPicture,
          lastMessage: m.content,
          lastMessageTime: m.created_at,
          unreadCount: isIncoming && !m.read ? 1 : 0,
        });
      } else {
        const conv = map.get(otherId)!;
        if (isIncoming && !m.read) conv.unreadCount++;
      }
    });
    return Array.from(map.values());
  })();

  const getThread = useCallback((otherUserId: string): Message[] => {
    return messages
      .filter(m =>
        (m.sender_id === user?.id && m.receiver_id === otherUserId) ||
        (m.sender_id === otherUserId && m.receiver_id === user?.id)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, user]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  return { messages, conversations, loading, sendMessage, markAsRead, getThread, refetch: fetchMessages };
};
