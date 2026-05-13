import React, { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../tamagui.config';
import { View, ActivityIndicator, StyleSheet, Text, Platform, Linking } from 'react-native';
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
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CallProvider, useCallContext } from '@/contexts/CallContext';
import { CallScreen } from '@/screens/CallScreen';
import { IncomingCallOverlay } from '@/components/ui/IncomingCallOverlay';
import { useMatches } from '@/hooks/useMatches';
import { useConversations } from '@/hooks/useConversations';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';

import { AuthScreen } from '@/screens/AuthScreen';
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
import { ResetPasswordScreen } from '@/screens/ResetPasswordScreen';

import { Colors, Font, FontWeight, Palette } from '@/theme/colors';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { supabase } from '@/services/supabase';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { pendingReceived } = useMatches();
  const { getTotalUnread } = useConversations();
  const unreadMessages = getTotalUnread();

  const TAB_ITEMS = [
    { name: 'Home',     label: 'Home',     icon: 'home',        iconOut: 'home-outline',        badge: 0                    },
    { name: 'Schedule', label: 'Schedule', icon: 'calendar',    iconOut: 'calendar-outline',    badge: pendingReceived.length },
    { name: 'Matches',  label: 'Matches',  icon: 'tennisball',  iconOut: 'tennisball-outline',  badge: 0                    },
    { name: 'Messages', label: 'Messages', icon: 'chatbubbles', iconOut: 'chatbubbles-outline', badge: unreadMessages        },
    { name: 'Settings', label: 'Settings', icon: 'settings',    iconOut: 'settings-outline',    badge: 0                    },
  ];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => {
          const item = TAB_ITEMS.find(t => t.name === route.name)!;
          return (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
              <Ionicons
                name={(focused ? item.icon : item.iconOut) as any}
                size={22}
                color={focused ? '#fff' : Palette.gray400}
              />
              {item.badge > 0 && (
                <View style={tabStyles.pip}>
                  <Text style={tabStyles.pipText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              )}
            </View>
          );
        },
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
    </SettingsStack.Navigator>
  );
}


function AppNavigator() {
  const { user, loading } = useAuth();
  const { player, loading: playerLoading, refetch } = usePlayerProfile();

  if (loading || (user && playerLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : !player ? (
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
          onAnswer={() => answerCall(incomingCall)}
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
    <TamaguiProvider config={tamaguiConfig}>
      <SafeAreaProvider>
        <AuthProvider>
          <CallProvider>
            <NavigationContainer linking={linking}>
              <StatusBar style="dark" />
              <AppNavigator />
              <NetworkBanner />
              <CallOverlayManager />
            </NavigationContainer>
          </CallProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </TamaguiProvider>
  );
}

// ─── Global styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});

// ─── Tab bar styles ───────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 82 : 66,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 8,
    shadowColor: 'rgba(13,13,24,0.12)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 18,
  } as any,
  iconWrap: {
    width: 48,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Palette.orange500,
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pip: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  pipText: { color: '#fff', fontSize: 8, fontFamily: Font.black },
});

