import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject?: string;
  content: string;
  read: boolean;
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

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchMessages = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First, fetch all messages for the user
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        return;
      }

      // Get unique user IDs from messages
      const userIds = new Set<string>();
      messagesData.forEach(msg => {
        userIds.add(msg.sender_id);
        userIds.add(msg.receiver_id);
      });

      // Fetch profiles for all users involved
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Create a map for quick profile lookup
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.id, {
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          email: profile.email,
          profile_picture_url: profile.profile_picture_url
        });
      });

      // Transform messages with profile data
      const transformedMessages = messagesData.map(msg => ({
        ...msg,
        sender: profilesMap.get(msg.sender_id),
        receiver: profilesMap.get(msg.receiver_id)
      }));

      setMessages(transformedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (receiverId: string, subject: string, content: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          subject: subject.trim() || null,
          content: content.trim()
        });

      if (error) throw error;
      
      // Refresh messages after sending
      await fetchMessages();
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId)
        .eq('receiver_id', user.id);

      if (error) throw error;
      
      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const getUnreadCount = () => {
    if (!user) return 0;
    return messages.filter(msg => msg.receiver_id === user.id && !msg.read).length;
  };

  useEffect(() => {
    fetchMessages();

    // Set up real-time subscription for messages
    if (user) {
      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time message update (sent):', payload);
            fetchMessages();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time message update (received):', payload);
            
            // Show toast notification for new incoming messages
            if (payload.eventType === 'INSERT') {
              toast.info('New message received', {
                description: 'You have a new message in your inbox',
                action: {
                  label: 'View',
                  onClick: () => window.location.href = '/dashboard?tab=messages'
                }
              });
            }
            
            fetchMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    getUnreadCount,
    refetch: fetchMessages
  };
};