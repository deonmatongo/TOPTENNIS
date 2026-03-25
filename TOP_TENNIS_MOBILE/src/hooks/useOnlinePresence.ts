import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 30_000; // 30 s

/**
 * Tracks Supabase Realtime Presence so components can call isOnline(userId).
 * Uses AppState to un-track when the app goes to background and re-track on foreground.
 */
export const useOnlinePresence = () => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOnline = useCallback((userId: string) => onlineUserIds.has(userId), [onlineUserIds]);

  useEffect(() => {
    if (!user) return;

    const channel = (supabase as any).channel('global-online-presence', {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState();
          setOnlineUserIds(new Set(Object.keys(state)));
        } catch {}
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            heartbeatRef.current = setInterval(async () => {
              try { await channel.track({ user_id: user.id, online_at: new Date().toISOString() }); } catch {}
            }, HEARTBEAT_INTERVAL);
          } catch {}
        }
      });

    const handleAppState = async (nextState: AppStateStatus) => {
      if (!channelRef.current) return;
      if (nextState === 'active') {
        try { await channelRef.current.track({ user_id: user.id, online_at: new Date().toISOString() }); } catch {}
      } else if (nextState === 'background' || nextState === 'inactive') {
        try { await channelRef.current.untrack(); } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sub.remove();
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { onlineUserIds, isOnline };
};
