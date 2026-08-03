import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

// Checks for an OTA update on every cold start (production only).
// If one is available, downloads and reloads immediately.
// In dev / Expo Go this is a no-op so it never interferes with local work.
export function useOTAUpdate() {
  useEffect(() => {
    if (__DEV__) return;
    checkForUpdate();
  }, []);
}

async function checkForUpdate() {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;

    await Updates.fetchUpdateAsync();
    Alert.alert(
      'Update Available',
      'A new version of Top Tennis has been downloaded. Restart now to apply it.',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
      ]
    );
  } catch {
    // Network error or update server unreachable — silent fail, never crash the app
  }
}
