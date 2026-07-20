import React, { useEffect, useRef, useState } from 'react';
import { initSentry, setUser, clearUser } from '@/services/sentry';
import { ErrorBoundary } from '@/components/ErrorBoundary';

initSentry();
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../tamagui.config';
import { View, Text, ActivityIndicator, StyleSheet, Platform, Linking, AppState, AppStateStatus } from 'react-native';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CallProvider, useCallContext } from '@/contexts/CallContext';
import { CallScreen } from '@/screens/CallScreen';
import { IncomingCallOverlay } from '@/components/ui/IncomingCallOverlay';
import { useMatches } from '@/hooks/useMatches';
import { useConversations } from '@/hooks/useConversations';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useResponsive } from '@/hooks/useResponsive';
import { TabBar } from '@/components/navigation/TabBar';
import { navigationRef } from '@/navigation/navigationRef';

import { AuthScreen } from '@/screens/AuthScreen';
import { AppIntroScreen } from '@/screens/AppIntroScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { BiometricLockScreen } from '@/screens/BiometricLockScreen';
import { ScheduleScreen } from '@/screens/ScheduleScreen';
import { MatchesScreen } from '@/screens/MatchesScreen';
import { MessagesScreen } from '@/screens/MessagesScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { PerformanceScreen } from '@/screens/PerformanceScreen';
import { MyLeaguesScreen } from '@/screens/MyLeaguesScreen';
import { JoinLeagueScreen } from '@/screens/JoinLeagueScreen';
import { CasualMatchScreen } from '@/screens/CasualMatchScreen';
import { SocialScreen } from '@/screens/SocialScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen';
import { ManageBookingsScreen } from '@/screens/ManageBookingsScreen';
import { CompetitionScreen } from '@/screens/CompetitionScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { ResetPasswordScreen } from '@/screens/ResetPasswordScreen';
import { AccountSection } from '@/screens/settings/AccountSection';
import { PrivacySection } from '@/screens/settings/PrivacySection';
import { NotificationsSection } from '@/screens/settings/NotificationsSection';
import { MatchPreferencesSection } from '@/screens/settings/MatchPreferencesSection';
import { AppPreferencesSection } from '@/screens/settings/AppPreferencesSection';
import { SupportSection } from '@/screens/settings/SupportSection';

import { Colors, Font } from '@/theme/colors';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { supabase } from '@/services/supabase';
import * as SecureStore from 'expo-secure-store';
import { useBiometrics } from '@/hooks/useBiometrics';

const INTRO_SEEN_KEY = 'toptennis_intro_seen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { pendingReceived } = useMatches();
  const { getTotalUnread } = useConversations();
  const { unreadCount } = useNotifications();
  usePushNotifications(unreadCount);
  const { isTablet, sidebarWidth } = useResponsive();
  const unreadMessages = getTotalUnread();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      sceneContainerStyle={isTablet ? { marginLeft: sidebarWidth } : undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarBadge:
          route.name === 'Schedule' ? (pendingReceived.length || undefined) :
          route.name === 'Messages' ? (unreadMessages || undefined) :
          undefined,
      })}
    >
      <Tab.Screen name="Home"     component={HomeNavigator}     />
      <Tab.Screen name="Schedule" component={ScheduleScreen}    />
      <Tab.Screen name="Matches"  component={MatchesScreen}     />
      <Tab.Screen name="Messages" component={MessagesScreen}    />
      <Tab.Screen name="Settings" component={SettingsNavigator} />
    </Tab.Navigator>
  );
}

