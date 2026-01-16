import { useEffect, useState } from 'react';

export const useBrowserNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return 'denied';
  };

  const sendNotification = (title: string, options?: NotificationOptions & { clickUrl?: string; respectFocus?: boolean }) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const { clickUrl, respectFocus = false, ...notificationOptions } = options || {};
      
      // Only check focus if user prefers it (default: always send)
      if (respectFocus && !document.hidden) {
        return; // Don't send if tab is focused and user wants focus-aware notifications
      }
      
      const notification = new Notification(title, {
        requireInteraction: true,
        ...notificationOptions,
      });

      // Handle notification click to focus window and navigate
      if (clickUrl) {
        notification.onclick = () => {
          window.focus();
          window.location.href = clickUrl;
          notification.close();
        };
      } else {
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    }
  };

  return {
    permission,
    requestPermission,
    sendNotification,
  };
};
