import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface TypingUser {
  userId: string;
  displayName: string;
}

/**
 * Subscribes to Supabase Broadcast events on `typing:<conversationId>`.
 * Automatically clears a user's typing status after 3 s of inactivity.
 *
 * Broadcast channels require a shared topic name across all participants, so
 * we cannot use useUniqueChannel here. Instead, on each mount we await the
 * removal of any stale channel with the same topic before subscribing — this
 * prevents "cannot add ... callbacks after subscribe()" when the component
 * remounts before the previous removeChannel RPC completes.
 */
export const useTypingIndicator = (conversationId: string | null) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const clearTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    let alive = true;

    const setup = async () => {
      // Remove any stale channel with the same topic before creating a new one.
      // supabase.getChannels() returns all channels; topics are prefixed with "realtime:".
      const stale = supabase.getChannels().find(
        (c: any) => c.topic === `realtime:typing:${conversationId}`,
      );
      if (stale) await supabase.removeChannel(stale);
      if (!alive) return;

      const channel = (supabase as any).channel(`typing:${conversationId}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
          if (payload.userId === user.id) return;
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u.userId !== payload.userId);
            return [...filtered, { userId: payload.userId, displayName: payload.displayName }];
          });
          const existing = clearTimers.current.get(payload.userId);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.userId !== payload.userId));
            clearTimers.current.delete(payload.userId);
          }, 3000);
          clearTimers.current.set(payload.userId, timer);
        })
        .subscribe();
    };

    setup();

    return () => {
      alive = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearTimers.current.forEach(t => clearTimeout(t));
      clearTimers.current.clear();
      setTypingUsers([]);
    };
  }, [conversationId, user?.id]);

  const broadcastTyping = useCallback(async (displayName: string) => {
    if (!conversationId || !user || !channelRef.current) return;
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, displayName },
      });
    } catch {}
  }, [conversationId, user?.id]);

  return { typingUsers, broadcastTyping };
};
