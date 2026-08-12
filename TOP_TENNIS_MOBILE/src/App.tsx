import React, { useEffect, useState } from 'react';
import { initSentry, wrapApp } from '@/services/sentry';
import { ErrorBoundary } from '@/components/ErrorBoundary';

initSentry();
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
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
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RealtimeConnectionProvider } from '@/contexts/RealtimeConnectionContext';
import { useMatches } from '@/hooks/useMatches';
import { useConversations } from '@/hooks/useConversations';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useOTAUpdate } from '@/hooks/useOTAUpdate';
import { registerBackgroundSync } from '@/tasks/backgroundSync';
import { useResponsive } from '@/hooks/useResponsive';
import { TabBar } from '@/components/navigation/TabBar';
import { navigationRef } from '@/navigation/navigationRef';

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { VerifyCodeScreen } from '@/screens/auth/VerifyCodeScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { VerifyResetCodeScreen } from '@/screens/auth/VerifyResetCodeScreen';
import { SetNewPasswordScreen } from '@/screens/auth/SetNewPasswordScreen';
import { AppIntroScreen } from '@/screens/AppIntroScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
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
import { AccountSection } from '@/screens/settings/AccountSection';
import { PrivacySection } from '@/screens/settings/PrivacySection';
import { NotificationsSection } from '@/screens/settings/NotificationsSection';
import { MatchPreferencesSection } from '@/screens/settings/MatchPreferencesSection';
import { AppPreferencesSection } from '@/screens/settings/AppPreferencesSection';
import { SupportSection } from '@/screens/settings/SupportSection';
import { SupportChatScreen } from '@/screens/settings/SupportChatScreen';

import { Colors, Font } from '@/theme/colors';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import * as SecureStore from 'expo-secure-store';

const INTRO_SEEN_KEY = 'toptennis_intro_seen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator({ initialRouteName }: { initialRouteName?: string } = {}) {
  const { pendingReceived } = useMatches();
  const { getTotalUnread } = useConversations();
  const { unreadCount } = useNotifications();
  usePushNotifications(unreadCount);
  const { isTablet, sidebarWidth } = useResponsive();
  const unreadMessages = getTotalUnread();

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
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
      <SettingsStack.Screen name="SupportChat" component={SupportChatScreen} options={{ animation: 'slide_from_right' }} />
    </SettingsStack.Navigator>
  );
}


function AppNavigator() {
  const { user, loading, pendingSignup } = useAuth();
  const { player, loading: playerLoading, refetch } = usePlayerProfile();
  const [justOnboarded, setJustOnboarded] = useState(false);

  // verifyOtp during signup creates a real session, which would otherwise flip
  // this navigator into the app and unmount VerifyCodeScreen before it can claim
  // the username. Keeping the auth stack mounted while a signup is pending is
  // what makes that step reliable.
  const inAuthFlow = !user || !!pendingSignup;

  // null = still loading from SecureStore
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  // Load persisted flags once on mount
  useEffect(() => {
    SecureStore.getItemAsync(INTRO_SEEN_KEY)
      .then(val => setIntroSeen(!!val))
      .catch(() => setIntroSeen(false));
  }, []);

  const markIntroDone = async () => {
    try {
      await SecureStore.setItemAsync(INTRO_SEEN_KEY, 'true');
    } catch { /* storage failure — intro still marked done in memory */ }
    setIntroSeen(true);
  };

  if (loading || introSeen === null || (user && playerLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!introSeen ? (
        <Stack.Screen name="AppIntro">
          {() => <AppIntroScreen onDone={markIntroDone} />}
        </Stack.Screen>
      ) : inAuthFlow ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
          <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} />
        </>
      ) : !player ? (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onComplete={() => { setJustOnboarded(true); refetch(); }} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Main">
          {() => <TabNavigator initialRouteName={justOnboarded ? 'Schedule' : undefined} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

// Password recovery is an in-app SMS code flow now, so there is no
// reset-password deep link to route and no recovery tokens arriving by URL.
const linking = {
  prefixes: ['toptennis://'],
  config: {
    screens: {
      Login: 'login',
    },
  },
};

const TextAny = Text as any;
TextAny.defaultProps = TextAny.defaultProps ?? {};
TextAny.defaultProps.style = { fontFamily: Font.regular };


function App() {
  useOTAUpdate();

  useEffect(() => {
    registerBackgroundSync().catch(() => {});
  }, []);
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <RealtimeConnectionProvider>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <StatusBar style="dark" />
                <AppNavigator />
                <NetworkBanner />
              </NavigationContainer>
            </RealtimeConnectionProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default wrapApp(App);

// ─── Global styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});


