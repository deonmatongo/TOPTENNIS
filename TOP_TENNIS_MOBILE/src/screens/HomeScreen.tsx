import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useMatches } from '@/hooks/useMatches';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format } from 'date-fns';
import { supabase } from '@/services/supabase';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const { upcoming, pendingReceived, loading: matchesLoading, refetch: refetchMatches } = useMatches();
  const { unreadCount } = useNotifications();

  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, skill_level, usta_rating, city, user_id, profile_picture_url')
        .ilike('name', `%${q}%`)
        .neq('user_id', user?.id || '')
        .limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchMatches()]);
    setRefreshing(false);
  };

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Player';

  const nextMatch = upcoming[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const skillLabel = (level?: number) => {
    if (!level) return 'Unrated';
    if (level < 3) return 'Beginner';
    if (level < 7) return 'Intermediate';
    return 'Advanced';
  };

  const winRate = profile?.wins && profile?.losses
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.nameText}>{fullName} 👋</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              {unreadCount > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Avatar name={fullName} size={38} imageUrl={profile?.profile_picture_url} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{profile?.wins ?? 0}</Text>
            <Text style={styles.statLbl}>Wins</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{profile?.losses ?? 0}</Text>
            <Text style={styles.statLbl}>Losses</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{winRate != null ? `${winRate}%` : '—'}</Text>
            <Text style={styles.statLbl}>Win Rate</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statPill}>
            <Text style={[styles.statNum, pendingReceived.length > 0 && { color: Colors.primary }]}>
              {pendingReceived.length}
            </Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
        </View>

        {/* Player Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search players..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {searching
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : searchQuery.length > 0
                ? <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
                  </TouchableOpacity>
                : null}
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              {searchResults.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.searchResultRow}
                  onPress={() => { setSearchQuery(''); setSearchResults([]); setSelectedPlayer(p); }}
                >
                  <Avatar name={p.name || '?'} size={36} imageUrl={p.profile_picture_url} />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{p.name}</Text>
                    <Text style={styles.searchResultMeta}>
                      {p.usta_rating ? `USTA ${p.usta_rating}` : p.skill_level ? `Level ${p.skill_level}/10` : ''}
                      {p.city ? `  ·  ${p.city}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Pending Invites */}
        {pendingReceived.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Match Invitations</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Matches')}>
                <Text style={styles.sectionAction}>See all</Text>
              </TouchableOpacity>
            </View>
            {pendingReceived.slice(0, 2).map(invite => {
              const senderName = invite.sender
                ? `${invite.sender.first_name} ${invite.sender.last_name}`.trim()
                : 'Unknown';
              return (
                <Card key={invite.id} elevated style={styles.inviteCard}>
                  <View style={styles.inviteRow}>
                    <Avatar name={senderName} size={42} imageUrl={invite.sender?.profile_picture_url} />
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteName}>{senderName}</Text>
                      <Text style={styles.inviteDetail}>
                        {format(new Date(invite.date), 'EEE, MMM d')} · {invite.start_time} – {invite.end_time}
                      </Text>
                      {invite.court_location && (
                        <Text style={styles.inviteLocation}>
                          <Ionicons name="location-outline" size={11} /> {invite.court_location}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.viewBtn}
                      onPress={() => navigation.navigate('Matches')}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Next Match */}
        {nextMatch && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Match</Text>
            <Card elevated style={styles.nextMatchCard}>
              <View style={styles.nextMatchTop}>
                <Badge label="Upcoming" variant="success" />
                <Text style={styles.nextMatchDate}>
                  {format(new Date(nextMatch.date), 'EEEE, MMMM d')}
                </Text>
              </View>
              <View style={styles.nextMatchPlayers}>
                <View style={styles.playerCol}>
                  <Avatar name={fullName} size={50} imageUrl={profile?.profile_picture_url} />
                  <Text style={styles.playerName}>You</Text>
                  <Text style={styles.playerSkill}>{skillLabel(profile?.skill_level)}</Text>
                </View>
                <View style={styles.vsCircle}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={styles.playerCol}>
                  {(() => {
                    const opponent = nextMatch.sender_id === user?.id ? nextMatch.receiver : nextMatch.sender;
                    const oppName = opponent ? `${opponent.first_name} ${opponent.last_name}`.trim() : 'Opponent';
                    return (
                      <>
                        <Avatar name={oppName} size={50} imageUrl={opponent?.profile_picture_url} />
                        <Text style={styles.playerName}>{oppName}</Text>
                        <Text style={styles.playerSkill}>{skillLabel(opponent?.skill_level)}</Text>
                      </>
                    );
                  })()}
                </View>
              </View>
              <View style={styles.nextMatchFooter}>
                <View style={styles.matchDetail}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.matchDetailText}>{nextMatch.start_time} – {nextMatch.end_time}</Text>
                </View>
                {nextMatch.court_location && (
                  <View style={styles.matchDetail}>
                    <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.matchDetailText}>{nextMatch.court_location}</Text>
                  </View>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'calendar-outline' as const, label: 'Schedule', screen: 'Schedule', color: Colors.primary },
              { icon: 'tennisball-outline' as const, label: 'Matches', screen: 'Matches', color: Colors.accent },
              { icon: 'people-outline' as const, label: 'Find Match', screen: 'CasualMatch', color: Colors.success },
              { icon: 'chatbubbles-outline' as const, label: 'Messages', screen: 'Messages', color: '#6366F1' },
              { icon: 'trophy-outline' as const, label: 'My Leagues', screen: 'MyLeagues', color: '#F59E0B' },
              { icon: 'document-text-outline' as const, label: 'Join League', screen: 'JoinLeague', color: '#8B5CF6' },
              { icon: 'share-social-outline' as const, label: 'Network', screen: 'Social', color: '#EC4899' },
              { icon: 'trending-up-outline' as const, label: 'Performance', screen: 'Performance', color: '#0EA5E9' },
            ].map(action => (
              <TouchableOpacity
                key={action.screen}
                style={styles.actionBtn}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Profile Completion Prompt */}
        {profile && !profile.skill_level && (
          <TouchableOpacity
            style={styles.profilePrompt}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <View style={styles.profilePromptInner}>
              <View style={styles.promptIcon}>
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.promptText}>
                <Text style={styles.promptTitle}>Complete your profile</Text>
                <Text style={styles.promptSub}>Add your skill level for better match suggestions</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PlayerProfileSheet
        player={selectedPlayer}
        visible={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing.xxxl },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  greetingBlock: {},
  greetingText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  nameText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginTop: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBtn: { position: 'relative', width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: Colors.error, borderRadius: 6,
    minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
  },
  notifDotText: { color: '#fff', fontSize: 8, fontWeight: FontWeight.bold },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statPill: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  statLbl: { fontSize: 10, color: Colors.textMuted, marginTop: 2, fontWeight: FontWeight.medium },
  statSep: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 4 },

  searchSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  searchDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  searchResultMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  sectionAction: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  inviteCard: { marginBottom: Spacing.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  inviteInfo: { flex: 1 },
  inviteName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  inviteDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  inviteLocation: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  viewBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  viewBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  nextMatchCard: { padding: Spacing.lg },
  nextMatchTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  nextMatchDate: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  nextMatchPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  playerCol: { alignItems: 'center', gap: 4 },
  playerName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  playerSkill: { fontSize: FontSize.xs, color: Colors.textMuted },
  vsCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1 },
  nextMatchFooter: { flexDirection: 'row', gap: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md },
  matchDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchDetailText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  actionBtn: { width: '21%', alignItems: 'center', gap: 6 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.medium, textAlign: 'center' },

  profilePrompt: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  profilePromptInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  promptIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: { flex: 1 },
  promptTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  promptSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
});
