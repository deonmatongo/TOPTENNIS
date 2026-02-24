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
import { LinearGradient } from 'expo-linear-gradient';
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

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg }) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Orange Gradient Hero Header */}
        <LinearGradient
          colors={Colors.gradientWarm}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.name}>{fullName} 👋</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color="rgba(255,255,255,0.9)" />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <Avatar name={fullName} size={40} style={styles.avatar} imageUrl={profile?.profile_picture_url} />
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{profile?.wins ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Wins</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{profile?.losses ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Losses</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{profile?.skill_level ?? '—'}</Text>
              <Text style={styles.heroStatLabel}>Skill</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{pendingReceived.length}</Text>
              <Text style={styles.heroStatLabel}>Pending</Text>
            </View>
          </View>
        </LinearGradient>


        {/* Pending Invites */}
        {pendingReceived.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Match Invitations</Text>
              <Badge label={`${pendingReceived.length} new`} variant="warning" />
            </View>
            {pendingReceived.slice(0, 2).map(invite => {
              const senderName = invite.sender
                ? `${invite.sender.first_name} ${invite.sender.last_name}`.trim()
                : 'Unknown';
              return (
                <Card key={invite.id} style={styles.inviteCard} elevated>
                  <View style={styles.inviteRow}>
                    <Avatar name={senderName} size={44} imageUrl={invite.sender?.profile_picture_url} />
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteName}>{senderName}</Text>
                      <Text style={styles.inviteDetail}>
                        {format(new Date(invite.date), 'EEE, MMM d')} · {invite.start_time} – {invite.end_time}
                      </Text>
                      {invite.court_location && (
                        <Text style={styles.inviteLocation}>
                          <Ionicons name="location-outline" size={12} /> {invite.court_location}
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
              <View style={styles.nextMatchBadgeRow}>
                <Badge label="Upcoming" variant="success" />
                <Text style={styles.nextMatchDate}>
                  {format(new Date(nextMatch.date), 'EEEE, MMMM d')}
                </Text>
              </View>
              <View style={styles.nextMatchPlayers}>
                <View style={styles.playerCol}>
                  <Avatar name={fullName} size={52} imageUrl={profile?.profile_picture_url} />
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
                        <Avatar name={oppName} size={52} imageUrl={opponent?.profile_picture_url} />
                        <Text style={styles.playerName}>{oppName}</Text>
                        <Text style={styles.playerSkill}>{skillLabel(opponent?.skill_level)}</Text>
                      </>
                    );
                  })()}
                </View>
              </View>
              <View style={styles.nextMatchFooter}>
                <View style={styles.nextMatchDetail}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.nextMatchDetailText}>
                    {nextMatch.start_time} – {nextMatch.end_time}
                  </Text>
                </View>
                {nextMatch.court_location && (
                  <View style={styles.nextMatchDetail}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.nextMatchDetailText}>{nextMatch.court_location}</Text>
                  </View>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* Player Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
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
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
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
                  <Avatar name={p.name || '?'} size={38} imageUrl={p.profile_picture_url} />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{p.name}</Text>
                    <Text style={styles.searchResultMeta}>
                      {p.usta_rating ? `USTA ${p.usta_rating}` : p.skill_level ? `Level ${p.skill_level}/10` : ''}
                      {p.city ? `  ·  ${p.city}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'calendar-outline' as const, label: 'Schedule', screen: 'Schedule', color: Colors.primary },
              { icon: 'tennisball-outline' as const, label: 'Matches', screen: 'Matches', color: Colors.accent },
              { icon: 'people-outline' as const, label: 'Find Match', screen: 'CasualMatch', color: Colors.success },
              { icon: 'chatbubbles-outline' as const, label: 'Messages', screen: 'Messages', color: Colors.info },
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
                <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Profile Completion Prompt */}
        {profile && !profile.skill_level && (
          <Card style={styles.profilePrompt}>
            <View style={styles.profilePromptRow}>
              <Ionicons name="information-circle-outline" size={22} color={Colors.info} />
              <View style={styles.profilePromptText}>
                <Text style={styles.profilePromptTitle}>Complete your profile</Text>
                <Text style={styles.profilePromptSub}>Add your skill level to get better match suggestions</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Card>
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

  heroBanner: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  headerLeft: { flex: 1 },
  greeting: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifBtn: { position: 'relative', padding: Spacing.xs },
  notifBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: Colors.error, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  notifBadgeText: { color: Colors.textInverse, fontSize: 9, fontWeight: FontWeight.bold },
  avatar: { marginLeft: Spacing.xs },

  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.lg, padding: Spacing.md },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  heroStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },

  statCard: {
    flex: 1, borderRadius: Radius.md, padding: Spacing.md,
    alignItems: 'center', gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },

  section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: Spacing.md },

  inviteCard: { marginBottom: Spacing.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  inviteInfo: { flex: 1 },
  inviteName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  inviteDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  inviteLocation: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  viewBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  viewBtnText: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  nextMatchCard: { padding: Spacing.lg },
  nextMatchBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  nextMatchDate: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  nextMatchPlayers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  playerCol: { alignItems: 'center', gap: Spacing.xs },
  playerName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  playerSkill: { fontSize: FontSize.xs, color: Colors.textMuted },
  vsCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  nextMatchFooter: { flexDirection: 'row', gap: Spacing.lg },
  nextMatchDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextMatchDetailText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { width: '22%', alignItems: 'center', gap: Spacing.xs },
  actionIcon: { width: 54, height: 54, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.medium, textAlign: 'center' },

  profilePrompt: { marginBottom: Spacing.lg, marginHorizontal: Spacing.lg },
  profilePromptRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  profilePromptText: { flex: 1 },
  profilePromptTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  profilePromptSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  searchSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 48 },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  searchDropdown: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginTop: 6, overflow: 'hidden' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  searchResultMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
});
