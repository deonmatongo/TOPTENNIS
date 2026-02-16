import React, { createContext, useContext, useMemo } from 'react';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';
import { useMatchResponses } from '@/hooks/useMatchResponses';

type NotificationsContextType = ReturnType<typeof useNotificationsHook>;

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notifications = useNotificationsHook();
  const { pendingInvites } = useMatchResponses();

  const value = useMemo(() => {
    const pendingInvitesCount = pendingInvites?.length ?? 0;
    return {
      ...notifications,
      unreadCount: notifications.unreadCount + pendingInvitesCount,
    };
  }, [notifications, pendingInvites]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return ctx;
};
