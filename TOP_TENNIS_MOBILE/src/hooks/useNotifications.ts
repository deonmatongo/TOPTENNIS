import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';
import { captureError } from '@/services/sentry';
import { useRealtimeConnection } from '@/contexts/RealtimeConnectionContext';
import { subscribeWithRetry } from '@/utils/realtimeRetry';

export type NotificationType =
  | 'message_received'
  | 'friend_request'
  | 'friend_accepted'
  | 'match_invite'
  | 'match_accepted'
  | 'match_confirmed'
  | 'match_declined'
  | 'match_cancelled'
  | 'match_rescheduled'
  | 'match_scheduled'
  | 'match_result'
  | 'match_suggestion'
  | 'league_update'
  | 'achievement'
  | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  metadata?: any;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const { connectionGeneration } = useRealtimeConnection();
  const notifTopic = useUniqueChannel('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const pendingQueueRef = useRef<any[]>([]);

  const transformRow = useCallback((row: any): Notification => ({
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: new Date(row.created_at),
    actionUrl: row.action_url,
    metadata: row.metadata,
  }), []);

  const updateUnreadCount = useCallback((list: Notification[]) => {
    setUnreadCount(list.filter(n => !n.read).length);
  }, []);

  const injectRow = useCallback((row: any) => {
    const incoming = transformRow(row);
    setNotifications(prev => {
      if (prev.some(n => n.id === incoming.id)) return prev;
      const next = [incoming, ...prev];
      updateUnreadCount(next);
      return next;
    });
  }, [transformRow, updateUnreadCount]);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (data || []).map(transformRow);
      setNotifications(list);
      updateUnreadCount(list);
      hasLoadedRef.current = true;
      pendingQueueRef.current.forEach(r => injectRow(r));
      pendingQueueRef.current = [];
    } catch (e) {
      captureError(e);
      if (__DEV__) console.error('Error fetching notifications:', e);
      setNotifications([]);
      setUnreadCount(0);
      hasLoadedRef.current = true;
      pendingQueueRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [user, transformRow, updateUnreadCount, injectRow]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    hasLoadedRef.current = false;
    pendingQueueRef.current = [];
    fetchNotifications();

    const cleanupChannel = subscribeWithRetry(() =>
      supabase
        .channel(`${notifTopic}:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (!payload.new) return;
          if (hasLoadedRef.current) injectRow(payload.new);
          else pendingQueueRef.current.push(payload.new);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (!payload.new) return;
          setNotifications(prev => {
            const updated = prev.map(n =>
              n.id === payload.new.id ? { ...n, read: payload.new.read } : n
            );
            updateUnreadCount(updated);
            return updated;
          });
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (!payload.old?.id) return;
          setNotifications(prev => {
            const filtered = prev.filter(n => n.id !== payload.old.id);
            updateUnreadCount(filtered);
            return filtered;
          });
        }),
      'notifications',
    );

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        fetchNotifications();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      cleanupChannel();
      appStateSub.remove();
    };
  }, [user, fetchNotifications, injectRow, updateUnreadCount, connectionGeneration]);

  const markAsRead = useCallback(async (id: string) => {
    if (!user) return;
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      updateUnreadCount(updated);
      return updated;
    });
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
  }, [user, updateUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const prev = notifications;
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    } catch {
      setNotifications(prev);
      updateUnreadCount(prev);
    }
  }, [user, notifications, updateUnreadCount]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== id);
      updateUnreadCount(filtered);
      return filtered;
    });
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user?.id ?? '');
  }, [user, updateUnreadCount]);

  const markVisibleAsRead = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setNotifications(prev => {
      const updated = prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n);
      updateUnreadCount(updated);
      return updated;
    });
    await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', user.id);
  }, [user, updateUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    markVisibleAsRead,
    refetch: fetchNotifications,
  };
};
