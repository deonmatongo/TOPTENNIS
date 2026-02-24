import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;

    const checkConnectivity = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        if (mounted) {
          const online = res.status === 204 || res.ok;
          if (!online && isOnline) setWasOffline(true);
          if (online && wasOffline) setWasOffline(false);
          setIsOnline(online);
        }
      } catch {
        if (mounted) {
          setIsOnline(false);
          setWasOffline(true);
        }
      }
    };

    checkConnectivity();
    const interval = setInterval(checkConnectivity, 10000);

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        checkConnectivity();
      }
      appStateRef.current = next;
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [isOnline, wasOffline]);

  return { isOnline, wasOffline };
};
