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
  const { sendNotification } = useBrowserNotifications();
  
  // Use ref to track if we've loaded notifications to prevent duplicate state updates
  const hasLoadedRef = useRef(false);

  // Mock notifications for demonstration - showing more for scrolling
  const generateMockNotifications = useCallback((): Notification[] => [
    {
      id: '1',
      type: 'match_scheduled',
      title: 'New Match Scheduled',
      message: 'Your match with Sarah Johnson is scheduled for tomorrow at 2:00 PM',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      actionUrl: '/dashboard?tab=matches',
      metadata: { matchId: '123', opponent: 'Sarah Johnson' }
    },
    {
      id: '2',
      type: 'match_result',
      title: 'Match Result Updated',
      message: 'Great job! You won your match against Mike Thompson 6-4, 6-2',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      actionUrl: '/dashboard?tab=matches',
      metadata: { matchId: '124', result: 'won' }
    },
    {
      id: '3',
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: 'Congratulations! You\'ve achieved a 3-match winning streak',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      metadata: { achievement: '3-match-streak' }
    },
    {
      id: '4',
      type: 'match_suggestion',
      title: 'New Match Suggestions',
      message: '3 new players found that match your skill level and preferences',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      actionUrl: '/dashboard?tab=matching',
      metadata: { suggestionsCount: 3 }
    },
    {
      id: '5',
      type: 'league_update',
      title: 'League Standings Updated',
      message: 'You\'ve moved up to #4 in the Summer League standings!',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      actionUrl: '/dashboard?tab=competition',
      metadata: { newRank: 4, previousRank: 6 }
    },
    {
      id: '6',
      type: 'general',
      title: 'System Maintenance',
      message: 'Scheduled maintenance will occur tonight from 2-4 AM',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    },
    {
      id: '7',
      type: 'match_scheduled',
      title: 'Match Reminder',
      message: 'Don\'t forget about your match with John Smith in 2 hours',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18), // 18 hours ago
      actionUrl: '/dashboard?tab=matches',
    },
    {
      id: '8',
      type: 'achievement',
      title: 'New Badge Earned',
      message: 'You\'ve earned the "Active Player" badge for playing 10+ matches',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    },
    {
      id: '9',
      type: 'league_update',
      title: 'New Tournament',
      message: 'Summer Championship registration is now open!',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      actionUrl: '/dashboard?tab=register',
    }
  ], []);

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
      // Check for duplicates based on title and message to prevent real-time duplicates
      const isDuplicate = prev.some(n => 
        n.title === newNotification.title && 
        n.message === newNotification.message &&
        Math.abs(n.createdAt.getTime() - newNotification.createdAt.getTime()) < 5000 // 5 second window
      );
      
      if (isDuplicate) return prev;
      
      const newList = [newNotification, ...prev];
      // Update unread count in the same state update to prevent race conditions
      updateUnreadCount(newList);
      return newList;
    });
  }, [updateUnreadCount]);

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

      const transformedNotifications = (data || []).map(notif => ({
        id: notif.id,
        type: notif.type as Notification['type'],
        title: notif.title,
        message: notif.message,
        read: notif.read,
        createdAt: new Date(notif.created_at),
        actionUrl: notif.action_url,
        metadata: notif.metadata
      }));

      // Update both notifications and unread count atomically
      setNotifications(transformedNotifications);
      updateUnreadCount(transformedNotifications);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Fall back to mock notifications if real ones fail
      const mockNotifications = generateMockNotifications();
      setNotifications(mockNotifications);
      updateUnreadCount(mockNotifications);
      hasLoadedRef.current = true;
    } finally {
      setIsLoading(false);
    }
  }, [user, generateMockNotifications, updateUnreadCount]);

  // Initial fetch and real-time subscription setup
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    fetchNotifications();

    // Set up real-time subscription for notifications
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
          console.log('🔔 Real-time notification INSERT:', payload);
          console.log('📊 hasLoadedRef.current:', hasLoadedRef.current);
          // Only add notification if we've already loaded initial notifications
          if (hasLoadedRef.current && payload.new) {
            const newNotif = {
              type: payload.new.type,
              title: payload.new.title,
              message: payload.new.message,
              read: false,
              actionUrl: payload.new.action_url,
              metadata: payload.new.metadata
            };
            
            console.log('✅ Adding new notification to UI:', newNotif.title);
            addNotification(newNotif);
            
            // Play notification sound
            playNotificationSound(0.5).catch(err => 
              console.warn('Failed to play notification sound:', err)
            );
            
            // Send browser notification if tab is not focused
            sendNotification(newNotif.title, {
              body: newNotif.message,
              tag: payload.new.id,
              requireInteraction: false,
            });
          } else {
            console.warn('⚠️ Skipping notification - not loaded yet or no payload');
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
          console.log('Real-time notification UPDATE:', payload);
          if (hasLoadedRef.current && payload.new) {
            setNotifications(prev => {
              const updated = prev.map(n => 
                n.id === payload.new.id
                  ? {
                      ...n,
                      read: payload.new.read,
                      title: payload.new.title,
                      message: payload.new.message
                    }
                  : n
              );
              updateUnreadCount(updated);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]); // Removed fetchNotifications and addNotification from deps to prevent infinite re-renders

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


  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const newNotifications = prev.filter(n => n.id !== notificationId);
      // Update unread count based on the new filtered list
      updateUnreadCount(newNotifications);
      return newNotifications;
    });
  }, [updateUnreadCount]);

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