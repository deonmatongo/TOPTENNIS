import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useBrowserNotifications } from './useBrowserNotifications';
import { playNotificationSound } from '@/utils/notificationSound';

export interface Notification {
  id: string;
  type: 'message_received' | 'friend_request' | 'friend_accepted' | 'match_scheduled' | 'match_result' | 'league_update' | 'achievement' | 'match_suggestion' | 'general' | 'match_invite' | 'match_rescheduled' | 'match_accepted' | 'match_confirmed' | 'match_declined' | 'match_cancelled' | 'group_invite';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  metadata?: any;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { sendNotification, isSupported } = useBrowserNotifications();

  // Refs to hold latest values for use inside real-time callbacks (avoids stale closures)
  const isSupportedRef = useRef(isSupported);
  const sendNotificationRef = useRef(sendNotification);
  // hasLoadedRef tracks whether the initial fetch has completed
  const hasLoadedRef = useRef(false);
  // pendingQueue holds real-time events that arrive before the initial fetch completes
  const pendingQueueRef = useRef<any[]>([]);
  // Keep latest notifications accessible in effects without causing re-runs
  const notificationsRef = useRef<Notification[]>([]);

  // ── Reconnection state ────────────────────────────────────────────────────
  // Incrementing this triggers the subscription effect to recreate the channel
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep notificationsRef in sync without triggering subscription re-creation
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const updateUnreadCount = useCallback((notificationsList: Notification[]) => {
    const count = notificationsList.filter(n => !n.read).length;
    setUnreadCount(count);
  }, []);

