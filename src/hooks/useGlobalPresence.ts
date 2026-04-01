import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Global presence manager that maintains a single presence connection
 * for the entire app session to prevent multiple connections and flickering.
 */
export const useGlobalPresence = () => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [stableOnlineUserIds, setStableOnlineUserIds] = useState<Set<string>>(new Set());
  // Incrementing this recreates the channel (used for reconnection)
  const [subscriptionKey, setSubscriptionKey] = useState(0);

  const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastUpdateTime = useRef<Map<string, number>>(new Map());
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<any>(null);
  // Ref so debouncedUpdate can read the latest stableOnlineUserIds without being re-created
  const stableOnlineUserIdsRef = useRef<Set<string>>(new Set());

  // Inactivity tracking
  const lastActivityRef = useRef<number>(Date.now());
  const isTrackedRef    = useRef<boolean>(false); // whether we've called channel.track()

  // Debounce time in milliseconds - wait this long before confirming status change
  const DEBOUNCE_TIME = 3000; // 3 seconds
  // Minimum time between status updates
  const MIN_UPDATE_INTERVAL = 1000; // 1 second
  // Heartbeat interval to maintain presence
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  // Inactivity timeout — untrack after this many ms with no user activity
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  // Keep the ref in sync without adding it to any callback deps
  useEffect(() => { stableOnlineUserIdsRef.current = stableOnlineUserIds; }, [stableOnlineUserIds]);

  const debouncedUpdate = useCallback((userIds: Set<string>) => {
    const now = Date.now();
    const currentIds = stableOnlineUserIdsRef.current;

    // Find users who changed status
    const newlyOnline = new Set<string>();
    const newlyOffline = new Set<string>();

    userIds.forEach(id => {
      if (!currentIds.has(id)) {
        newlyOnline.add(id);
      }
    });

    currentIds.forEach(id => {
      if (!userIds.has(id)) {
        newlyOffline.add(id);
      }
    });

    // Process newly online users
    newlyOnline.forEach(id => {
      const lastUpdate = lastUpdateTime.current.get(id) || 0;
      const timeSinceUpdate = now - lastUpdate;

      // Clear existing timeout if any
      const existingTimeout = pendingUpdates.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // If enough time has passed since last update, update immediately
      if (timeSinceUpdate >= MIN_UPDATE_INTERVAL) {
        setStableOnlineUserIds(prev => new Set(prev).add(id));
        lastUpdateTime.current.set(id, now);
      } else {
        // Otherwise, debounce the update
        const timeout = setTimeout(() => {
          setStableOnlineUserIds(prev => new Set(prev).add(id));
          lastUpdateTime.current.set(id, Date.now());
          pendingUpdates.current.delete(id);
        }, Math.max(DEBOUNCE_TIME, MIN_UPDATE_INTERVAL - timeSinceUpdate));

        pendingUpdates.current.set(id, timeout);
      }
    });

    // Process newly offline users (with longer debounce to avoid flickering)
    newlyOffline.forEach(id => {
      const existingTimeout = pendingUpdates.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        setStableOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        lastUpdateTime.current.delete(id);
        pendingUpdates.current.delete(id);
      }, DEBOUNCE_TIME * 2); // Double debounce time for offline to be more conservative

      pendingUpdates.current.set(id, timeout);
    });
  }, []); // stable — reads stableOnlineUserIds via ref

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Clean up when user logs out
      stopHeartbeat();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      pendingUpdates.current.forEach(timeout => clearTimeout(timeout));
      pendingUpdates.current.clear();
      lastUpdateTime.current.clear();
      setOnlineUserIds(new Set());
      setStableOnlineUserIds(new Set());
      return;
    }

    // All users join this fixed channel so they can always see each other,
    // even after a reconnect.  subscriptionKey forces the useEffect to re-run
    // (cleanup removes the old channel, then the new effect recreates it with
    // the same name — Supabase allows this because removeChannel unregisters it).
    const channelName = 'global-online-presence';
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        try {
          // channel config sets `key: user.id`, so Object.keys(state) gives
          // every online user's ID directly — no need to dig into tracked data.
          const state = channel.presenceState();
          const ids = new Set<string>(Object.keys(state));

          // Update raw state immediately for internal use
          setOnlineUserIds(ids);

          // Debounce stable state updates to prevent flickering
          debouncedUpdate(ids);
        } catch (error) {
          console.error('Presence sync error:', error);
        }
      })
      .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
        setOnlineUserIds(prev => new Set(prev).add(key));
        setStableOnlineUserIds(prev => new Set(prev).add(key));
        lastUpdateTime.current.set(key, Date.now());
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        const existingTimeout = pendingUpdates.current.get(key);
        if (existingTimeout) clearTimeout(existingTimeout);
        const timeout = setTimeout(() => {
          setStableOnlineUserIds(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          lastUpdateTime.current.delete(key);
          pendingUpdates.current.delete(key);
        }, DEBOUNCE_TIME * 2);
        pendingUpdates.current.set(key, timeout);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          // Reset backoff on successful connection
          reconnectAttemptsRef.current = 0;
          try {
            lastActivityRef.current = Date.now();
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
              last_active: Date.now(),
            });
            isTrackedRef.current = true;
            // Start heartbeat — checks inactivity and tracks/untracks accordingly
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = setInterval(async () => {
              try {
                const idle = Date.now() - lastActivityRef.current;
                if (idle >= INACTIVITY_TIMEOUT) {
                  // User has been inactive for 10+ minutes — go offline
                  if (isTrackedRef.current) {
                    await channel.untrack();
                    isTrackedRef.current = false;
                  }
                } else {
                  // User is active — keep presence alive
                  await channel.track({
                    user_id: user.id,
                    online_at: new Date().toISOString(),
                    last_active: lastActivityRef.current,
                  });
                  isTrackedRef.current = true;
                }
              } catch (err) {
                console.warn('Presence heartbeat failed:', err);
              }
            }, HEARTBEAT_INTERVAL);
          } catch (error) {
            console.error('Failed to track initial presence:', error);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Exponential backoff: 2s, 4s, 8s, 16s, 30s (cap), then give up
          const attempts = reconnectAttemptsRef.current;
          const MAX_ATTEMPTS = 6;
          if (attempts < MAX_ATTEMPTS) {
            const delay = Math.min(2000 * Math.pow(2, attempts), 30000);
            console.warn(`[presence] Channel ${status}. Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_ATTEMPTS})`);
            reconnectTimerRef.current = setTimeout(() => {
              reconnectAttemptsRef.current = attempts + 1;
              setSubscriptionKey(k => k + 1);
            }, delay);
          } else {
            console.error('[presence] Max reconnect attempts reached. Will retry on next tab focus.');
          }
        }
      });

    return () => {
      stopHeartbeat();
      isTrackedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user?.id, subscriptionKey, debouncedUpdate, stopHeartbeat]);

  // Activity detection — update lastActivityRef on any user interaction.
  // When the user returns from idle, re-track if the channel exists.
  useEffect(() => {
    if (!user) return;
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      // If we went offline due to inactivity, come back online on next activity
      if (!isTrackedRef.current && channelRef.current) {
        channelRef.current.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
          last_active: Date.now(),
        }).then(() => {
          isTrackedRef.current = true;
        }).catch(() => {});
      }
    };
    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => EVENTS.forEach(e => window.removeEventListener(e, onActivity));
  }, [user?.id]);

  // Refetch on tab visibility (covers browser throttling background tabs)
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastActivityRef.current = Date.now();
        // Reset reconnect counter so a fresh connection attempt is allowed
        reconnectAttemptsRef.current = 0;
        // Re-track presence in case the channel is still alive
        if (channelRef.current) {
          channelRef.current.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
            last_active: Date.now(),
          }).then(() => {
            isTrackedRef.current = true;
          }).catch(() => {
            // If tracking fails, force a full channel recreation
            setSubscriptionKey(k => k + 1);
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id]);

  const isOnline = useCallback((userId: string) => stableOnlineUserIds.has(userId), [stableOnlineUserIds]);

  // Force refresh presence (useful for debugging or manual refresh)
  const refreshPresence = useCallback(() => {
    if (channelRef.current && user) {
      channelRef.current.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
        refresh: true
      });
    }
  }, [user]);

  return {
    onlineUserIds,
    stableOnlineUserIds,
    isOnline,
    refreshPresence,
    isConnected: !!channelRef.current
  };
};
