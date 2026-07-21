import Constants from 'expo-constants';

// Sentry's native SDK isn't bundled into Expo Go, so we must not touch it there.
// executionEnvironment === 'storeClient' means we're running inside Expo Go.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Lazily resolve the SDK so merely importing this module never loads native code
// in an environment (Expo Go / tests) where it isn't available.
function getSentry(): typeof import('@sentry/react-native') | null {
  if (isExpoGo) return null;
  try {
    return require('@sentry/react-native');
  } catch {
    return null;
  }
}

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = getSentry();
  if (!Sentry) return;
  try {
    Sentry.init({
      dsn,
      enabled: !__DEV__,
      tracesSampleRate: 0.2,
      environment: __DEV__ ? 'development' : 'production',
    });
  } catch { /* Sentry unavailable — run without crash reporting */ }
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) return;
  const Sentry = getSentry();
  if (!Sentry) return;
  try {
    if (context) Sentry.setContext('extra', context);
    Sentry.captureException(error);
  } catch { /* no-op */ }
}

export function captureMessage(msg: string) {
  if (__DEV__) return;
  const Sentry = getSentry();
  if (!Sentry) return;
  try { Sentry.captureMessage(msg); } catch { /* no-op */ }
}

export function setUser(id: string, email?: string) {
  const Sentry = getSentry();
  if (!Sentry) return;
  try { Sentry.setUser({ id, email }); } catch { /* no-op */ }
}

export function clearUser() {
  const Sentry = getSentry();
  if (!Sentry) return;
  try { Sentry.setUser(null); } catch { /* no-op */ }
}
