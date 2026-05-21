import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useMatches } from '@/hooks/useMatches';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';
import { format } from 'date-fns';
import { supabase } from '@/services/supabase';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';

// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: 'calendar-outline'       as const, label: 'Schedule',   screen: 'Schedule',    color: Palette.orange500, bg: Palette.orange50  },
  { icon: 'tennisball-outline'     as const, label: 'Matches',    screen: 'Matches',     color: Palette.red500,    bg: Palette.redBg     },
  { icon: 'people-outline'         as const, label: 'Find',       screen: 'CasualMatch', color: Palette.green500,  bg: Palette.greenBg   },
  { icon: 'chatbubbles-outline'    as const, label: 'Messages',   screen: 'Messages',    color: Palette.blue500,   bg: Palette.blueBg    },
  { icon: 'trophy-outline'         as const, label: 'Leagues',    screen: 'MyLeagues',   color: Palette.yellow500, bg: Palette.yellowBg  },
  { icon: 'document-text-outline'  as const, label: 'Join',       screen: 'JoinLeague',  color: Palette.purple500, bg: Palette.purpleBg  },
  { icon: 'people-circle-outline'  as const, label: 'Network',    screen: 'Social',      color: Palette.pink500,   bg: Palette.pinkBg    },
  { icon: 'bar-chart-outline'      as const, label: 'Stats',      screen: 'Performance', color: Palette.blue600,   bg: Palette.blueBg    },
];

