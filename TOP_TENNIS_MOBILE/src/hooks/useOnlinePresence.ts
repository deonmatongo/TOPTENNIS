import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/services/logger';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

/**
 * Tracks online status using the user_presence postgres table + postgres_changes.
 * Matches the web useGlobalPresence approach (same table, same threshold).
 *
 * - Upserts own row on mount / foreground
 * - 20 s heartbeat to keep last_seen_at fresh
 * - Deletes own row immediately when app backgrounds
 * - A user is "online" when last_seen_at is within 60 s
 */
const HEARTBEAT_INTERVAL = 20_000;   // 20 s
const ONLINE_THRESHOLD_MS = 60_000;  // 60 s

export const useOnlinePresence = () => {
  const { user } = useAuth();
  const channelTopic = useUniqueChannel('mobile-presence');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);

  const isOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds],
  );

  const fetchOnlineUsers = useCallback(async () => {
    const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id')
      .gte('last_seen_at', cutoff);
    if (error) {
      logger.warn('presence', 'fetch online users failed', error);
      return;
    }
    setOnlineUserIds(new Set((data || []).map((r: any) => r.user_id)));
  }, []);

  const updateOwnPresence = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from('user_presence')
      .upsert({ user_id: userId, last_seen_at: new Date().toISOString() });
    if (error) logger.warn('presence', 'upsert own presence failed', error);
  }, []);

  const removeOwnPresence = useCallback(async (userId: string) => {
    try {
      await supabase.from('user_presence').delete().eq('user_id', userId);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }

    // Mark self online, then fetch everyone
    updateOwnPresence(user.id).then(() => fetchOnlineUsers());

    // Heartbeat: keep own row fresh + prune stale users
    heartbeatRef.current = setInterval(() => {
      updateOwnPresence(user.id);
      fetchOnlineUsers();
    }, HEARTBEAT_INTERVAL);

    // Subscribe to postgres_changes — any change = re-fetch the full list
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => { fetchOnlineUsers(); },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') fetchOnlineUsers();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
          logger.warn('presence', `realtime channel ${status}`);
      });

    channelRef.current = channel;

    // AppState: re-track on foreground, remove on background
    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        await updateOwnPresence(user.id);
        await fetchOnlineUsers();
      } else if (nextState === 'background' || nextState === 'inactive') {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        await removeOwnPresence(user.id);
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      appStateSub.remove();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [user?.id, channelTopic, updateOwnPresence, fetchOnlineUsers, removeOwnPresence]);

  return { onlineUserIds, isOnline };
};
