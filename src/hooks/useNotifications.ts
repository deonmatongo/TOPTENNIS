import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useBrowserNotifications } from './useBrowserNotifications';
import { playNotificationSound } from '@/utils/notificationSound';

export interface Notification {
  id: string;
  type: 'message_received' | 'friend_request' | 'friend_accepted' | 'match_scheduled' | 'match_result' | 'league_update' | 'achievement' | 'match_suggestion' | 'general' | 'match_invite' | 'match_rescheduled' | 'match_accepted' | 'match_confirmed' | 'match_declined' | 'match_cancelled';
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

  // Calculate unread count from notifications array to ensure consistency
  const updateUnreadCount = useCallback((notificationsList: Notification[]) => {
    const count = notificationsList.filter(n => !n.read).length;
    setUnreadCount(count);
  }, []);

  // Add new notification and update unread count atomically
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
      createdAt: new Date()
    };
    
    setNotifications(prev => {
      // Check for duplicates based on title, message, and type within a time window
      const timeWindow = 10000; // 10 seconds
      const isDuplicate = prev.some(n => 
        n.title === newNotification.title && 
        n.message === newNotification.message &&
        n.type === newNotification.type &&
        Math.abs(n.createdAt.getTime() - newNotification.createdAt.getTime()) < timeWindow
      );
      
      if (isDuplicate) {
        console.log('🔄 Skipping duplicate notification:', newNotification.title);
        return prev;
      }
      
      const newList = [newNotification, ...prev];
      // Update unread count in the same state update to prevent race conditions
      updateUnreadCount(newList);
      return newList;
    });
  }, [updateUnreadCount]);

  // Keep refs in sync with latest values so real-time callbacks are never stale
  useEffect(() => {
    isSupportedRef.current = isSupported;
    sendNotificationRef.current = sendNotification;
  }, [isSupported, sendNotification]);

  // Helper to transform a raw DB row into a Notification object
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

  // Stable ref for injectRealtimeRow so the subscription useEffect never needs
  // to re-run (and tear down the channel) when callbacks change.
  const injectRealtimeRowRef = useRef<(row: any) => void>(() => {});

  const injectRealtimeRow = useCallback((row: any) => {
    const incoming = transformRow(row);
    setNotifications(prev => {
      if (prev.some(n => n.id === incoming.id)) {
        return prev;
      }
      const newList = [incoming, ...prev];
      updateUnreadCount(newList);
      return newList;
    });

    playNotificationSound(0.5).catch(err =>
      console.warn('Failed to play notification sound:', err)
    );

    if (isSupportedRef.current) {
      sendNotificationRef.current(incoming.title, {
        body: incoming.message,
        tag: incoming.id,
        requireInteraction: false,
        icon: '/favicon.ico',
        clickUrl: incoming.actionUrl,
      });
    }
  }, [transformRow, updateUnreadCount]);

  // Keep the ref pointing at the latest version of injectRealtimeRow
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

      const transformedNotifications = (data || []).map(transformRow);

      setNotifications(transformedNotifications);
      updateUnreadCount(transformedNotifications);
      hasLoadedRef.current = true;

      if (pendingQueueRef.current.length > 0) {
        console.log(`🔄 Flushing ${pendingQueueRef.current.length} queued real-time events`);
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

  // Stable ref for fetchNotifications so the subscription effect doesn't depend on it
  const fetchNotificationsRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // Initial fetch + real-time subscription — only re-runs when user.id changes.
  // All callbacks are accessed via stable refs to prevent channel churn.
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    hasLoadedRef.current = false;
    pendingQueueRef.current = [];

    fetchNotificationsRef.current();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Real-time notification INSERT:', payload.new);
          if (!payload.new) return;
          if (hasLoadedRef.current) {
            injectRealtimeRowRef.current(payload.new);
          } else {
            console.log('⏳ Queuing notification until initial load completes');
            pendingQueueRef.current.push(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Real-time notification UPDATE:', payload.new);
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
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🗑️ Real-time notification DELETE:', payload.old);
          if (!payload.old?.id) return;
          setNotifications(prev => {
            const filtered = prev.filter(n => n.id !== payload.old.id);
            setUnreadCount(filtered.filter(n => !n.read).length);
            return filtered;
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Notification channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // Only user.id — stable refs handle everything else

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    // Optimistically update UI first for better UX
    setNotifications(prev => {
      const updatedNotifications = prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      );
      updateUnreadCount(updatedNotifications);
      return updatedNotifications;
    });

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        // Revert optimistic update on error
        setNotifications(prev => {
          const revertedNotifications = prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: false }
              : notification
          );
          updateUnreadCount(revertedNotifications);
          return revertedNotifications;
        });
        throw error;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user, updateUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    // Store previous state for potential rollback
    const previousNotifications = notifications;
    
    // Optimistically update UI
    const updatedNotifications = notifications.map(notification => ({ ...notification, read: true }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        // Revert on error
        setNotifications(previousNotifications);
        updateUnreadCount(previousNotifications);
        throw error;
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user, notifications, updateUnreadCount]);


  const removeNotification = useCallback(async (notificationId: string) => {
    // Optimistically remove from UI
    setNotifications(prev => {
      const newNotifications = prev.filter(n => n.id !== notificationId);
      updateUnreadCount(newNotifications);
      return newNotifications;
    });

    // Delete from DB
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

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
    refetch: fetchNotifications // Allow manual refresh if needed
  };
};