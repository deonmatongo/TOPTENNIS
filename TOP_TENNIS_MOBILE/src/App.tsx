import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useConversations } from '@/hooks/useConversations';
import { useFriendRequests } from '@/hooks/useFriendRequests';
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

import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow, Palette } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { supabase } from '@/services/supabase';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { unreadCount: notifCount } = useNotifications();
  const { pendingReceived } = useMatches();
  const { getTotalUnread } = useConversations();
  const { pendingReceived: friendRequests } = useFriendRequests();
  const unreadMessages = getTotalUnread();
  const totalSocialBadge = friendRequests.length;

  const TAB_ITEMS = [
    { name: 'Home',     label: 'Home',     icon: 'home',         iconOut: 'home-outline',         badge: 0                                        },
    { name: 'Schedule', label: 'Schedule', icon: 'calendar',     iconOut: 'calendar-outline',     badge: pendingReceived.length                   },
    { name: 'Matches',  label: 'Matches',  icon: 'tennisball',   iconOut: 'tennisball-outline',   badge: 0                                        },
    { name: 'Messages', label: 'Messages', icon: 'chatbubbles',  iconOut: 'chatbubbles-outline',  badge: unreadMessages                           },
    { name: 'More',     label: 'More',     icon: 'grid',         iconOut: 'grid-outline',         badge: notifCount + totalSocialBadge            },
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
                <View style={[tabStyles.pip, route.name === 'More' && tabStyles.pipRed]}>
                  <Text style={tabStyles.pipText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home"     component={DashboardScreen}    />
      <Tab.Screen name="Schedule" component={ScheduleScreen}/>
      <Tab.Screen name="Matches"  component={MatchesScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen}/>
      <Tab.Screen name="More"     component={MoreNavigator} />
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
      <MoreStack.Screen name="Messages" component={MessagesScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="ManageBookings" component={ManageBookingsScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Competition" component={CompetitionScreen} options={{ animation: 'slide_from_right' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
    </MoreStack.Navigator>
  );
}

// ─── More Menu Screen ─────────────────────────────────────────────────────────
function MoreMenuScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { unreadCount: notifCount } = useNotifications();
  const { pendingReceived: friendRequests } = useFriendRequests();
  const { player } = usePlayerProfile();
  const { signOut } = useAuth();

  const rating = player?.usta_rating
    ? `USTA ${player.usta_rating}`
    : player?.skill_level ? `Level ${player.skill_level}/10`
    : 'Unrated';

  type Item = { label: string; sub: string; icon: string; screen: string; badge: number; color: string; bg: string };
  type Group = { title: string; items: Item[] };

  const groups: Group[] = [
    {
      title: 'YOUR ACCOUNT',
      items: [
        { label: 'My Profile',    sub: 'Edit personal info',          icon: 'person-circle-outline',  screen: 'Profile',              badge: 0,                    color: Palette.purple500, bg: Palette.purpleBg  },
        { label: 'Performance',   sub: 'Match stats & analytics',     icon: 'bar-chart-outline',      screen: 'Performance',          badge: 0,                    color: Palette.blue500,   bg: Palette.blueBg    },
      ],
    },
    {
      title: 'PLAY',
      items: [
        { label: 'My Leagues',    sub: 'Active league standings',     icon: 'trophy-outline',         screen: 'MyLeagues',            badge: 0,                    color: Palette.yellow500, bg: Palette.yellowBg  },
        { label: 'Join a League', sub: 'Find & register',             icon: 'add-circle-outline',     screen: 'JoinLeague',           badge: 0,                    color: Palette.purple500, bg: Palette.purpleBg  },
        { label: 'Casual Match',  sub: 'Challenge someone nearby',    icon: 'tennisball-outline',     screen: 'CasualMatch',          badge: 0,                    color: Palette.green500,  bg: Palette.greenBg   },
        { label: 'Competition',   sub: 'Rankings & standings',        icon: 'podium-outline',         screen: 'Competition',          badge: 0,                    color: Palette.orange600, bg: Palette.orange50  },
        { label: 'Bookings',      sub: 'Manage match invitations',    icon: 'calendar-outline',       screen: 'ManageBookings',       badge: 0,                    color: Palette.blue500,   bg: Palette.blueBg    },
      ],
    },
    {
      title: 'COMMUNITY',
      items: [
        { label: 'My Network',    sub: 'Friends & connections',       icon: 'people-outline',         screen: 'Social',               badge: friendRequests.length, color: Palette.pink500,   bg: Palette.pinkBg    },
        { label: 'Notifications', sub: 'Updates & alerts',            icon: 'notifications-outline',  screen: 'Notifications',        badge: notifCount,            color: Palette.red500,    bg: Palette.redBg     },
      ],
    },
    {
      title: 'PREFERENCES',
      items: [
        { label: 'Alert Settings',sub: 'Manage notification types',   icon: 'options-outline',        screen: 'NotificationSettings', badge: 0,                    color: Palette.gray500,   bg: Palette.gray100   },
        { label: 'Settings',      sub: 'Privacy & preferences',       icon: 'settings-outline',       screen: 'Settings',             badge: 0,                    color: Palette.gray500,   bg: Palette.gray100   },
      ],
    },
  ];

  return (
    <SafeAreaView style={ms.safe} edges={[]}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Profile hero ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Palette.dark900, Palette.dark700, Palette.dark600]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[ms.hero, { paddingTop: insets.top + Spacing.md }]}
        >
          <View style={ms.heroInner}>
            <View style={ms.avatarWrap}>
              <Avatar name={player?.name || 'U'} size={64} />
              <View style={ms.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ms.heroName}>{player?.name || 'My Account'}</Text>
              <View style={ms.ratingRow}>
                <View style={ms.ratingBadge}>
                  <Ionicons name="tennisball" size={11} color={Colors.primary} />
                  <Text style={ms.ratingText}>{rating}</Text>
                </View>
                {(player?.wins !== undefined) && (
                  <Text style={ms.heroRecord}>{player.wins}W – {player.losses ?? 0}L</Text>
                )}
              </View>
            </View>
            <TouchableOpacity style={ms.editBtn} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
              <Ionicons name="pencil-outline" size={15} color="#fff" />
              <Text style={ms.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Menu groups ───────────────────────────────────────────────── */}
        {groups.map((group, gi) => (
          <View key={gi} style={ms.group}>
            <Text style={ms.groupLabel}>{group.title}</Text>
            <View style={ms.groupCard}>
              {group.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.screen}
                  style={[ms.row, idx < group.items.length - 1 && ms.rowDivider]}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.75}
                >
                  <View style={[ms.rowIcon, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon as any} size={19} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ms.rowLabel}>{item.label}</Text>
                    <Text style={ms.rowSub}>{item.sub}</Text>
                  </View>
                  <View style={ms.rowRight}>
                    {item.badge > 0 && (
                      <View style={[ms.pip, item.screen === 'Notifications' && ms.pipRed]}>
                        <Text style={ms.pipText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={14} color={Palette.gray300} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign out ─────────────────────────────────────────────────── */}
        <View style={ms.group}>
          <View style={ms.groupCard}>
            <TouchableOpacity style={ms.row} onPress={signOut} activeOpacity={0.75}>
              <View style={[ms.rowIcon, { backgroundColor: Palette.redBg }]}>
                <Ionicons name="log-out-outline" size={19} color={Palette.red500} />
              </View>
              <Text style={[ms.rowLabel, { color: Palette.red500 }]}>Sign Out</Text>
              <View style={ms.rowRight}>
                <Ionicons name="chevron-forward" size={14} color={Palette.gray300} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
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
  pipRed: { backgroundColor: Colors.error },
  pipText: { color: '#fff', fontSize: 8, fontWeight: FontWeight.black },
});

// ─── More Menu styles ─────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Hero
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 14, height: 14,
    borderRadius: 7,
    backgroundColor: Palette.green400,
    borderWidth: 2,
    borderColor: Palette.dark900,
  },
  heroName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    color: '#fff',
    letterSpacing: -0.4,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  ratingText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)', fontWeight: FontWeight.semibold },
  heroRecord: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.50)', fontWeight: FontWeight.medium },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  editBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Groups
  group: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  groupLabel: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.black,
    color: Palette.gray400,
    letterSpacing: 1.0,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    gap: Spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  rowSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pip: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  pipRed: { backgroundColor: Colors.error },
  pipText: { color: '#fff', fontSize: FontSize.xxs, fontWeight: FontWeight.black },
});