  // Track notification IDs to prevent duplicates
  const notificationIdsRef = useRef<Set<string>>(new Set());

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    setNotifications(prev => {
      if (prev.some(n => n.id === newNotification.id)) return prev;

      const timeWindow = 10000;
      const isContentDuplicate = prev.some(n =>
        n.title === newNotification.title &&
        n.message === newNotification.message &&
        n.type === newNotification.type &&
        Math.abs(n.createdAt.getTime() - newNotification.createdAt.getTime()) < timeWindow
      );
      if (isContentDuplicate) return prev;

      if (notification.metadata) {
        const metadataKey = `${notification.type}-${JSON.stringify(notification.metadata)}`;
        if (notificationIdsRef.current.has(metadataKey)) return prev;
        notificationIdsRef.current.add(metadataKey);
        if (notificationIdsRef.current.size > 100) {
          const oldKeys = Array.from(notificationIdsRef.current).slice(0, 50);
          oldKeys.forEach(key => notificationIdsRef.current.delete(key));
        }
      }

      const newList = [newNotification, ...prev];
      updateUnreadCount(newList);
      return newList;
    });
  }, [updateUnreadCount]);

  useEffect(() => {
    isSupportedRef.current = isSupported;
    sendNotificationRef.current = sendNotification;
  }, [isSupported, sendNotification]);

  const transformRow = useCallback((row: any): Notification => ({
    id: row.id,
    type: row.type as Notification['type'],
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: new Date(row.created_at),
    actionUrl: row.action_url,
    metadata: row.metadata
  }), []);

  const injectRealtimeRowRef = useRef<(row: any) => void>(() => {});
  const notifiedRowIds = useRef<Set<string>>(new Set());

  const injectRealtimeRow = useCallback((row: any) => {
    const incoming = transformRow(row);
    setNotifications(prev => {
      if (prev.some(n => n.id === incoming.id)) return prev;

      const timeWindow = 5000;
      const isRecentDuplicate = prev.some(n =>
        n.title === incoming.title &&
        n.message === incoming.message &&
        n.type === incoming.type &&
        Math.abs(n.createdAt.getTime() - incoming.createdAt.getTime()) < timeWindow
      );
      if (isRecentDuplicate) return prev;

      const newList = [incoming, ...prev];
      updateUnreadCount(newList);
      return newList;
    });

    if (!notifiedRowIds.current.has(incoming.id)) {
      notifiedRowIds.current.add(incoming.id);

      playNotificationSound(0.5).catch(() => {});

      if (isSupportedRef.current) {
        sendNotificationRef.current(incoming.title, {
          body: incoming.message,
          tag: incoming.id,
          requireInteraction: false,
          icon: '/favicon.ico',
          clickUrl: incoming.actionUrl,
        });
      }
    }
  }, [transformRow, updateUnreadCount]);

  useEffect(() => {
    injectRealtimeRowRef.current = injectRealtimeRow;
  }, [injectRealtimeRow]);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformed = (data || []).map(transformRow);
      setNotifications(transformed);
      updateUnreadCount(transformed);
      hasLoadedRef.current = true;

      if (pendingQueueRef.current.length > 0) {
        pendingQueueRef.current.forEach(row => injectRealtimeRowRef.current(row));
        pendingQueueRef.current = [];
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
      hasLoadedRef.current = true;
      pendingQueueRef.current = [];
    } finally {
      setIsLoading(false);
    }
  }, [user, updateUnreadCount, transformRow]);

  const fetchNotificationsRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // ── Real-time subscription with exponential-backoff reconnection ───────────
  // subscriptionKey is incremented on CHANNEL_ERROR/TIMED_OUT to force
  // this effect to re-run and create a fresh channel.
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    hasLoadedRef.current = false;
    pendingQueueRef.current = [];
    fetchNotificationsRef.current();

    // Unique channel name per user + attempt so Supabase never deduplicates
    const channelName = `notifications-${user.id}-${subscriptionKey}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (!payload.new) return;
          if (hasLoadedRef.current) {
            injectRealtimeRowRef.current(payload.new);
          } else {
            pendingQueueRef.current.push(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (!payload.new) return;
          setNotifications(prev => {
            const updated = prev.map(n =>
              n.id === payload.new.id
                ? { ...n, read: payload.new.read, title: payload.new.title, message: payload.new.message }
                : n
            );
            setUnreadCount(updated.filter(n => !n.read).length);
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (!payload.old?.id) return;
          setNotifications(prev => {
            const filtered = prev.filter(n => n.id !== payload.old.id);
            setUnreadCount(filtered.filter(n => !n.read).length);
            return filtered;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Reset backoff counter on successful connection
          reconnectAttemptsRef.current = 0;

          // Catch up on any notifications missed while the channel was reconnecting
          const latest = notificationsRef.current[0];
          if (hasLoadedRef.current && latest) {
            supabase
              .from('notifications')
              .select('*')
              .eq('user_id', user.id)
              .gt('created_at', latest.createdAt.toISOString())
              .order('created_at', { ascending: false })
              .then(({ data, error }) => {
                if (!error && data?.length) {
                  data.forEach(row => injectRealtimeRowRef.current(row));
                }
              });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Exponential backoff: 2s, 4s, 8s, 16s, 30s (cap), then give up
          const attempts = reconnectAttemptsRef.current;
          const MAX_ATTEMPTS = 6;
          if (attempts < MAX_ATTEMPTS) {
            const delay = Math.min(2000 * Math.pow(2, attempts), 30000);
            console.warn(`[notifications] Channel ${status}. Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_ATTEMPTS})`);
            reconnectTimerRef.current = setTimeout(() => {
              reconnectAttemptsRef.current = attempts + 1;
              setSubscriptionKey(k => k + 1);
            }, delay);
          } else {
            console.error('[notifications] Max reconnect attempts reached. Will retry on next tab focus.');
          }
        }
      });

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id, subscriptionKey]); // subscriptionKey drives reconnection

  // ── Refetch on tab visibility (covers browser throttling background tabs) ──
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotificationsRef.current();
        // Also reset reconnect counter so a fresh connection attempt is allowed
        reconnectAttemptsRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id]);

  // ── Periodic fallback poll (catches any gaps if real-time silently fails) ─
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchNotificationsRef.current();
    }, 60_000); // every 60 seconds
    return () => clearInterval(interval);
  }, [user?.id]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      updateUnreadCount(updated);
      return updated;
    });

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        // Revert on error
        setNotifications(prev => {
          const reverted = prev.map(n =>
            n.id === notificationId ? { ...n, read: false } : n
          );
          updateUnreadCount(reverted);
          return reverted;
        });
        throw error;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user, updateUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const previous = notificationsRef.current;
    const updated = previous.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        setNotifications(previous);
        updateUnreadCount(previous);
        throw error;
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user, updateUnreadCount]);

  const removeNotification = useCallback(async (notificationId: string) => {
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== notificationId);
      updateUnreadCount(next);
      return next;
    });

    if (user) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId)
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    }
  }, [user, updateUnreadCount]);

  const clearAllNotifications = useCallback(async () => {
    if (!user) return;

    const previous = notificationsRef.current;
    setNotifications([]);
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        // Revert on failure
        setNotifications(previous);
        updateUnreadCount(previous);
        throw error;
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  }, [user, updateUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
    clearAllNotifications,
    refetch: fetchNotifications,
  };
};
