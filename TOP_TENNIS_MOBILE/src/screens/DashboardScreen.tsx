import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useMatches } from '@/hooks/useMatches';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useNotifications } from '@/hooks/useNotifications';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

const ACHIEVEMENTS = [
  { id: 'first_win', icon: 'trophy' as const, label: 'First Win', desc: 'Win your first match', color: '#f59e0b', condition: (w: number) => w >= 1 },
  { id: 'five_wins', icon: 'star' as const, label: 'Five Wins', desc: 'Win 5 matches', color: '#3b82f6', condition: (w: number) => w >= 5 },
  { id: 'ten_wins', icon: 'medal' as const, label: 'Ten Wins', desc: 'Win 10 matches', color: '#8b5cf6', condition: (w: number) => w >= 10 },
  { id: 'streak3', icon: 'flame' as const, label: 'On Fire', desc: '3-match win streak', color: '#ea580c', condition: (_w: number, _l: number, s: number) => s >= 3 },
  { id: 'league_rookie', icon: 'ribbon' as const, label: 'League Rookie', desc: 'Join your first league', color: '#10b981', condition: (_w: number, _l: number, _s: number, leagues: number) => leagues >= 1 },
];

const QUICK_ACTIONS = [
  { label: 'Schedule', icon: 'calendar-outline' as const, screen: 'Schedule', color: Colors.primary },
  { label: 'Matches', icon: 'tennisball-outline' as const, screen: 'Matches', color: '#ea580c' },
  { label: 'My Leagues', icon: 'trophy-outline' as const, screen: 'MyLeagues', color: '#f59e0b' },
  { label: 'Rankings', icon: 'podium-outline' as const, screen: 'Competition', color: '#f59e0b' },
  { label: 'Performance', icon: 'bar-chart-outline' as const, screen: 'Performance', color: '#8b5cf6' },
  { label: 'Social', icon: 'people-outline' as const, screen: 'Social', color: '#3b82f6' },
  { label: 'Messages', icon: 'chatbubble-outline' as const, screen: 'Messages', color: '#10b981' },
  { label: 'Settings', icon: 'settings-outline' as const, screen: 'Settings', color: Colors.textSecondary },
];

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
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

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Player';

  const wins = player?.wins ?? 0;
  const losses = player?.losses ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const streak = player?.current_streak ?? 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const nextMatch = upcoming[0];
  const activeLeagues = registrations.filter(r => {
    const months = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
    return months < 3;
  });

  const unlockedAchievements = ACHIEVEMENTS.filter(a =>
    a.condition(wins, losses, streak, registrations.length)
  );

  const readinessScore = Math.min(100, (wins * 10) + (streak * 15) + (total > 0 ? 30 : 0));
  const readinessColor = readinessScore >= 70 ? Colors.success : readinessScore >= 40 ? '#f59e0b' : Colors.error;

  const loading = profileLoading || matchesLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={['#ea580c', '#f97316', '#fb923c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.heroName}>{fullName} 🎾</Text>
              <View style={styles.readinessRow}>
                <View style={[styles.readinessDot, { backgroundColor: readinessColor }]} />
                <Text style={styles.readinessText}>Match readiness: {readinessScore}%</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={24} color="rgba(255,255,255,0.9)" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Stat pills */}
          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNum}>{wins}</Text>
              <Text style={styles.heroPillLabel}>Wins</Text>
            </View>
            <View style={styles.heroPillDivider} />
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNum}>{losses}</Text>
              <Text style={styles.heroPillLabel}>Losses</Text>
            </View>
            <View style={styles.heroPillDivider} />
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNum}>{winRate}%</Text>
              <Text style={styles.heroPillLabel}>Win Rate</Text>
            </View>
            <View style={styles.heroPillDivider} />
            <View style={styles.heroPill}>
              <Text style={styles.heroPillNum}>{streak}</Text>
              <Text style={styles.heroPillLabel}>Streak</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Pending invites alert */}
          {pendingReceived.length > 0 && (
            <TouchableOpacity style={styles.alertCard} onPress={() => navigation.navigate('Matches')}>
              <View style={styles.alertDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>
                  {pendingReceived.length} pending match {pendingReceived.length === 1 ? 'invitation' : 'invitations'}
                </Text>
                <Text style={styles.alertSub}>Tap to view and respond</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* Next match */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Match</Text>
            {matchesLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
            ) : nextMatch ? (
              <TouchableOpacity style={styles.nextMatchCard} onPress={() => navigation.navigate('Schedule')}>
                <View style={styles.nextMatchIcon}>
                  <Ionicons name="tennisball" size={24} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextMatchOpponent}>
                    vs {nextMatch.sender
                      ? `${nextMatch.sender.first_name || ''} ${nextMatch.sender.last_name || ''}`.trim()
                      : nextMatch.receiver
                      ? `${nextMatch.receiver.first_name || ''} ${nextMatch.receiver.last_name || ''}`.trim()
                      : 'Opponent'}
                  </Text>
                  <View style={styles.nextMatchMeta}>
                    <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.nextMatchMetaText}>
                      {new Date(nextMatch.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    {nextMatch.start_time && (
                      <>
                        <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                        <Text style={styles.nextMatchMetaText}>{nextMatch.start_time}</Text>
                      </>
                    )}
                  </View>
                  {nextMatch.court_location && (
                    <View style={styles.nextMatchMeta}>
                      <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.nextMatchMetaText}>{nextMatch.court_location}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No upcoming matches</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Schedule')}>
                  <Text style={styles.emptyBtnText}>Schedule a Match</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickGrid}>
              {QUICK_ACTIONS.map(action => (
                <TouchableOpacity
                  key={action.screen}
                  style={styles.quickCard}
                  onPress={() => navigation.navigate(action.screen)}
                >
                  <View style={[styles.quickIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>
                  <Text style={styles.quickLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Active leagues */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Leagues</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyLeagues')}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            {activeLeagues.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="trophy-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No active leagues</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('JoinLeague')}>
                  <Text style={styles.emptyBtnText}>Browse Leagues</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeLeagues.slice(0, 3).map(reg => (
                <TouchableOpacity
                  key={reg.id}
                  style={styles.leagueRow}
                  onPress={() => navigation.navigate('MyLeagues')}
                >
                  <View style={styles.leagueRowIcon}>
                    <Ionicons name="trophy" size={18} color="#f59e0b" />
                  </View>
                  <Text style={styles.leagueRowName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                  <View style={styles.leagueRowBadge}>
                    <Text style={styles.leagueRowBadgeText}>Active</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Achievements */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Performance')}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.achievementsRow}>
              {ACHIEVEMENTS.map(a => {
                const unlocked = a.condition(wins, losses, streak, registrations.length);
                return (
                  <View key={a.id} style={[styles.achievementBadge, !unlocked && styles.achievementBadgeLocked]}>
                    <View style={[styles.achievementIcon, { backgroundColor: unlocked ? a.color + '20' : Colors.borderLight }]}>
                      <Ionicons name={a.icon} size={20} color={unlocked ? a.color : Colors.textMuted} />
                    </View>
                    <Text style={[styles.achievementLabel, !unlocked && styles.achievementLabelLocked]} numberOfLines={1}>
                      {a.label}
                    </Text>
                    {!unlocked && <Text style={styles.achievementLockText}>{a.desc}</Text>}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Settings shortcut */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => navigation.navigate('NotificationSettings')}>
            <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.settingsRowText}>Notification Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.settingsRowText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  hero: { paddingTop: Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  greeting: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', fontWeight: FontWeight.medium },
  heroName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#fff', marginTop: 2 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)' },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ea580c' },
  notifBadgeText: { fontSize: 9, color: '#fff', fontWeight: FontWeight.bold },
  heroPills: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.lg, padding: Spacing.md },
  heroPill: { flex: 1, alignItems: 'center', gap: 2 },
  heroPillNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#fff' },
  heroPillLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)' },
  heroPillDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 4 },

  content: { padding: Spacing.lg, gap: Spacing.lg },

  alertCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primaryMuted },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  alertTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primaryDark },
  alertSub: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 1 },

  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  sectionLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  nextMatchCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  nextMatchIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  nextMatchOpponent: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  nextMatchMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  nextMatchMetaText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickCard: { width: '30%', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: FontSize.xs, color: Colors.text, fontWeight: FontWeight.semibold, textAlign: 'center' },

  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  leagueRowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef9c3', alignItems: 'center', justifyContent: 'center' },
  leagueRowName: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  leagueRowBadge: { backgroundColor: '#dcfce7', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  leagueRowBadgeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },

  achievementsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  achievementBadge: { width: '18%', alignItems: 'center', gap: 4 },
  achievementBadgeLocked: { opacity: 0.45 },
  achievementIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  achievementLabel: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center' },
  achievementLabelLocked: { color: Colors.textMuted },
  achievementLockText: { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },

  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  settingsRowText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
});
