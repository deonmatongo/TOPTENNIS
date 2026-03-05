import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ConversationMember {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at?: string | null;
  profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    profile_picture_url?: string | null;
  };
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    profile_picture_url?: string | null;
  };
}

export interface Conversation {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  messages: ConversationMessage[];
  lastMessage?: ConversationMessage;
  unreadCount: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const db = supabase as any;
    try {
      // Fetch conversations the user is a member of
      const { data: memberRows, error: memberErr } = await db
        .from('conversation_members')
        .select('conversation_id, role, joined_at, last_read_at')
        .eq('user_id', user.id);

      if (memberErr) throw memberErr;
      if (!memberRows || memberRows.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convIds = memberRows.map((r: any) => r.conversation_id);

      // Fetch conversation rows
      const { data: convRows, error: convErr } = await db
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (convErr) throw convErr;

      // Fetch all members for these conversations
      const { data: allMembers, error: memErr } = await db
        .from('conversation_members')
        .select('conversation_id, user_id, role, joined_at, last_read_at')
        .in('conversation_id', convIds);

      if (memErr) throw memErr;

      // Collect all unique user IDs to batch-fetch profiles
      const userIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', userIds as string[]);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Fetch messages for these conversations
      const { data: allMessages, error: msgErr } = await db
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      // Fetch sender profiles for messages
      const senderIds = Array.from(new Set((allMessages || []).map((m: any) => m.sender_id)));
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', senderIds as string[]);
      const senderMap = new Map((senderProfiles || []).map(p => [p.id, p]));

      // Build conversation objects
      const built: Conversation[] = (convRows || []).map((conv: any) => {
        const myMembership = memberRows.find((r: any) => r.conversation_id === conv.id);
        const lastReadAt = myMembership?.last_read_at ? new Date(myMembership.last_read_at) : new Date(0);

        const convMessages: ConversationMessage[] = (allMessages || [])
          .filter((m: any) => m.conversation_id === conv.id)
          .map((m: any) => ({
            ...m,
            sender: senderMap.get(m.sender_id),
          }));

        const convMembers: ConversationMember[] = (allMembers || [])
          .filter((m: any) => m.conversation_id === conv.id)
          .map((m: any) => ({
            ...m,
            profile: profileMap.get(m.user_id),
          }));

        const unreadCount = convMessages.filter(
          m => m.sender_id !== user.id && new Date(m.created_at) > lastReadAt
        ).length;

        return {
          ...conv,
          members: convMembers,
          messages: convMessages,
          lastMessage: convMessages[convMessages.length - 1],
          unreadCount,
        };
      });

      setConversations(built);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Send a message in a conversation
  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!user || !content.trim()) return;
    const { error } = await (supabase as any).from('conversation_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    });
    if (error) throw error;
  }, [user]);

  // Get or create a 1-to-1 DM conversation with another user
  const getOrCreateDM = useCallback(async (otherUserId: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await (supabase as any).rpc('get_or_create_dm', {
      p_other_user_id: otherUserId,
    });
    if (error) throw error;
    await fetchConversations();
    return data as string;
  }, [user, fetchConversations]);

  // Create a group chat via SECURITY DEFINER RPC to avoid RLS circular dependency
  const createGroupChat = useCallback(async (name: string, memberUserIds: string[]): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase as any).rpc('create_group_chat', {
      p_name: name,
      p_member_ids: memberUserIds,
    });

    if (error) throw error;

    await fetchConversations();
    return data as string;
  }, [user, fetchConversations]);

  // Add a member to a group
  const addMember = useCallback(async (conversationId: string, userId: string) => {
    const { error } = await (supabase as any).from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'member',
    });
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  // Remove a member from a group
  const removeMember = useCallback(async (conversationId: string, userId: string) => {
    const { error } = await (supabase as any)
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  // Update group name / avatar
  const updateGroup = useCallback(async (conversationId: string, updates: { name?: string; avatar_url?: string }) => {
    const { error } = await (supabase as any)
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  // Mark all messages in a conversation as read (update last_read_at)
  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (error) console.error('Error marking conversation read:', error);
    // Optimistic local update
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
    );
  }, [user]);

  const getTotalUnread = useCallback(() => {
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }, [conversations]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchConversations();

    // Real-time: listen for new messages
    const msgChannel = supabase
      .channel('conv-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
      }, () => fetchConversations())
      .subscribe();

    // Real-time: listen for membership changes (add/remove)
    const memChannel = supabase
      .channel('conv-members-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_members',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchConversations())
      .subscribe();

    // Real-time: conversation updates (name/avatar changes)
    const convChannel = supabase
      .channel('conv-updates-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      }, () => fetchConversations())
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(memChannel);
      supabase.removeChannel(convChannel);
    };
  }, [user, fetchConversations]);

  return {
    conversations,
    loading,
    sendMessage,
    getOrCreateDM,
    createGroupChat,
    addMember,
    removeMember,
    updateGroup,
    markConversationRead,
    getTotalUnread,
    refetch: fetchConversations,
  };
};
