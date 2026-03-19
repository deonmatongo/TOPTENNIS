import { useGlobalPresence } from './useGlobalPresence';

/**
 * Legacy wrapper for useOnlinePresence to maintain backward compatibility.
 * This now uses the global presence manager for better stability and performance.
 */
export const useOnlinePresence = () => {
  const { onlineUserIds, stableOnlineUserIds, isOnline } = useGlobalPresence();
  
  return { onlineUserIds, stableOnlineUserIds, isOnline };
};
