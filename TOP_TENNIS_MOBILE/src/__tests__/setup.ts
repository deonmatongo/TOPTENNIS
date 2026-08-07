// Mock Supabase so tests never make real network calls
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithPassword: jest.fn(),
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      setSession: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn(),
      updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      // Proper thenable so `await supabase.from(...).select().eq(...)` resolves.
      then: jest.fn((resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject)),
    }),
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
  },
}));

// Mock Sentry so it never initialises in tests
jest.mock('@/services/sentry', () => ({
  initSentry: jest.fn(),
  captureError: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-font
jest.mock('expo-font', () => ({ isLoaded: jest.fn(() => true), loadAsync: jest.fn() }));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
}), { virtual: true });

// Mock expo-file-system (legacy API) + expo-sharing for data export
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

// Mock expo-av (sound effects)
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: { replayAsync: jest.fn().mockResolvedValue(undefined), unloadAsync: jest.fn().mockResolvedValue(undefined) },
      }),
    },
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: any) => React.createElement(View, { testID: props.testID, style: props.style }, props.children) };
});

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// Mock react-native-reanimated (drives all dashboard entrance/press animations)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock react-native-svg with lightweight RN views so the ProgressRing renders
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = (name: string) => {
    const C = ({ children }: any) => React.createElement(View, null, children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: Passthrough('Svg'),
    Svg: Passthrough('Svg'),
    Circle: Passthrough('Circle'),
    Defs: Passthrough('Defs'),
    LinearGradient: Passthrough('SvgLinearGradient'),
    Stop: Passthrough('Stop'),
    Path: Passthrough('Path'),
    G: Passthrough('G'),
    Rect: Passthrough('Rect'),
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

