import React, { createContext, useContext } from 'react';
import { useMatchInvites } from '@/hooks/useMatchInvites';

type MatchInvitesContextType = ReturnType<typeof useMatchInvites>;

const MatchInvitesContext = createContext<MatchInvitesContextType | undefined>(undefined);

export const MatchInvitesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const matchInvites = useMatchInvites();
  return (
    <MatchInvitesContext.Provider value={matchInvites}>
      {children}
    </MatchInvitesContext.Provider>
  );
};

export const useMatchInvitesContext = () => {
  const ctx = useContext(MatchInvitesContext);
  if (!ctx) throw new Error('useMatchInvitesContext must be used within a MatchInvitesProvider');
  return ctx;
};
