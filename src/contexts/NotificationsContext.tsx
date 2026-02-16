import React, { createContext, useContext } from 'react';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';

type NotificationsContextType = ReturnType<typeof useNotificationsHook>;

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notifications = useNotificationsHook();

  return (
    <NotificationsContext.Provider value={notifications}>
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
