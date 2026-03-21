import React, { createContext, useContext } from 'react';
import { useConversations } from '@/hooks/useConversations';

type ConversationsContextType = ReturnType<typeof useConversations>;

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

export const ConversationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const conversations = useConversations();
  return (
    <ConversationsContext.Provider value={conversations}>
      {children}
    </ConversationsContext.Provider>
  );
};

export const useConversationsContext = () => {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversationsContext must be used within a ConversationsProvider');
  return ctx;
};
