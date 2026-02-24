import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useMatches } from '@/hooks/useMatches';
import { useMessages } from '@/hooks/useMessages';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';

import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { HomeScreen } from '@/screens/HomeScreen';
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

import { Colors } from '@/theme/colors';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { supabase } from '@/services/supabase';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { unreadCount: notifCount } = useNotifications();
  const { pendingReceived } = useMatches();
  const { conversations } = useMessages();
  const { pendingReceived: friendRequests } = useFriendRequests();
  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const totalSocialBadge = friendRequests.length;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          tabBarBadge: pendingReceived.length > 0 ? pendingReceived.length : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.primary, fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Matches"
        component={MatchesScreen}
        options={{
          tabBarLabel: 'Matches',
          tabBarIcon: ({ color, size }) => <Ionicons name="tennisball-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.primary, fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          tabBarBadge: (notifCount + totalSocialBadge) > 0 ? (notifCount + totalSocialBadge) : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 10 },
        }}
      />
    </Tab.Navigator>
  );
}

// Stack for the "More" tab — contains all extra sections
const MoreStack = createNativeStackNavigator();
function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Performance" component={PerformanceScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="MyLeagues" component={MyLeaguesScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="JoinLeague" component={JoinLeagueScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="CasualMatch" component={CasualMatchScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Social" component={SocialScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Dashboard" component={DashboardScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="ManageBookings" component={ManageBookingsScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Competition" component={CompetitionScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
    </MoreStack.Navigator>
  );
}

// More Menu Screen — mirrors the web sidebar
function MoreMenuScreen({ navigation }: { navigation: any }) {
  const { unreadCount: notifCount } = useNotifications();
  const { pendingReceived: friendRequests } = useFriendRequests();
  const { player } = usePlayerProfile();
  const { signOut } = useAuth();

  const items = [
    { label: 'Dashboard', sub: 'Overview & quick actions', icon: 'grid-outline', screen: 'Dashboard', badge: 0, color: Colors.primary },
    { label: 'My Profile', sub: 'Personal settings & stats', icon: 'person-outline', screen: 'Profile', badge: 0, color: Colors.primary },
    { label: 'My Performance', sub: 'Stats & analytics', icon: 'trending-up-outline', screen: 'Performance', badge: 0, color: Colors.accent },
    { label: 'My Leagues', sub: 'League history & progress', icon: 'trophy-outline', screen: 'MyLeagues', badge: 0, color: '#F59E0B' },
    { label: 'Join a League', sub: 'League registration', icon: 'document-text-outline', screen: 'JoinLeague', badge: 0, color: '#8B5CF6' },
    { label: 'Casual Match', sub: 'Find an opponent', icon: 'people-outline', screen: 'CasualMatch', badge: 0, color: Colors.success },
    { label: 'Build Your Network', sub: 'Friends & connections', icon: 'share-social-outline', screen: 'Social', badge: friendRequests.length, color: '#EC4899' },
    { label: 'Notifications', sub: 'Updates & alerts', icon: 'notifications-outline', screen: 'Notifications', badge: notifCount, color: Colors.error },
    { label: 'Notification Settings', sub: 'Manage your alerts', icon: 'settings-outline', screen: 'NotificationSettings', badge: 0, color: Colors.textSecondary },
    { label: 'Manage Bookings', sub: 'All match invitations', icon: 'calendar-outline', screen: 'ManageBookings', badge: 0, color: '#3b82f6' },
    { label: 'Competition', sub: 'Rankings & league standings', icon: 'trophy-outline', screen: 'Competition', badge: 0, color: '#f59e0b' },
    { label: 'Settings', sub: 'Privacy, preferences & more', icon: 'settings-outline', screen: 'Settings', badge: 0, color: Colors.textSecondary },
  ];

  const subtitle = player?.usta_rating
    ? `USTA ${player.usta_rating}`
    : player?.skill_level
    ? `Level ${player.skill_level}/10`
    : 'Complete your profile';

  return (
    <SafeAreaView style={moreStyles.safe} edges={['bottom']}>
      <ScreenHeader title={player?.name || 'My Account'} subtitle={subtitle} />
      <ScrollView style={moreStyles.list} showsVerticalScrollIndicator={false}>
        {items.map(item => (
          <TouchableRow
            key={item.screen}
            onPress={() => navigation.navigate(item.screen)}
            icon={item.icon}
            label={item.label}
            sub={item.sub}
            badge={item.badge}
            color={item.color}
          />
        ))}
        <View style={moreStyles.divider} />
        <TouchableRow
          onPress={signOut}
          icon="log-out-outline"
          label="Sign Out"
          sub=""
          badge={0}
          color={Colors.error}
          danger
        />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TouchableRow({ onPress, icon, label, sub, badge, color, danger }: any) {
  return (
    <TouchableOpacity style={moreStyles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[moreStyles.menuIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={danger ? Colors.error : color} />
      </View>
      <View style={moreStyles.menuText}>
        <Text style={[moreStyles.menuLabel, danger && { color: Colors.error }]}>{label}</Text>
        {sub ? <Text style={moreStyles.menuSub}>{sub}</Text> : null}
      </View>
      <View style={moreStyles.menuRight}>
        {badge > 0 && (
          <View style={moreStyles.badge}>
            <Text style={moreStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
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
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Schedule"
            component={ScheduleScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CasualMatch"
            component={CasualMatchScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="MyLeagues"
            component={MyLeaguesScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="JoinLeague"
            component={JoinLeagueScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Performance"
            component={PerformanceScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Social"
            component={SocialScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ManageBookings"
            component={ManageBookingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Competition"
            component={CompetitionScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
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

export default function App() {
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

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="dark" />
          <AppNavigator />
          <NetworkBanner />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});

const moreStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 14 },
  menuIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: Colors.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  divider: { height: 8, backgroundColor: Colors.background },
});
