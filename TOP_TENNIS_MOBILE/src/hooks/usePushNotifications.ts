import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { navigationRef } from '@/navigation/navigationRef';

function getExpoNotifications() {
  try { return require('expo-notifications') as typeof import('expo-notifications'); } catch { return null; }
}

export function usePushNotifications(unreadCount: number) {
  const { user } = useAuth();

  // Configure how notifications are presented while the app is in the foreground
  useEffect(() => {
    const Notifs = getExpoNotifications();
    if (!Notifs) return;
    Notifs.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  // Request push permissions and save the Expo push token to the user's profile
  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    const Notifs = getExpoNotifications();
    if (!Notifs) return;

    (async () => {
      const { status: existing } = await Notifs.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifs.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifs.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifs.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF8C00',
        });
      }

      try {
        const token = (await Notifs.getExpoPushTokenAsync()).data;
        if (token) {
          await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
        }
      } catch {
        // getExpoPushTokenAsync can fail in Expo Go without an EAS projectId — safe to ignore
      }
    })();
  }, [user]);

  // Keep the app icon badge in sync with unread notification count
  useEffect(() => {
    const Notifs = getExpoNotifications();
    if (!Notifs) return;
    Notifs.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);

  // Navigate to the relevant screen when the user taps a push notification
  useEffect(() => {
    const Notifs = getExpoNotifications();
    if (!Notifs) return;

    const sub = Notifs.addNotificationResponseReceivedListener(response => {
      const type = response.notification.request.content.data?.type as string | undefined;
      if (!navigationRef.isReady()) return;
      switch (type) {
        case 'match_invite':
        case 'match_rescheduled':
        case 'score_reminder':
          navigationRef.navigate('Schedule' as never);
          break;
        case 'match_accepted':
        case 'match_declined':
        case 'match_result':
          navigationRef.navigate('Matches' as never);
          break;
        case 'message_received':
          navigationRef.navigate('Messages' as never);
          break;
        default:
          navigationRef.navigate('Home' as never);
          break;
      }
    });

    return () => sub.remove();
  }, []);
}
