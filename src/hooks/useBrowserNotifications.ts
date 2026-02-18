import { useEffect, useState, useCallback, useRef } from 'react';

export const useBrowserNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const notificationQueue = useRef<Array<{title: string, options?: NotificationOptions & { clickUrl?: string; respectFocus?: boolean }>>([]);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn('Notifications not supported in this browser');
      return 'denied';
    }

    try {
      // Request permission with better user experience
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Process any queued notifications
        notificationQueue.current.forEach(({ title, options }) => {
          sendNotification(title, options);
        });
        notificationQueue.current = [];
      }
      
      return result;
    } else {
      console.warn('Notification permission denied:', result);
      return result;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions & { clickUrl?: string; respectFocus?: boolean }) => {
    if (!isSupported) return;

    // Queue notification if permission not granted yet
    if (permission !== 'granted') {
      notificationQueue.current.push({ title, options });
      return;
    }

    // Check focus preference (default: always send)
    const shouldRespectFocus = options?.respectFocus !== false;
    if (shouldRespectFocus && !document.hidden) {
      return; // Don't send if tab is focused and user wants focus-aware notifications
    }
      
    try {
      const notification = new Notification(title, {
        requireInteraction: false,
        icon: '/favicon.ico',
        badge: '1',
        vibrate: [200, 100, 200],
        ...options,
      });

      // Handle notification click to focus window and navigate
      if (options?.clickUrl) {
        notification.onclick = () => {
          window.focus();
          window.location.href = options.clickUrl;
          notification.close();
        };
      } else {
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }

      // Auto-close after 5 seconds for better UX
      setTimeout(() => {
        if (notification.close) {
          notification.close();
        }
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Error sending browser notification:', error);
    }
  }, [permission, isSupported]);

  const clearNotificationQueue = useCallback(() => {
    notificationQueue.current = [];
  }, []);

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    clearNotificationQueue,
  };
};
