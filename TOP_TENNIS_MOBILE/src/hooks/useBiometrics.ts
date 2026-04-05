import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

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
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) return;

      setAvailable(true);

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('faceid');
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
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

    const result = await LocalAuthentication.authenticateAsync({
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
    saveCredentials,
    clearCredentials,
  };
};
