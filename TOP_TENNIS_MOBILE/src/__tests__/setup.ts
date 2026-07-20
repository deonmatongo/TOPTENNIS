// Mock Supabase so tests never make real network calls
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
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

// Mock tamagui with RN primitives (plugin is excluded in test env via babel.config.js)
jest.mock('tamagui', () => {
  const React = require('react');
  const { View, Text: RNText } = require('react-native');
  const makeView = () => (props: any) => {
    const { children, testID, style } = props;
    return React.createElement(View, { testID, style }, children);
  };
  return {
    XStack: makeView(),
    YStack: makeView(),
    Text: (props: any) => {
      const { children, testID, style } = props;
      return React.createElement(RNText, { testID, style }, children);
    },
  };
});
