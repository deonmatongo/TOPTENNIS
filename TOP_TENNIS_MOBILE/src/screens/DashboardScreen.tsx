import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useMatches } from '@/hooks/useMatches';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/Avatar';
import { Palette, Colors, Shadow, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';

const ACHIEVEMENTS = [
  { id: 'first_win', icon: 'trophy' as const, label: 'First Win', desc: 'Win your first match', color: '#f59e0b', condition: (w: number) => w >= 1 },
  { id: 'five_wins', icon: 'star' as const, label: 'Five Wins', desc: 'Win 5 matches', color: '#3b82f6', condition: (w: number) => w >= 5 },
  { id: 'ten_wins', icon: 'medal' as const, label: 'Ten Wins', desc: 'Win 10 matches', color: '#8b5cf6', condition: (w: number) => w >= 10 },
  { id: 'streak3', icon: 'flame' as const, label: 'On Fire', desc: '3-match win streak', color: '#ea580c', condition: (_w: number, _l: number, s: number) => s >= 3 },
  { id: 'league_rookie', icon: 'ribbon' as const, label: 'League Rookie', desc: 'Join your first league', color: '#10b981', condition: (_w: number, _l: number, _s: number, leagues: number) => leagues >= 1 },
];

const QUICK_ACTIONS = [
  { label: 'Schedule', icon: 'calendar-outline' as const, screen: 'Schedule', bg: '#FFF7ED', color: Palette.orange500 },
  { label: 'Matches', icon: 'tennisball-outline' as const, screen: 'Matches', bg: '#FEF2F2', color: '#ef4444' },
  { label: 'My Leagues', icon: 'trophy-outline' as const, screen: 'MyLeagues', bg: '#FEFCE8', color: '#f59e0b' },
  { label: 'Rankings', icon: 'podium-outline' as const, screen: 'Competition', bg: '#FFF7ED', color: Palette.orange600 },
  { label: 'Performance', icon: 'bar-chart-outline' as const, screen: 'Performance', bg: '#F5F3FF', color: '#8b5cf6' },
  { label: 'Social', icon: 'people-outline' as const, screen: 'Social', bg: '#EFF6FF', color: '#3b82f6' },
  { label: 'Messages', icon: 'chatbubble-outline' as const, screen: 'Messages', bg: '#F0FDF4', color: '#10b981' },
  { label: 'Settings', icon: 'settings-outline' as const, screen: 'Settings', bg: '#F8FAFC', color: Colors.textSecondary },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const SectionLabel: React.FC<{ text: string; onAction?: () => void; actionText?: string }> = ({ text, onAction, actionText }) => (
  <View style={s.sectionHead}>
    <Text style={s.sectionTitle}>{text}</Text>
    {onAction && <TouchableOpacity onPress={onAction}><Text style={s.sectionLink}>{actionText || 'View All'}</Text></TouchableOpacity>}
  </View>
);

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const { player, refetch: refetchPlayer } = usePlayerProfile();
  const { upcoming, pendingReceived, loading: matchesLoading, refetch: refetchMatches } = useMatches();
  const { registrations } = useLeagueRegistrations();
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchPlayer(), refetchMatches()]);
    setRefreshing(false);
  };

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 1) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, skill_level, usta_rating, city, profile_picture_url, user_id')
        .ilike('name', `%${q}%`)
        .neq('user_id', user?.id || '')
        .limit(15);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
  }, [user?.id]);

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Player';
  const avatarUrl = (profile as any)?.profile_picture_url ?? undefined;

  const wins = player?.wins ?? 0;
  const losses = player?.losses ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const streak = player?.current_streak ?? 0;

  const nextMatch = upcoming[0];
  const activeLeagues = registrations.filter(r => {
    const months = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
    return months < 3;
  });

  const unlockedAchievements = ACHIEVEMENTS.filter(a => a.condition(wins, losses, streak, registrations.length));
  const readinessScore = Math.min(100, (wins * 10) + (streak * 15) + (total > 0 ? 30 : 0));

  const loading = profileLoading || matchesLoading;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Hero card ── */}
        <LinearGradient
          colors={[Palette.dark900, Palette.dark700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          {/* Top row */}
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>{getGreeting()}</Text>
              <Text style={s.heroName}>{fullName}</Text>
              <View style={s.readinessRow}>
                <View style={[s.readinessDot, { backgroundColor: readinessScore >= 70 ? '#4ade80' : readinessScore >= 40 ? '#fbbf24' : '#f87171' }]} />
                <Text style={s.readinessTxt}>Match readiness {readinessScore}%</Text>
              </View>
            </View>
            <View style={s.heroRight}>
              <TouchableOpacity
                style={s.notifBtn}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={22} color="#fff" />
                {unreadCount > 0 && (
                  <View style={s.notifDot}>
                    <Text style={s.notifDotTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Avatar name={fullName} size={44} imageUrl={avatarUrl} style={s.heroAvatar} />
            </View>
          </View>

          {/* Stats strip */}
          <View style={s.statsStrip}>
            {[
              { val: wins, label: 'Wins' },
              { val: losses, label: 'Losses' },
              { val: `${winRate}%`, label: 'Win Rate' },
              { val: streak, label: 'Streak' },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <View style={s.statDiv} />}
                <View style={s.statItem}>
                  <Text style={s.statVal}>{stat.val}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Search bar */}
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.55)" />
            <TextInput
              style={s.searchInput}
              placeholder="Find a player..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />}
            {searchQuery.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Search results */}
        {(searchResults.length > 0 || (searchQuery.length > 0 && !searching)) && (
          <View style={s.searchResults}>
            {searchResults.length === 0 ? (
              <Text style={s.searchEmpty}>No players found for "{searchQuery}"</Text>
            ) : (
              searchResults.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={s.searchRow}
                  onPress={() => setSelectedPlayer(p)}
                  activeOpacity={0.8}
                >
                  <Avatar name={p.name || 'P'} size={40} imageUrl={p.profile_picture_url} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.searchName}>{p.name}</Text>
                    <View style={s.searchChips}>
                      {p.skill_level && <View style={s.searchChip}><Text style={s.searchChipTxt}>Level {p.skill_level}</Text></View>}
                      {p.city && <View style={s.searchChip}><Text style={s.searchChipTxt}>{p.city}</Text></View>}
                      {p.usta_rating && <View style={s.searchChip}><Text style={s.searchChipTxt}>USTA {p.usta_rating}</Text></View>}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={s.body}>
          {/* Pending invites alert */}
          {pendingReceived.length > 0 && (
            <TouchableOpacity style={s.alertCard} onPress={() => navigation.navigate('Matches')}>
              <View style={s.alertPip} />
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>{pendingReceived.length} pending match {pendingReceived.length === 1 ? 'invitation' : 'invitations'}</Text>
                <Text style={s.alertSub}>Tap to view and respond</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* Next Match */}
          <View style={s.section}>
            <SectionLabel text="Next Match" onAction={() => navigation.navigate('Schedule')} actionText="Schedule" />
            {matchesLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
            ) : nextMatch ? (
              <TouchableOpacity style={s.nextCard} onPress={() => navigation.navigate('Schedule')} activeOpacity={0.85}>
                <LinearGradient
                  colors={[Palette.dark800, Palette.dark600]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.nextCardGrad}
                >
                  <View style={s.nextIcon}>
                    <Ionicons name="tennisball" size={22} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nextOpponent}>
                      vs {nextMatch.sender
                        ? `${nextMatch.sender.first_name || ''} ${nextMatch.sender.last_name || ''}`.trim()
                        : nextMatch.receiver
                        ? `${nextMatch.receiver.first_name || ''} ${nextMatch.receiver.last_name || ''}`.trim()
                        : 'Opponent'}
                    </Text>
                    <View style={s.nextMeta}>
                      <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
                      <Text style={s.nextMetaTxt}>
                        {new Date(nextMatch.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                      {nextMatch.start_time && (
                        <>
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                          <Text style={s.nextMetaTxt}>{nextMatch.start_time}</Text>
                        </>
                      )}
                    </View>
                    {nextMatch.court_location && (
                      <View style={s.nextMeta}>
                        <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
                        <Text style={s.nextMetaTxt}>{nextMatch.court_location}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={s.emptyCard}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="calendar-outline" size={28} color={Colors.primary} />
                </View>
                <Text style={s.emptyTitle}>No upcoming matches</Text>
                <Text style={s.emptySub}>Schedule your next game</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Schedule')}>
                  <Text style={s.emptyBtnTxt}>Schedule a Match</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={s.section}>
            <SectionLabel text="Quick Actions" />
            <View style={s.quickGrid}>
              {QUICK_ACTIONS.map(a => (
                <TouchableOpacity
                  key={a.screen}
                  style={s.quickItem}
                  onPress={() => navigation.navigate(a.screen)}
                  activeOpacity={0.8}
                >
                  <View style={[s.quickIcon, { backgroundColor: a.bg }]}>
                    <Ionicons name={a.icon} size={22} color={a.color} />
                  </View>
                  <Text style={s.quickLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Active Leagues */}
          <View style={s.section}>
            <SectionLabel text="Active Leagues" onAction={() => navigation.navigate('MyLeagues')} />
            {activeLeagues.length === 0 ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="trophy-outline" size={28} color="#f59e0b" />
                </View>
                <Text style={s.emptyTitle}>No active leagues</Text>
                <Text style={s.emptySub}>Compete with players in your area</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('JoinLeague')}>
                  <Text style={s.emptyBtnTxt}>Browse Leagues</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeLeagues.slice(0, 3).map(reg => (
                <TouchableOpacity
                  key={reg.id}
                  style={s.leagueRow}
                  onPress={() => navigation.navigate('MyLeagues')}
                  activeOpacity={0.85}
                >
                  <View style={s.leagueBadge}>
                    <Ionicons name="trophy" size={18} color="#f59e0b" />
                  </View>
                  <Text style={s.leagueName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                  <View style={s.leagueActivePill}>
                    <Text style={s.leagueActiveTxt}>Active</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Achievements */}
          <View style={s.section}>
            <SectionLabel text="Achievements" onAction={() => navigation.navigate('Performance')} />
            <View style={s.achieveRow}>
              {ACHIEVEMENTS.map(a => {
                const unlocked = a.condition(wins, losses, streak, registrations.length);
                return (
                  <View key={a.id} style={[s.achieveItem, !unlocked && s.achieveLocked]}>
                    <View style={[s.achieveIcon, { backgroundColor: unlocked ? a.color + '20' : Colors.borderLight }]}>
                      <Ionicons name={a.icon} size={20} color={unlocked ? a.color : Colors.textMuted} />
                    </View>
                    <Text style={[s.achieveLabel, !unlocked && s.achieveLabelGray]} numberOfLines={1}>{a.label}</Text>
                    {!unlocked && <Text style={s.achieveSub}>{a.desc}</Text>}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Shortcuts */}
          <View style={s.shortcutsCard}>
            <TouchableOpacity style={s.shortcutRow} onPress={() => navigation.navigate('NotificationSettings')}>
              <View style={[s.shortcutIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={s.shortcutTxt}>Notification Settings</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <View style={s.shortcutDiv} />
            <TouchableOpacity style={s.shortcutRow} onPress={() => navigation.navigate('Profile')}>
              <View style={[s.shortcutIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="person-outline" size={18} color="#10b981" />
              </View>
              <Text style={s.shortcutTxt}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <PlayerProfileSheet
        player={selectedPlayer}
        visible={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 32 },

  // ── Hero ──
  hero: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  greeting: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', fontWeight: FontWeight.medium, marginBottom: 2 },
  heroName: { fontSize: 28, fontWeight: FontWeight.black, color: '#fff' },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessTxt: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Palette.dark900 },
  notifDotTxt: { fontSize: 9, color: '#fff', fontWeight: FontWeight.bold },
  heroAvatar: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },

  statsStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: '#fff' },
  statLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
  statDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },

  // ── Body ──
  body: { padding: Spacing.lg, gap: Spacing.xl },

  alertCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primaryMuted },
  alertPip: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  alertTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primaryDark },
  alertSub: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 1 },

  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // ── Next match card ──
  nextCard: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.md },
  nextCardGrad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  nextIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(249,115,22,0.18)', alignItems: 'center', justifyContent: 'center' },
  nextOpponent: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  nextMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  nextMetaTxt: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },

  // ── Empty state ──
  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceWarm, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 8, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  emptyBtnTxt: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },

  // ── Quick actions ──
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { width: '22%', alignItems: 'center', gap: 6 },
  quickIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center' },

  // ── Active leagues ──
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  leagueBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEFCE8', alignItems: 'center', justifyContent: 'center' },
  leagueName: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  leagueActivePill: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  leagueActiveTxt: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },

  // ── Achievements ──
  achieveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  achieveItem: { width: '18%', alignItems: 'center', gap: 4 },
  achieveLocked: { opacity: 0.4 },
  achieveIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  achieveLabel: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center' },
  achieveLabelGray: { color: Colors.textMuted },
  achieveSub: { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },

  // ── Shortcuts ──
  shortcutsCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  shortcutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  shortcutDiv: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.md },
  shortcutIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  shortcutTxt: { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },

  // ── Search ──
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, height: 44, marginTop: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: '#fff', paddingVertical: 0 },
  searchResults: { backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginTop: -2, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.md, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  searchChips: { flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  searchChip: { backgroundColor: Colors.backgroundAlt, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  searchChipTxt: { fontSize: 10, color: Colors.textSecondary },
  searchEmpty: { padding: Spacing.md, textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm },
});