// Stack for the "Home" tab — Dashboard + all quick-action destinations (keeps tab bar visible)
const HomeStack = createNativeStackNavigator();
function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="Performance" component={PerformanceScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="MyLeagues" component={MyLeaguesScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="JoinLeague" component={JoinLeagueScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="CasualMatch" component={CasualMatchScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="Social" component={SocialScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="ManageBookings" component={ManageBookingsScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="Competition" component={CompetitionScreen} options={{ animation: 'slide_from_right' }} />
      <HomeStack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
    </HomeStack.Navigator>
  );
}

// Stack for the "Settings" tab
const SettingsStack = createNativeStackNavigator();
function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsRoot" component={SettingsScreen} />
      <SettingsStack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
      <SettingsStack.Screen name="AccountSection" component={AccountSection} options={{ animation: 'slide_from_right' }} />
      <SettingsStack.Screen name="PrivacySection" component={PrivacySection} options={{ animation: 'slide_from_right' }} />
      <SettingsStack.Screen name="NotificationsSection" component={NotificationsSection} options={{ animation: 'slide_from_right' }} />
      <SettingsStack.Screen name="MatchPreferencesSection" component={MatchPreferencesSection} options={{ animation: 'slide_from_right' }} />
      <SettingsStack.Screen name="AppPreferencesSection" component={AppPreferencesSection} options={{ animation: 'slide_from_right' }} />
      <SettingsStack.Screen name="SupportSection" component={SupportSection} options={{ animation: 'slide_from_right' }} />
    </SettingsStack.Navigator>
  );
}


function AppNavigator() {
  const { user, loading, signOut } = useAuth();
  const { player, loading: playerLoading, refetch } = usePlayerProfile();
  const { available } = useBiometrics();

  // null = still loading from SecureStore
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Load intro-seen flag once on mount
  useEffect(() => {
    SecureStore.getItemAsync(INTRO_SEEN_KEY).then(val => setIntroSeen(!!val));
  }, []);

  // Lock when app returns from background (only if user is logged in + biometrics available)
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev === 'background' && nextState === 'active' && available) {
        setIsLocked(true);
      }
    });
    return () => sub.remove();
  }, [user, available]);

  const markIntroDone = async () => {
    await SecureStore.setItemAsync(INTRO_SEEN_KEY, 'true');
    setIntroSeen(true);
  };

  const handleUnlock = () => setIsLocked(false);

  const handleSignOut = async () => {
    await signOut();
    setIsLocked(false);
  };

  // DEMO BYPASS — skip auth/intro/onboarding to preview UI
  // if (loading || introSeen === null || (user && playerLoading)) {
  //   return (
  //     <View style={styles.loading}>
  //       <ActivityIndicator size="large" color={Colors.primary} />
  //     </View>
  //   );
  // }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {false ? (
          <Stack.Screen name="AppIntro">
            {() => <AppIntroScreen onDone={markIntroDone} />}
          </Stack.Screen>
        ) : false ? (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : false ? (
          <Stack.Screen name="Onboarding">
            {() => <OnboardingScreen onComplete={refetch} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>

      {/* Biometric lock overlay — sits above all navigation */}
      {isLocked && user && (
        <BiometricLockScreen onUnlock={handleUnlock} onSignOut={handleSignOut} />
      )}
    </>
  );
}

const linking = {
  prefixes: ['toptennis://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Auth: 'auth',
    },
  },
};

const TextAny = Text as any;
TextAny.defaultProps = TextAny.defaultProps ?? {};
TextAny.defaultProps.style = { fontFamily: Font.regular };

// Renders incoming call banner + full CallScreen modal on top of all navigation
function CallOverlayManager() {
  const { incomingCall, activeCall, livekitToken, answerCall, declineCall, endCall } = useCallContext();

  return (
    <>
      {activeCall && livekitToken && (
        <CallScreen
          call={activeCall}
          token={livekitToken}
          onEnd={() => endCall(activeCall.id)}
        />
      )}
      {incomingCall && !activeCall && (
        <IncomingCallOverlay
          call={incomingCall}
          onAnswer={() => answerCall(incomingCall).catch(() => {})}
          onDecline={() => declineCall(incomingCall.id)}
        />
      )}
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        const hashParams = url.split('#')[1] || url.split('?')[1] || '';
        const params = Object.fromEntries(
          hashParams.split('&').map(p => p.split('=').map(decodeURIComponent))
        );
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        }
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SafeAreaProvider>
          <AuthProvider>
            <CallProvider>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <StatusBar style="dark" />
                <AppNavigator />
                <NetworkBanner />
                <CallOverlayManager />
              </NavigationContainer>
            </CallProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </TamaguiProvider>
    </ErrorBoundary>
  );
}

// ─── Global styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});