// ─────────────────────────────────────────────────────────────────────────────

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const { upcoming, pendingReceived, loading: matchesLoading, refetch: refetchMatches } = useMatches();
  const { unreadCount } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (q.trim().length < 1) { setResults([]); setSearching(false); return; }
    setSearching(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, skill_level, usta_rating, city, user_id, profile_picture_url')
        .ilike('name', `%${q}%`)
        .neq('user_id', user?.id || '')
        .limit(8);
      setResults(data || []);
      setSearching(false);
    }, 320);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchMatches()]);
    setRefreshing(false);
  };

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Player';
  const firstName = fullName.split(' ')[0];

  const wins    = profile?.wins    ?? 0;
  const losses  = profile?.losses  ?? 0;
  const total   = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
  const nextMatch = upcoming[0];

  const skillLabel = (level?: number) => {
    if (!level) return 'Unrated';
    if (level <= 3) return 'Beginner';
    if (level <= 6) return 'Intermediate';
    return 'Advanced';
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '☀️ Good morning' : hour < 17 ? '👋 Good afternoon' : '🌙 Good evening';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <View>
            <Text style={s.brandText}>Top<Text style={s.brandAccent}>Tennis</Text></Text>
          </View>
          <View style={s.topBarRight}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              {unreadCount > 0 && (
                <View style={s.notifPip}>
                  <Text style={s.notifPipText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
              <Avatar name={fullName} size={38} imageUrl={profile?.profile_picture_url} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Player card ──────────────────────────────────────────────── */}
        <View style={s.heroWrap}>
          <LinearGradient
            colors={[Palette.dark900, Palette.dark700, Palette.dark600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            {/* Tennis ball watermark */}
            <View style={s.ballWatermark} pointerEvents="none">
              <Ionicons name="tennisball" size={130} color="rgba(255,255,255,0.04)" />
            </View>

            <View style={s.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.greeting}>{greeting},</Text>
                <Text style={s.heroName}>{firstName}</Text>
              </View>
              <View style={s.levelBadge}>
                <Text style={s.levelBadgeText}>
                  {profile?.usta_rating ? `USTA ${profile.usta_rating}` : skillLabel(profile?.skill_level)}
                </Text>
              </View>
            </View>

            <View style={s.statsRow}>
              {[
                { value: wins,                              label: 'Wins'     },
                { value: losses,                            label: 'Losses'   },
                { value: winRate != null ? `${winRate}%` : '—', label: 'Win Rate' },
                { value: pendingReceived.length,            label: 'Pending', accent: pendingReceived.length > 0 },
              ].map((st, i, arr) => (
                <React.Fragment key={st.label}>
                  <View style={s.statCol}>
                    <Text style={[s.statNum, st.accent && s.statNumAccent]}>{st.value}</Text>
                    <Text style={s.statLbl}>{st.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={s.statDiv} />}
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ── Search ───────────────────────────────────────────────────── */}
        <View style={s.searchWrap}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={17} color={Colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search players by name..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={search}
              returnKeyType="search"
            />
            {searching
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : query.length > 0
              ? <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                  <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
                </TouchableOpacity>
              : null
            }
          </View>
          {results.length > 0 && (
            <View style={s.dropdown}>
              {results.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.dropRow, i < results.length - 1 && s.dropDivider]}
                  onPress={() => { setQuery(''); setResults([]); setSelectedPlayer(p); }}
                  activeOpacity={0.7}
                >
                  <Avatar name={p.name || '?'} size={36} imageUrl={p.profile_picture_url} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.dropName}>{p.name}</Text>
                    <Text style={s.dropMeta}>
                      {p.usta_rating ? `USTA ${p.usta_rating}` : p.skill_level ? `Level ${p.skill_level}/10` : 'Unrated'}
                      {p.city ? `  ·  ${p.city}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Invitations ──────────────────────────────────────────────── */}
        {pendingReceived.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Invitations</Text>
              <View style={s.sectionPill}>
                <Text style={s.sectionPillText}>{pendingReceived.length}</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => navigation.navigate('Matches')}>
                <Text style={s.seeAllText}>See all</Text>
                <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={s.inviteScroll}>
              {pendingReceived.map(inv => {
                const sender = inv.sender;
                const name = sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Unknown';
                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={s.inviteCard}
                    onPress={() => navigation.navigate('Matches')}
                    activeOpacity={0.85}
                  >
                    <View style={s.inviteCardTop}>
                      <Avatar name={name} size={44} imageUrl={sender?.profile_picture_url} />
                      <View style={s.inviteTypeBadge}>
                        <Text style={s.inviteTypeBadgeText}>{inv.is_league_match ? 'League' : 'Match'}</Text>
                      </View>
                    </View>
                    <Text style={s.inviteName} numberOfLines={1}>{name}</Text>
                    <Text style={s.inviteDate}>{format(new Date(inv.date), 'EEE, MMM d')}</Text>
                    <Text style={s.inviteTime}>{inv.start_time.slice(0, 5)}</Text>
                    {inv.court_location && (
                      <View style={s.inviteLocRow}>
                        <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
                        <Text style={s.inviteLoc} numberOfLines={1}>{inv.court_location}</Text>
                      </View>
                    )}
                    <View style={s.inviteRespondBtn}>
                      <Text style={s.inviteRespondText}>Respond</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Next match ───────────────────────────────────────────────── */}
        {nextMatch && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Next Match</Text>
              <View style={[s.sectionPill, s.sectionPillGreen]}>
                <View style={s.dotGreen} />
                <Text style={[s.sectionPillText, { color: Colors.success }]}>Confirmed</Text>
              </View>
            </View>

            <LinearGradient
              colors={[Palette.dark900, Palette.dark700]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.matchCard}
            >
              <Text style={s.matchDateLabel}>
                {format(new Date(nextMatch.date), 'EEEE, MMMM d')}
              </Text>

              <View style={s.playersRow}>
                {/* You */}
                <View style={s.playerCol}>
                  <View style={s.avatarRing}>
                    <Avatar name={fullName} size={60} imageUrl={profile?.profile_picture_url} />
                  </View>
                  <Text style={s.playerName} numberOfLines={1}>You</Text>
                  <Text style={s.playerSub}>{skillLabel(profile?.skill_level)}</Text>
                </View>

                {/* VS */}
                <View style={s.vsWrap}>
                  <LinearGradient colors={[Palette.orange500, Palette.orange600]} style={s.vsOrb}>
                    <Text style={s.vsText}>VS</Text>
                  </LinearGradient>
                  <Text style={s.matchTimeInline}>
                    {nextMatch.start_time.slice(0, 5)}
                  </Text>
                </View>

                {/* Opponent */}
                {(() => {
                  const opp = nextMatch.sender_id === user?.id ? nextMatch.receiver : nextMatch.sender;
                  const oppName = opp ? `${opp.first_name} ${opp.last_name}`.trim() : 'Opponent';
                  return (
                    <View style={s.playerCol}>
                      <View style={s.avatarRing}>
                        <Avatar name={oppName} size={60} imageUrl={opp?.profile_picture_url} />
                      </View>
                      <Text style={s.playerName} numberOfLines={1}>{oppName.split(' ')[0]}</Text>
                      <Text style={s.playerSub}>{skillLabel(opp?.skill_level)}</Text>
                    </View>
                  );
                })()}
              </View>

              {nextMatch.court_location && (
                <View style={s.matchLocRow}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.5)" />
                  <Text style={s.matchLocText}>{nextMatch.court_location}</Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Access</Text>
          <View style={s.grid}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity
                key={a.screen}
                style={s.gridItem}
                onPress={() => navigation.navigate(a.screen)}
                activeOpacity={0.75}
              >
                <View style={[s.gridIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={26} color={a.color} />
                </View>
                <Text style={s.gridLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Profile prompt ────────────────────────────────────────────── */}
        {profile && !profile.skill_level && (
          <View style={s.section}>
            <TouchableOpacity
              style={s.promptCard}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
            >
              <View style={[s.promptIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="person-circle-outline" size={28} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.promptTitle}>Complete your profile</Text>
                <Text style={s.promptSub}>Add your skill level for better matches</Text>
              </View>
              <View style={s.promptChevron}>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <PlayerProfileSheet
        player={selectedPlayer}
        visible={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  brandText: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.text, letterSpacing: -0.5 },
  brandAccent: { color: Colors.primary },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.xs,
  },
  notifPip: {
    position: 'absolute', top: 7, right: 7,
    minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5, borderColor: Colors.background,
  },
  notifPipText: { color: '#fff', fontSize: 8, fontWeight: FontWeight.black },

  // Hero card
  heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  ballWatermark: {
    position: 'absolute', right: -20, bottom: -20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: FontWeight.medium,
  },
  heroName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.black,
    color: '#fff',
    letterSpacing: -1,
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    ...Shadow.orange,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  statCol: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    color: '#fff',
    letterSpacing: -0.5,
  },
  statNumAccent: { color: Palette.yellow400 },
  statLbl: {
    fontSize: FontSize.xxs,
    color: 'rgba(255,255,255,0.50)',
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDiv: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 4,
  },

  // Search
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    zIndex: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginTop: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  dropDivider: { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  dropName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  dropMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  // Sections
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },
  sectionPill: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionPillGreen: { backgroundColor: Colors.successLight },
  sectionPillText: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  seeAllText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Invite cards (horizontal scroll)
  inviteScroll: { gap: Spacing.sm },
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
    ...Shadow.sm,
  },
  inviteCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  inviteTypeBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  inviteTypeBadgeText: { fontSize: FontSize.xxs, color: Colors.primary, fontWeight: FontWeight.bold },
  inviteName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  inviteDate: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  inviteTime: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.text, letterSpacing: -0.5 },
  inviteLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  inviteLoc: { fontSize: FontSize.xxs, color: Colors.textMuted, flex: 1 },
  inviteRespondBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 7,
    alignItems: 'center',
    ...Shadow.orange,
  },
  inviteRespondText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // Next match card
  matchCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  matchDateLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xl,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  playerCol: { alignItems: 'center', gap: 6, flex: 1 },
  avatarRing: {
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.20)',
    padding: 2,
  },
  playerName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fff',
    textAlign: 'center',
  },
  playerSub: {
    fontSize: FontSize.xxs,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  vsWrap: { alignItems: 'center', gap: 8, paddingHorizontal: Spacing.sm },
  vsOrb: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.orange,
  },
  vsText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: 1 },
  matchTimeInline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: FontWeight.bold,
  },
  matchLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingTop: Spacing.md,
  },
  matchLocText: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: FontWeight.medium,
    flex: 1,
  },

  // Quick actions grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridItem: {
    width: '21.5%',
    alignItems: 'center',
  },
  gridIcon: {
    width: 60, height: 60,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.xs,
  },
  gridLabel: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.1,
    marginTop: 7,
  },

  // Profile prompt
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primaryMuted,
    ...Shadow.xs,
  },
  promptIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  promptTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  promptSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  promptChevron: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
});
