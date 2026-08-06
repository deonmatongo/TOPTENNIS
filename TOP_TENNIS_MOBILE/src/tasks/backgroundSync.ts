import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/services/supabase';

export const BACKGROUND_SYNC_TASK = 'toptennis-background-sync';

// Runs every ~15 minutes when the app is killed or backgrounded.
// Fetches unread notification count so the badge stays current.
// The OS controls the exact interval — iOS typically enforces 15 min minimum.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { data } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('read', false);

    // No push/badge update here — just keeping the session alive and confirming
    // DB reachability so the next foreground launch is faster.
    return data !== null
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return; // User or OS has disabled background fetch — respect it silently
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes — iOS enforces this as a minimum anyway
      stopOnTerminate: false,   // keep running after app is killed (Android)
      startOnBoot: true,        // re-register after device reboot (Android)
    });
  }
}
