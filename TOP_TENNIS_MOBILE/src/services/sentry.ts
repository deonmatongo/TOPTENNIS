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
      // Ties every event to a specific app version so the Releases page
      // shows crash-free rate trends per build.
      release: Constants.expoConfig?.version,
      dist: String(
        Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode ??
        '1'
      ),
    });
  } catch { /* Sentry unavailable — run without crash reporting */ }
}

// Wraps the root App component so Sentry can intercept unhandled JS errors
// and native crashes at the top of the call stack. Call once on the default export.
export function wrapApp<T>(AppComponent: T): T {
  const Sentry = getSentry();
  if (!Sentry) return AppComponent;
  try {
    return Sentry.wrap(AppComponent as any) as unknown as T;
  } catch {
    return AppComponent;
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) return;
  const Sentry = getSentry();
  if (!Sentry) return;
  try {
    // Scrub: only forward safe fields; never send full error objects that may
    // contain user input, request bodies, or other PII in their message/stack.
    const safe = error instanceof Error
      ? new Error(error.message.slice(0, 200))
      : new Error(String(error).slice(0, 200));
    if ((error as any)?.code) (safe as any).code = (error as any).code;
    if (context) Sentry.setContext('extra', context);
    Sentry.captureException(safe);
  } catch { /* no-op */ }
}

export function captureMessage(msg: string) {
  if (__DEV__) return;
  const Sentry = getSentry();
  if (!Sentry) return;
  try { Sentry.captureMessage(msg); } catch { /* no-op */ }
}

export function setUser(id: string) {
  const Sentry = getSentry();
  if (!Sentry) return;
  try { Sentry.setUser({ id }); } catch { /* no-op */ }
}

export function clearUser() {
  const Sentry = getSentry();
  if (!Sentry) return;
  try { Sentry.setUser(null); } catch { /* no-op */ }
}
