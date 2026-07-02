import React, { createContext, useContext } from 'react';
import { useMessages as useMessagesHook } from '@/hooks/useMessages';

type MessagesContextType = ReturnType<typeof useMessagesHook>;

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const messages = useMessagesHook();

  return (
    <MessagesContext.Provider value={messages}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessagesContext = () => {
  const ctx = useContext(MessagesContext);
  if (!ctx) {
    throw new Error('useMessagesContext must be used within a MessagesProvider');
  }
  return ctx;
};
