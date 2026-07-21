import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function getLocalAuth() {
  try { return require('expo-local-authentication') as typeof import('expo-local-authentication'); } catch { return null; }
}

const CREDS_KEY = 'toptennis_biometric_creds';

export interface StoredCredentials {
  email: string;
  password: string;
}

export const useBiometrics = () => {
  const [available, setAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'faceid' | 'fingerprint' | 'iris' | null>(null);
  const [credentialsStored, setCredentialsStored] = useState(false);

  useEffect(() => {
    const init = async () => {
      const LA = getLocalAuth();
      if (!LA) return;
      const compatible = await LA.hasHardwareAsync();
      const enrolled = await LA.isEnrolledAsync();
      if (!compatible || !enrolled) return;

      setAvailable(true);

      const types = await LA.supportedAuthenticationTypesAsync();
      // On iOS, default to Face ID — covers Face ID devices and ensures
      // the correct prompt message is shown even on Touch ID devices.
      if (Platform.OS === 'ios') {
        setBiometricType('faceid');
      } else if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('faceid');
      } else if (types.includes(LA.AuthenticationType.IRIS)) {
        setBiometricType('iris');
      } else {
        setBiometricType('fingerprint');
      }

      const stored = await SecureStore.getItemAsync(CREDS_KEY);
      setCredentialsStored(!!stored);
    };

    init();
  }, []);

  const authenticate = useCallback(async (): Promise<StoredCredentials | null> => {
    const promptMessage = biometricType === 'faceid'
      ? 'Sign in with Face ID'
      : biometricType === 'iris'
      ? 'Sign in with Iris'
      : 'Sign in with Fingerprint';

    const LA = getLocalAuth();
    if (!LA) return null;
    const result = await LA.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Password',
      disableDeviceFallback: false,
    });

    if (!result.success) return null;

    const raw = await SecureStore.getItemAsync(CREDS_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredCredentials;
    } catch {
      return null;
    }
  }, [biometricType]);

  const saveCredentials = useCallback(async (email: string, password: string) => {
    await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify({ email, password }));
    setCredentialsStored(true);
  }, []);

  const clearCredentials = useCallback(async () => {
    await SecureStore.deleteItemAsync(CREDS_KEY);
    setCredentialsStored(false);
  }, []);

  const verifyIdentity = useCallback(async (): Promise<boolean> => {
    const LA = getLocalAuth();
    if (!LA) return false;
    const promptMessage = biometricType === 'faceid' ? 'Unlock TopTennis'
      : biometricType === 'iris' ? 'Unlock with Iris'
      : 'Unlock with Fingerprint';
    const result = await LA.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Password',
      disableDeviceFallback: false,
    });
    return result.success;
  }, [biometricType]);

  const biometricLabel =
    biometricType === 'faceid' ? 'Face ID'
    : biometricType === 'iris' ? 'Iris'
    : 'Fingerprint';

  return {
    available,
    biometricType,
    biometricLabel,
    credentialsStored,
    authenticate,
    verifyIdentity,
    saveCredentials,
    clearCredentials,
  };
};
