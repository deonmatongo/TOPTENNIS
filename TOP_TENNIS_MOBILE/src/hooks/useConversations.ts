import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { captureError } from '@/services/sentry';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';
import { useRealtimeConnection } from '@/contexts/RealtimeConnectionContext';
import { subscribeWithRetry } from '@/utils/realtimeRetry';

export interface ConversationMember {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at?: string | null;
  profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    profile_picture_url?: string | null;
  };
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
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
  reactions?: MessageReaction[];
  sender?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
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
  isPinned?: boolean;
  members: ConversationMember[];
  messages: ConversationMessage[];
  lastMessage?: ConversationMessage;
  unreadCount: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const { connectionGeneration } = useRealtimeConnection();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const db = supabase as any;
  const msgTopic = useUniqueChannel('mobile-conv-messages');
  const memTopic = useUniqueChannel('mobile-conv-members');
  const convTopic = useUniqueChannel('mobile-conv-updates');

  const fetchConversations = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
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

      const { data: convRows, error: convErr } = await db
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('updated_at', { ascending: false });
      if (convErr) throw convErr;

      const { data: allMembers, error: memErr } = await db
        .from('conversation_members')
        .select('conversation_id, user_id, role, joined_at, last_read_at')
        .in('conversation_id', convIds);
      if (memErr) throw memErr;

      const userIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, profile_picture_url')
        .in('id', userIds as string[]);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const { data: allMessages, error: msgErr } = await db
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });
      if (msgErr) throw msgErr;

      const messageIds: string[] = (allMessages || []).map((m: any) => m.id);
      const reactionsByMsg = new Map<string, MessageReaction[]>();
      for (let i = 0; i < messageIds.length; i += 200) {
        const chunk = messageIds.slice(i, i + 200);
        const { data: reactionRows } = await db
          .from('message_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', chunk);
        for (const r of reactionRows || []) {
          const list = reactionsByMsg.get(r.message_id) || [];
          list.push(r);
          reactionsByMsg.set(r.message_id, list);
        }
      }

      const senderIds = Array.from(new Set((allMessages || []).map((m: any) => m.sender_id)));
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, profile_picture_url')
        .in('id', senderIds as string[]);
      const senderMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));

      const built: Conversation[] = (convRows || []).map((conv: any) => {
        const myMembership = memberRows.find((r: any) => r.conversation_id === conv.id);
        const lastReadAt = myMembership?.last_read_at ? new Date(myMembership.last_read_at) : new Date(0);

        const convMessages: ConversationMessage[] = (allMessages || [])
          .filter((m: any) => m.conversation_id === conv.id)
          .map((m: any) => ({ ...m, sender: senderMap.get(m.sender_id), reactions: reactionsByMsg.get(m.id) || [] }));

        const convMembers: ConversationMember[] = (allMembers || [])
          .filter((m: any) => m.conversation_id === conv.id)
          .map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) }));

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
      captureError(err);
      if (__DEV__) console.error('useConversations fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const { error } = await db.rpc('toggle_reaction', { p_message_id: messageId, p_emoji: emoji });
    if (error) throw error;
    await fetchConversations();
  }, [user, fetchConversations]);

  const sendMessage = useCallback(async (conversationId: string, content: string, replyToId?: string) => {
    if (!user || !content.trim()) return;
    const payload: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    };
    if (replyToId) payload.reply_to_id = replyToId;
    const { error } = await db.from('conversation_messages').insert(payload);
    if (error) throw error;
    await fetchConversations();
  }, [user, fetchConversations]);

  const getOrCreateDM = useCallback(async (otherUserId: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await db.rpc('get_or_create_dm', { p_other_user_id: otherUserId });
    if (error) throw error;
    await fetchConversations();
    return data as string;
  }, [user, fetchConversations]);

  const createGroupChat = useCallback(async (name: string, memberUserIds: string[]): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await db.rpc('create_group_chat', {
      p_name: name,
      p_member_ids: memberUserIds,
    });
    if (error) throw error;
    await fetchConversations();
    return data as string;
  }, [user, fetchConversations]);

  const addMember = useCallback(async (conversationId: string, userId: string) => {
    const { error } = await db.from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'member',
    });
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const removeMember = useCallback(async (conversationId: string, userId: string) => {
    const { error } = await db
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const deleteMessage = useCallback(async (messageId: string) => {
    // Soft delete (same as web) — RLS only allows senders to UPDATE their rows
    const { error } = await db
      .from('conversation_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const updateGroup = useCallback(async (conversationId: string, updates: { name?: string; avatar_url?: string }) => {
    const { error } = await db
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    await db
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
    );
  }, [user]);

  const getTotalUnread = useCallback(() =>
    conversations.reduce((sum, c) => sum + c.unreadCount, 0),
  [conversations]);

  const getMyRole = useCallback((conv: Conversation): 'admin' | 'member' | null => {
    if (!user) return null;
    const me = conv.members.find(m => m.user_id === user.id);
    return me?.role ?? null;
  }, [user]);

  const leaveGroup = useCallback(async (conversationId: string) => {
    if (!user) return;
    const { error } = await db
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (error) throw error;
    setConversations(prev => prev.filter(c => c.id !== conversationId));
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchConversations();

    const cleanupMsg = subscribeWithRetry(() =>
      (supabase as any)
        .channel(`${msgTopic}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
          (payload: any) => {
            if (__DEV__) console.log('[conv:messages] INSERT event', payload);
            fetchConversations();
          })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' },
          (payload: any) => {
            if (__DEV__) console.log('[conv:reactions] * event', payload);
            fetchConversations();
          }),
      'conv:messages',
    );

    const cleanupMem = subscribeWithRetry(() =>
      (supabase as any)
        .channel(`${memTopic}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'conversation_members',
          filter: `user_id=eq.${user.id}`,
        }, (payload: any) => {
          if (__DEV__) console.log('[conv:members] * event', payload);
          fetchConversations();
        }),
      'conv:members',
    );

    const cleanupConv = subscribeWithRetry(() =>
      (supabase as any)
        .channel(`${convTopic}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload: any) => {
          if (__DEV__) console.log('[conv:conversations] INSERT event', payload);
          fetchConversations();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload: any) => {
          if (__DEV__) console.log('[conv:conversations] UPDATE event', payload);
          fetchConversations();
        }),
      'conv:conversations',
    );

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (__DEV__) console.log('[conv] app foregrounded — refetching');
        fetchConversations();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      cleanupMsg();
      cleanupMem();
      cleanupConv();
      appStateSub.remove();
    };
  }, [user, fetchConversations, connectionGeneration]);

  return {
    conversations,
    loading,
    sendMessage,
    toggleReaction,
    getOrCreateDM,
    createGroupChat,
    addMember,
    removeMember,
    deleteMessage,
    updateGroup,
    markConversationRead,
    getTotalUnread,
    getMyRole,
    leaveGroup,
    refetch: fetchConversations,
  };
};
