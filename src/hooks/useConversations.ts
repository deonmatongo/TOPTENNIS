import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ConversationMember {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at?: string | null;
  is_pinned?: boolean;
  profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    profile_picture_url?: string | null;
  };
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  userIds: string[];
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  is_system?: boolean;
  reply_to_id?: string | null;
  sender?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    profile_picture_url?: string | null;
  };
  reactions?: MessageReaction[];
  replyTo?: Pick<ConversationMessage, 'id' | 'content' | 'sender_id' | 'sender'>;
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
  isPinned?: boolean;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const db = supabase as any;
    try {
      const { data: memberRows, error: memberErr } = await db
        .from('conversation_members')
        .select('conversation_id, role, joined_at, last_read_at, is_pinned')
        .eq('user_id', user.id);

      if (memberErr) throw memberErr;
      if (!memberRows || memberRows.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convIds = memberRows.map((r: any) => r.conversation_id);

      const { data: convRows, error: convErr } = await db
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (convErr) throw convErr;

      const { data: allMembers, error: memErr } = await db
        .from('conversation_members')
        .select('conversation_id, user_id, role, joined_at, last_read_at, is_pinned')
        .in('conversation_id', convIds);

      if (memErr) throw memErr;

      const userIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', userIds as string[]);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Fetch messages (exclude hard-deleted, include soft-deleted for rendering)
      const { data: allMessages, error: msgErr } = await db
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      const senderIds = Array.from(new Set((allMessages || []).map((m: any) => m.sender_id)));
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', senderIds as string[]);
      const senderMap = new Map((senderProfiles || []).map(p => [p.id, p]));

      // Fetch all reactions for these conversations' messages
      const msgIds = (allMessages || []).map((m: any) => m.id);
      let reactionsMap = new Map<string, MessageReaction[]>();
      if (msgIds.length > 0) {
        const { data: allReactions } = await db
          .from('message_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', msgIds);

        (allReactions || []).forEach((r: any) => {
          const list = reactionsMap.get(r.message_id) || [];
          const existing = list.find(x => x.emoji === r.emoji);
          if (existing) {
            existing.count++;
            existing.userIds.push(r.user_id);
            if (r.user_id === user.id) existing.reactedByMe = true;
          } else {
            list.push({ emoji: r.emoji, count: 1, reactedByMe: r.user_id === user.id, userIds: [r.user_id] });
          }
          reactionsMap.set(r.message_id, list);
        });
      }

      // Build message map for reply_to lookups
      const msgMap = new Map((allMessages || []).map((m: any) => [m.id, m]));

      const built: Conversation[] = (convRows || []).map((conv: any) => {
        const myMembership = memberRows.find((r: any) => r.conversation_id === conv.id);
        const lastReadAt = myMembership?.last_read_at ? new Date(myMembership.last_read_at) : new Date(0);

        const convMessages: ConversationMessage[] = (allMessages || [])
          .filter((m: any) => m.conversation_id === conv.id)
          .map((m: any) => {
            const replyToRaw = m.reply_to_id ? (msgMap.get(m.reply_to_id) as any) : null;
            return {
              ...m,
              sender: senderMap.get(m.sender_id),
              reactions: reactionsMap.get(m.id) || [],
              replyTo: replyToRaw ? {
                id: replyToRaw.id,
                content: replyToRaw.content,
                sender_id: replyToRaw.sender_id,
                sender: senderMap.get(replyToRaw.sender_id),
              } : undefined,
            };
          });

        const convMembers: ConversationMember[] = (allMembers || [])
          .filter((m: any) => m.conversation_id === conv.id)
          .map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) }));

        // Unread = non-system, non-deleted messages by others since last read
        const unreadCount = convMessages.filter(
          m => m.sender_id !== user.id && !m.is_system && !m.deleted_at && new Date(m.created_at) > lastReadAt
        ).length;

        // Pinned = this user has pinned this conversation
        const isPinned = myMembership?.is_pinned ?? false;

        return {
          ...conv,
          members: convMembers,
          messages: convMessages,
          lastMessage: [...convMessages].reverse().find(m => !m.is_system),
          unreadCount,
          isPinned,
        };
      });

      // Sort: pinned first, then by updated_at desc
      built.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setConversations(built);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Send a message — optimistic insert into local state immediately
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    replyToId?: string,
  ) => {
    if (!user || !content.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ConversationMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_system: false,
      reply_to_id: replyToId ?? null,
      reactions: [],
    };

    // Optimistic update
    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;
      return { ...c, messages: [...c.messages, tempMsg], lastMessage: tempMsg };
    }));

    const { data, error } = await (supabase as any).from('conversation_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      reply_to_id: replyToId ?? null,
    }).select().single();

    if (error) {
      // Rollback optimistic
      setConversations(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return { ...c, messages: c.messages.filter(m => m.id !== tempId) };
      }));
      throw error;
    }

    // Replace temp with real message
    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;
      const messages = c.messages.map(m => m.id === tempId ? { ...tempMsg, id: data.id } : m);
      return { ...c, messages, lastMessage: { ...tempMsg, id: data.id } };
    }));
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

    const newConvId = data as string;

    // Optimistically add the group to local state immediately so the UI shows it
    // without waiting for the refetch round-trip / replication lag.
    const optimisticConv: Conversation = {
      id: newConvId,
      name,
      avatar_url: null,
      is_group: true,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members: [{ user_id: user.id, role: 'admin', joined_at: new Date().toISOString() }],
      messages: [],
      lastMessage: undefined,
      unreadCount: 0,
      isPinned: false,
    };
    setConversations(prev => [optimisticConv, ...prev]);

    // Refetch immediately to get real data (members, system message, etc.)
    fetchConversations();
    // And once more after a short delay as a safety net for replication lag
    setTimeout(() => fetchConversations(), 1500);

    return newConvId;
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

  // Soft-delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    // Optimistic
    setConversations(prev => prev.map(c => ({
      ...c,
      messages: c.messages.map(m =>
        m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
      ),
    })));
    const { error } = await (supabase as any)
      .from('conversation_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);
    if (error) {
      await fetchConversations();
      throw error;
    }
  }, [fetchConversations]);

  // Toggle emoji reaction via RPC
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    await (supabase as any).rpc('toggle_reaction', { p_message_id: messageId, p_emoji: emoji });
    await fetchConversations();
  }, [user, fetchConversations]);

  // Leave a group
  const leaveGroup = useCallback(async (conversationId: string) => {
    const { error } = await (supabase as any).rpc('leave_group', { p_conversation_id: conversationId });
    if (error) throw error;
    setConversations(prev => prev.filter(c => c.id !== conversationId));
  }, []);

  // Delete a group (admin only)
  const deleteGroup = useCallback(async (conversationId: string) => {
    const { error } = await (supabase as any).rpc('delete_group', { p_conversation_id: conversationId });
    if (error) throw error;
    setConversations(prev => prev.filter(c => c.id !== conversationId));
  }, []);

  // Pin / unpin a conversation for this user
  const togglePin = useCallback(async (conversationId: string, pinned: boolean) => {
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, isPinned: pinned } : c
    ).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }));
    await (supabase as any)
      .from('conversation_members')
      .update({ is_pinned: pinned })
      .eq('conversation_id', conversationId)
      .eq('user_id', user?.id);
  }, [user]);

  // Promote or demote a group member (admin only)
  const setMemberRole = useCallback(async (conversationId: string, targetUserId: string, role: 'admin' | 'member') => {
    const { error } = await (supabase as any).rpc('set_member_role', {
      p_conversation_id: conversationId,
      p_target_user_id: targetUserId,
      p_role: role,
    });
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

  const getMyRole = useCallback((conv: Conversation): 'admin' | 'member' | null => {
    if (!user) return null;
    const me = conv.members.find(m => m.user_id === user.id);
    return me?.role ?? null;
  }, [user]);

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

    // Real-time: conversation inserts (new group created) + updates (name/avatar changes)
    const convChannel = supabase
      .channel('conv-updates-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .subscribe();

    // Real-time: message soft-deletes (UPDATE) and reactions
    const reactChannel = supabase
      .channel('conv-reactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => fetchConversations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_messages' }, () => fetchConversations())
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(memChannel);
      supabase.removeChannel(convChannel);
      supabase.removeChannel(reactChannel);
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
    deleteMessage,
    toggleReaction,
    leaveGroup,
    deleteGroup,
    togglePin,
    updateGroup,
    markConversationRead,
    getTotalUnread,
    getMyRole,
    setMemberRole,
    refetch: fetchConversations,
  };
};
