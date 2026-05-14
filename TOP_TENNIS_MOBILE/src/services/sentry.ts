import * as Sentry from '@sentry/react-native';

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) return;
  if (context) Sentry.setContext('extra', context);
  Sentry.captureException(error);
}

export function captureMessage(msg: string) {
  if (__DEV__) return;
  Sentry.captureMessage(msg);
}

export function setUser(id: string, email?: string) {
  Sentry.setUser({ id, email });
}

export function clearUser() {
  Sentry.setUser(null);
}
