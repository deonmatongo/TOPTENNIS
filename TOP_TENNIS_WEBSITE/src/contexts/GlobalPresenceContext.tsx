/**
 * GlobalPresenceContext — singleton wrapper around useGlobalPresence.
 *
 * Mounted once at the app root (inside AuthProvider) so the Supabase Presence
 * channel lives for the entire session regardless of which tab the user is on.
 *
 * Before this context existed, the presence channel was created by
 * useGlobalPresence() inside FriendsMessagesTab, which meant:
 *   - Users appeared offline the moment they navigated away from
 *     "Build Your Network".
 *   - Their online status was never broadcast to other users on other tabs.
 */

import React, { createContext, useContext } from 'react';
import { useGlobalPresence } from '@/hooks/useGlobalPresence';

interface GlobalPresenceContextValue {
  isOnline: (userId: string) => boolean;
  onlineUserIds: Set<string>;
  stableOnlineUserIds: Set<string>;
  refreshPresence: () => void;
  isConnected: boolean;
}

const GlobalPresenceContext = createContext<GlobalPresenceContextValue>({
  isOnline: () => false,
  onlineUserIds: new Set(),
  stableOnlineUserIds: new Set(),
  refreshPresence: () => {},
  isConnected: false,
});

export const GlobalPresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const presence = useGlobalPresence();
  return (
    <GlobalPresenceContext.Provider value={presence}>
      {children}
    </GlobalPresenceContext.Provider>
  );
};

export const useGlobalPresenceContext = () => useContext(GlobalPresenceContext);
