import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// VAPID public key — must match the private key used in the Edge Function.
// Generated once; rotate both keys together and redeploy the Edge Function.
const VAPID_PUBLIC_KEY = 'BCepmTz4SJSYIMfo1thaqH_-lPXRtzInBVfQlkzQzaCNCFZHWfa2zAiM60mCPY2-5AKBuLvzcYlAkWUMOtQuCdk';

// Convert a URL-safe base64 VAPID public key to a Uint8Array accepted by
// PushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

/**
 * Registers the service worker, subscribes this browser to Web Push, and
 * persists the PushSubscription in Supabase so the Edge Function can fan out
 * push messages to all of the user's devices.
 *
 * No UI is rendered — this hook is purely infrastructure.
 */
export const usePushSubscription = () => {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  const subscribe = useCallback(async () => {
    if (!user) return;
    if (registeredRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.info('[push] Web Push not supported in this browser — skipping.');
      return;
    }

    // Only attempt if the user has already granted notification permission
    // (the UI permission prompt is handled elsewhere via useBrowserNotifications).
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      // Register (or reuse) the service worker
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Wait for the SW to be active before subscribing
      await navigator.serviceWorker.ready;

      // Check for an existing subscription first to avoid creating duplicates
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        console.warn('[push] PushSubscription is missing required fields — not persisting.');
        return;
      }

      // Upsert (insert or update on conflict) the subscription in Supabase.
      // The unique constraint is (user_id, endpoint) so re-subscribing refreshes
      // the keys without creating a duplicate row.
      const { error } = await (supabase as any)
        .from('push_subscriptions')
        .upsert(
          {
            user_id:    user.id,
            endpoint:   json.endpoint,
            p256dh:     json.keys.p256dh,
            auth:       json.keys.auth,
            user_agent: navigator.userAgent.slice(0, 255),
          },
          { onConflict: 'user_id,endpoint' },
        );

      if (error) {
        console.error('[push] Failed to persist subscription:', error);
      } else {
        registeredRef.current = true;
        console.info('[push] Push subscription registered for user', user.id);
      }
    } catch (err) {
      // Common cause: user revoked permission or browser blocks SW registration.
      console.warn('[push] Subscription failed:', err);
    }
  }, [user]);

  // Re-run when the user logs in or notification permission is granted
  useEffect(() => {
    subscribe();
  }, [subscribe]);

  // Also subscribe when notification permission changes (user grants it mid-session)
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    const check = async () => {
      const status = await navigator.permissions.query({ name: 'notifications' });
      status.addEventListener('change', () => {
        if (status.state === 'granted') {
          registeredRef.current = false; // allow re-registration
          subscribe();
        }
      });
    };
    check();
  }, [subscribe]);

  /**
   * Removes all push subscriptions for the current user from Supabase and
   * unsubscribes the browser.  Call on logout or in settings.
   */
  const unsubscribe = useCallback(async () => {
    if (!user) return;
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
      }
      await (supabase as any)
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      registeredRef.current = false;
      console.info('[push] Push subscription removed for user', user.id);
    } catch (err) {
      console.warn('[push] Unsubscribe failed:', err);
    }
  }, [user]);

  return { subscribe, unsubscribe };
};
