import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TypingUser {
  userId: string;
  displayName: string;
}

export const useTypingIndicator = (conversationId: string | null) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const clearTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload.userId === user.id) return;
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== payload.userId);
          return [...filtered, { userId: payload.userId, displayName: payload.displayName }];
        });
        // Auto-clear after 3s of no new event
        const existing = clearTimers.current.get(payload.userId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId));
          clearTimers.current.delete(payload.userId);
        }, 3000);
        clearTimers.current.set(payload.userId, timer);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimers.current.forEach(t => clearTimeout(t));
      clearTimers.current.clear();
      setTypingUsers([]);
    };
  }, [conversationId, user]);

  const broadcastTyping = useCallback(
    async (displayName: string) => {
      if (!conversationId || !user || !channelRef.current) return;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, displayName },
      });
    },
    [conversationId, user],
  );

  return { typingUsers, broadcastTyping };
};
