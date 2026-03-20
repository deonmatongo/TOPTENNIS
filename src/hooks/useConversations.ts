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

const sortConversations = (list: Conversation[]) =>
  [...list].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const db = supabase as any;
    setLoading(true);

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

      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', userIds as string[]);

      if (profileErr) throw profileErr;

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const { data: allMessages, error: msgErr } = await db
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      const senderIds = Array.from(new Set((allMessages || []).map((m: any) => m.sender_id)));

      const { data: senderProfiles, error: senderErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .in('id', senderIds as string[]);

      if (senderErr) throw senderErr;

      const senderMap = new Map((senderProfiles || []).map(p => [p.id, p]));

      const msgIds = (allMessages || []).map((m: any) => m.id);
      let reactionsMap = new Map<string, MessageReaction[]>();

      if (msgIds.length > 0) {
        const { data: allReactions, error: reactionsErr } = await db
          .from('message_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', msgIds);

        if (reactionsErr) throw reactionsErr;

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

        const unreadCount = convMessages.filter(
          m => m.sender_id !== user.id && !m.is_system && !m.deleted_at && new Date(m.created_at) > lastReadAt
        ).length;

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

      setConversations(sortConversations(built));
    } catch (err) {
      console.error('Error fetching conversations:', err);
      toast.error('Failed to load conversations. Please try again.', {
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => fetchConversations(),
        },
      });
      setConversations([]);
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
      setConversations(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return { ...c, messages: c.messages.filter(m => m.id !== tempId) };
      }));
      throw error;
    }

    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;
      const messages = c.messages.map(m => m.id === tempId ? { ...tempMsg, id: data.id } : m);
      return { ...c, messages, lastMessage: { ...tempMsg, id: data.id } };
    }));
  }, [user]);

  const getOrCreateDM = useCallback(async (otherUserId: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await (supabase as any).rpc('get_or_create_dm', {
      p_other_user_id: otherUserId,
    });
    if (error) throw error;
    await fetchConversations();
    return data as string;
  }, [user, fetchConversations]);

  const createGroupChat = useCallback(async (
    name: string,
    memberUserIds: string[],
    opts?: { description?: string; group_type?: 'private' | 'open'; avatar_emoji?: string },
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase as any).rpc('create_group_chat', {
      p_name: name,
      p_member_ids: memberUserIds,
      p_description:  opts?.description  ?? null,
      p_group_type:   opts?.group_type    ?? 'private',
      p_avatar_emoji: opts?.avatar_emoji  ?? null,
    });

    if (error) throw error;

    const newConvId = data as string;

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

    // Fetch real data after creation (system messages, full member list, etc.)
    fetchConversations();

    return newConvId;
  }, [user, fetchConversations]);

  const addMember = useCallback(async (conversationId: string, userId: string) => {
    const { error } = await (supabase as any).from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'member',
    });
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const removeMember = useCallback(async (conversationId: string, userId: string) => {
    const { error } = await (supabase as any)
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const deleteMessage = useCallback(async (messageId: string) => {
    const deletedAt = new Date().toISOString();
    setConversations(prev => prev.map(c => ({
      ...c,
      messages: c.messages.map(m =>
        m.id === messageId ? { ...m, deleted_at: deletedAt } : m
      ),
    })));
    const { error } = await (supabase as any)
      .from('conversation_messages')
      .update({ deleted_at: deletedAt })
      .eq('id', messageId);
    if (error) {
      await fetchConversations();
      throw error;
    }
  }, [fetchConversations]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    await (supabase as any).rpc('toggle_reaction', { p_message_id: messageId, p_emoji: emoji });
    // Optimistic update is handled by the real-time reaction channel
  }, [user]);

  const leaveGroup = useCallback(async (conversationId: string) => {
    const { error } = await (supabase as any).rpc('leave_group', { p_conversation_id: conversationId });
    if (error) throw error;
    setConversations(prev => prev.filter(c => c.id !== conversationId));
  }, []);

  const deleteGroup = useCallback(async (conversationId: string) => {
    const { error } = await (supabase as any).rpc('delete_group', { p_conversation_id: conversationId });
    if (error) throw error;
    setConversations(prev => prev.filter(c => c.id !== conversationId));
  }, []);

  const togglePin = useCallback(async (conversationId: string, pinned: boolean) => {
    setConversations(prev => sortConversations(prev.map(c =>
      c.id === conversationId ? { ...c, isPinned: pinned } : c
    )));
    await (supabase as any)
      .from('conversation_members')
      .update({ is_pinned: pinned })
      .eq('conversation_id', conversationId)
      .eq('user_id', user?.id);
  }, [user]);

  const setMemberRole = useCallback(async (conversationId: string, targetUserId: string, role: 'admin' | 'member') => {
    const { error } = await (supabase as any).rpc('set_member_role', {
      p_conversation_id: conversationId,
      p_target_user_id: targetUserId,
      p_role: role,
    });
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const updateGroup = useCallback(async (conversationId: string, updates: { name?: string; avatar_url?: string }) => {
    const { error } = await (supabase as any)
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    if (error) throw error;
    await fetchConversations();
  }, [fetchConversations]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (error) console.error('Error marking conversation read:', error);
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
    if (!user) {
      setLoading(false);
      return;
    }

    fetchConversations();

    // ── Real-time: new message ────────────────────────────────────────────────
    const msgChannel = supabase
      .channel('conv-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
      }, async (payload) => {
        const newMsg = payload.new as any;

        setConversations(prev => {
          const conv = prev.find(c => c.id === newMsg.conversation_id);
          if (!conv) return prev; // not our conversation

          // Skip if already present (optimistic update)
          if (conv.messages.some(m => m.id === newMsg.id)) return prev;

          // Try to find sender profile from existing members
          const senderProfile = conv.members.find(m => m.user_id === newMsg.sender_id)?.profile;

          const msg: ConversationMessage = {
            ...newMsg,
            sender: senderProfile
              ? {
                  id: senderProfile.id,
                  first_name: senderProfile.first_name,
                  last_name: senderProfile.last_name,
                  email: senderProfile.email,
                  profile_picture_url: senderProfile.profile_picture_url,
                }
              : undefined,
            reactions: [],
          };

          const messages = [...conv.messages, msg];
          const lastMessage = msg.is_system ? conv.lastMessage : msg;

          return sortConversations(prev.map(c =>
            c.id === newMsg.conversation_id
              ? { ...c, messages, lastMessage, updated_at: newMsg.created_at }
              : c
          ));
        });

        // If we couldn't resolve sender from members, do a targeted profile fetch
        setConversations(prev => {
          const conv = prev.find(c => c.id === newMsg.conversation_id);
          const msg = conv?.messages.find(m => m.id === newMsg.id);
          if (msg && !msg.sender && newMsg.sender_id) {
            supabase
              .from('profiles')
              .select('id, first_name, last_name, email, profile_picture_url')
              .eq('id', newMsg.sender_id)
              .single()
              .then(({ data }) => {
                if (!data) return;
                setConversations(inner => inner.map(c => ({
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === newMsg.id ? { ...m, sender: data } : m
                  ),
                })));
              });
          }
          return prev;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_messages',
      }, (payload) => {
        const updated = payload.new as any;
        setConversations(prev => prev.map(c => ({
          ...c,
          messages: c.messages.map(m =>
            m.id === updated.id ? { ...m, deleted_at: updated.deleted_at, content: updated.content } : m
          ),
        })));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Message real-time channel error:', status);
        }
      });

    // ── Real-time: reactions ──────────────────────────────────────────────────
    const reactChannel = supabase
      .channel('conv-reactions-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reactions',
      }, (payload) => {
        const r = payload.new as any;
        const isMe = r.user_id === user.id;
        setConversations(prev => prev.map(conv => ({
          ...conv,
          messages: conv.messages.map(msg => {
            if (msg.id !== r.message_id) return msg;
            const reactions = msg.reactions || [];
            const existing = reactions.find(rx => rx.emoji === r.emoji);
            if (existing) {
              return {
                ...msg,
                reactions: reactions.map(rx =>
                  rx.emoji === r.emoji
                    ? { ...rx, count: rx.count + 1, userIds: [...rx.userIds, r.user_id], reactedByMe: rx.reactedByMe || isMe }
                    : rx
                ),
              };
            }
            return { ...msg, reactions: [...reactions, { emoji: r.emoji, count: 1, reactedByMe: isMe, userIds: [r.user_id] }] };
          }),
        })));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'message_reactions',
      }, (payload) => {
        const r = payload.old as any;
        const isMe = r.user_id === user.id;
        setConversations(prev => prev.map(conv => ({
          ...conv,
          messages: conv.messages.map(msg => {
            if (msg.id !== r.message_id) return msg;
            const reactions = (msg.reactions || [])
              .map(rx => {
                if (rx.emoji !== r.emoji) return rx;
                const newCount = rx.count - 1;
                if (newCount <= 0) return null;
                return {
                  ...rx,
                  count: newCount,
                  userIds: rx.userIds.filter(id => id !== r.user_id),
                  reactedByMe: isMe ? false : rx.reactedByMe,
                };
              })
              .filter(Boolean) as MessageReaction[];
            return { ...msg, reactions };
          }),
        })));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Reaction real-time channel error:', status);
        }
      });

    // ── Real-time: membership & conversation changes (full refetch) ───────────
    const membershipChannel = supabase
      .channel('conv-membership-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_members',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchConversations())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
      }, () => fetchConversations())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      }, (payload) => {
        const updated = payload.new as any;
        setConversations(prev => prev.map(c =>
          c.id === updated.id
            ? { ...c, name: updated.name, avatar_url: updated.avatar_url, updated_at: updated.updated_at }
            : c
        ));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Membership real-time channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(reactChannel);
      supabase.removeChannel(membershipChannel);
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
