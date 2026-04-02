import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Global presence manager using a postgres-backed user_presence table.
 *
 * Why postgres_changes instead of Supabase Realtime Presence:
 *   - postgres_changes is confirmed working (used for notifications)
 *   - Supabase Realtime Presence requires a separate dashboard toggle
 *     that may not be enabled on all projects
 *
 * How it works:
 *   1. On mount, upsert own row in user_presence with last_seen_at = now()
 *   2. Fetch all users whose last_seen_at is within ONLINE_THRESHOLD
 *   3. Subscribe to postgres_changes on user_presence to get live updates
 *   4. Heartbeat every HEARTBEAT_INTERVAL to keep own row fresh
 *   5. Periodic re-fetch every HEARTBEAT_INTERVAL to prune stale users
 *      (handles the case where a user closes the browser without cleanup)
 *
 * A user is considered online if their last_seen_at is within 5 minutes.
 */
const SUPABASE_URL  = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY';

export const useGlobalPresence = () => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [stableOnlineUserIds, setStableOnlineUserIds] = useState<Set<string>>(new Set());

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef   = useRef<any>(null);
  const tokenRef     = useRef<string | null>(null);

  const HEARTBEAT_INTERVAL = 20 * 1000;  // 20 seconds — keep own row fresh + prune stale
  const ONLINE_THRESHOLD   = 60 * 1000;  // 60 seconds — cutoff for "online"

  // ── helpers ────────────────────────────────────────────────────────────────

  const fetchOnlineUsers = useCallback(async () => {
    const cutoff = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id')
      .gte('last_seen_at', cutoff);

    if (error) {
      console.warn('[presence] fetchOnlineUsers error:', error.message);
      return;
    }

    const ids = new Set<string>((data || []).map((r: any) => r.user_id));
    setOnlineUserIds(ids);
    setStableOnlineUserIds(ids);
  }, []);

  const updateOwnPresence = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from('user_presence')
      .upsert({ user_id: userId, last_seen_at: new Date().toISOString() });

    if (error) {
      console.warn('[presence] updateOwnPresence error:', error.message);
    }
  }, []);

  // ── cache access token for use in beforeunload ────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      tokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── main effect ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      setStableOnlineUserIds(new Set());
      return;
    }

    // Mark self online immediately, then fetch everyone
    updateOwnPresence(user.id).then(() => fetchOnlineUsers());

    // Heartbeat: keep own row fresh and re-fetch to prune stale users
    heartbeatRef.current = setInterval(() => {
      updateOwnPresence(user.id);
      fetchOnlineUsers();
    }, HEARTBEAT_INTERVAL);

    // Subscribe to postgres_changes — on any change just re-fetch the full list.
    // This avoids fragile payload parsing and works regardless of REPLICA IDENTITY setting.
    const channel = supabase
      .channel(`user-presence-changes-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => { fetchOnlineUsers(); }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') fetchOnlineUsers();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
          console.warn('[presence] channel status:', status);
      });

    channelRef.current = channel;

    // On tab close: delete own row immediately so others see us offline right away
    const handleUnload = () => {
      if (!tokenRef.current) return;
      fetch(`${SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [user?.id, updateOwnPresence, fetchOnlineUsers]);

  // ── activity tracking: refresh own last_seen_at on user interaction ────────

  useEffect(() => {
    if (!user) return;

    let lastUpdate = 0;
    const THROTTLE = 60 * 1000; // at most once per minute on activity

    const onActivity = () => {
      const now = Date.now();
      if (now - lastUpdate >= THROTTLE) {
        lastUpdate = now;
        updateOwnPresence(user.id);
      }
    };

    const EVENTS = ['mousedown', 'keydown', 'touchstart', 'click'] as const;
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => EVENTS.forEach(e => window.removeEventListener(e, onActivity));
  }, [user?.id, updateOwnPresence]);

  // ── visibility: refresh when tab becomes active ────────────────────────────

  useEffect(() => {
    if (!user) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        updateOwnPresence(user.id).then(() => fetchOnlineUsers());
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.id, updateOwnPresence, fetchOnlineUsers]);

  // ── public API ─────────────────────────────────────────────────────────────

  const isOnline = useCallback(
    (userId: string) => stableOnlineUserIds.has(userId),
    [stableOnlineUserIds],
  );

  return {
    onlineUserIds,
    stableOnlineUserIds,
    isOnline,
    refreshPresence: fetchOnlineUsers,
    isConnected: !!channelRef.current,
  };
};
