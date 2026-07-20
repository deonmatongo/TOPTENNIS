import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { MatchInviteResponseModal } from '@/components/ui/MatchInviteResponseModal';
import { CasualMatchScoringModal } from '@/components/ui/CasualMatchScoringModal';
import { ProposeNewTimeModal } from '@/components/ui/ProposeNewTimeModal';
import { useCalendarExport } from '@/hooks/useCalendarExport';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, Font, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';

type Tab = 'pending' | 'upcoming' | 'history';

// ─────────────────────────────────────────────────────────────────────────────

export const MatchesScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { pendingReceived, upcoming, history, loading, respondToInvite, recordMatchResult, refetch } = useMatches();
  const [tab, setTab] = useState<Tab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<any>(null);
  const [scoreMatch, setScoreMatch] = useState<any>(null);
  const [rescheduleInvite, setRescheduleInvite] = useState<any>(null);
  const { exportEvent, exporting: calExporting } = useCalendarExport();

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    setResponding(id);
    try { await respondToInvite(id, status); }
    catch { Alert.alert('Error', 'Failed to respond. Please try again.'); }
    finally { setResponding(null); }
  };

  const handleProposeNewTime = async (id: string, date: string, start: string, end: string) => {
    const { error } = await supabase
      .from('match_invites')
      .update({ proposed_date: date, proposed_start_time: start, proposed_end_time: end, proposed_by_user_id: user?.id ?? null, proposed_at: new Date().toISOString(), status: 'pending' })
      .eq('id', id);
    if (error) throw error;
    await refetch();
  };

  const getOpponent = (invite: any) => {
    const opp = invite.sender_id === user?.id ? invite.receiver : invite.sender;
    return {
      name: opp ? `${opp.first_name} ${opp.last_name}`.trim() : 'Unknown',
      imageUrl: opp?.profile_picture_url,
      profile: opp,
    };
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'pending',  label: 'Invitations', count: pendingReceived.length },
    { key: 'upcoming', label: 'Upcoming',    count: upcoming.length       },
    { key: 'history',  label: 'History',     count: history.length        },
  ];

  const rawData = tab === 'pending' ? pendingReceived : tab === 'upcoming' ? upcoming : history;
  const data = searchQuery.trim()
    ? rawData.filter(invite => {
        const { name } = getOpponent(invite as any);
        const court = (invite as any).court_location || '';
        const q = searchQuery.toLowerCase();
        return name.toLowerCase().includes(q) || court.toLowerCase().includes(q);
      })
    : rawData;

  // ── Empty states ──────────────────────────────────────────────────────────
  const EMPTY = {
    pending:  { icon: 'mail-outline'      as const, title: 'No invitations',        sub: 'When someone invites you to a match, it appears here' },
    upcoming: { icon: 'calendar-outline'  as const, title: 'No upcoming matches',   sub: 'Accept an invitation to schedule your next match'     },
    history:  { icon: 'time-outline'      as const, title: 'No match history yet',  sub: 'Your completed matches will appear here'              },
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={s.headerInner}>
          <Text style={s.headerTitle}>Matches</Text>
          <Text style={s.headerSub}>{pendingReceived.length > 0 ? `${pendingReceived.length} invitation${pendingReceived.length > 1 ? 's' : ''} waiting` : 'Your match activity'}</Text>
        </View>

        {/* ── Segmented tabs ────────────────────────────────────────────── */}
        <View style={s.tabsWrap}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[s.tabCount, tab === t.key && s.tabCountActive]}>
                  <Text style={[s.tabCountText, tab === t.key && s.tabCountTextActive]}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or court..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading && !refreshing ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : data.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name={EMPTY[tab].icon} size={32} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>{EMPTY[tab].title}</Text>
            <Text style={s.emptyText}>{EMPTY[tab].sub}</Text>
          </View>
        ) : (
          data.map(invite => tab === 'pending'
            ? <InviteCard key={invite.id} invite={invite as any} userId={user?.id} onPress={() => setSelectedInvite(invite)} isResponding={responding === invite.id} getOpponent={getOpponent} />
            : <MatchCard  key={invite.id} invite={invite as any} userId={user?.id} getOpponent={getOpponent}
                onReschedule={() => setRescheduleInvite(invite)}
                onRecordResult={() => setScoreMatch(invite)}
                onExport={() => {
                  const { name } = getOpponent(invite as any);
                  exportEvent({ title: `Tennis vs ${name}`, date: (invite as any).date, startTime: (invite as any).start_time, endTime: (invite as any).end_time, location: (invite as any).court_location });
                }}
              />
          )
        )}
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <MatchInviteResponseModal
        visible={!!selectedInvite} invite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onAccept={async (id) => { await handleRespond(id, 'accepted'); setSelectedInvite(null); navigation?.navigate('Schedule'); }}
        onDecline={async (id) => { await handleRespond(id, 'declined'); setSelectedInvite(null); }}
        onProposeNewTime={async (id, date, start, end) => { await handleProposeNewTime(id, date, start, end); setSelectedInvite(null); }}
      />
      <CasualMatchScoringModal
        visible={!!scoreMatch}
        match={scoreMatch}
        userId={user?.id || ''}
        onClose={() => setScoreMatch(null)}
        onSubmit={async (winnerId, senderSets, receiverSets) => {
          await recordMatchResult(scoreMatch.id, winnerId, senderSets, receiverSets);
          Alert.alert('Result Saved!', 'The match result has been logged and both players notified.');
          setScoreMatch(null);
        }}
      />
      <ProposeNewTimeModal
        visible={!!rescheduleInvite} invite={rescheduleInvite} userId={user?.id || ''}
        onClose={() => setRescheduleInvite(null)} onProposed={() => { setRescheduleInvite(null); refetch(); }}
      />
    </SafeAreaView>
  );
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function skillBadgeColor(level?: number) {
  if (!level) return Colors.textMuted;
  if (level >= 8) return Palette.red500;
  if (level >= 6) return Colors.primary;
  if (level >= 4) return Palette.yellow500;
  return Palette.green500;
}

// ─── InviteCard ───────────────────────────────────────────────────────────────

function InviteCard({ invite, onPress, isResponding, getOpponent, userId }: any) {
  const { name, imageUrl, profile: opp } = getOpponent(invite);
  const totalGames = (opp?.wins || 0) + (opp?.losses || 0);
  const winRate = totalGames > 0 ? Math.round(((opp?.wins || 0) / totalGames) * 100) : null;
  const levelColor = skillBadgeColor(opp?.skill_level);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.92} disabled={isResponding}>
      {/* Top: avatar + name + type badge */}
      <View style={s.cardTop}>
        <Avatar name={name} size={48} imageUrl={imageUrl} />
        <View style={s.cardIdentity}>
          <Text style={s.cardName}>{name}</Text>
          <Text style={s.cardSub}>{format(new Date(invite.date), 'EEEE, MMMM d')}</Text>
        </View>
        <View style={[s.typeBadge, invite.is_league_match ? s.typeBadgeLeague : s.typeBadgeMatch]}>
          <Text style={[s.typeBadgeTxt, { color: invite.is_league_match ? Palette.purple500 : Colors.primary }]}>
            {invite.is_league_match ? 'LEAGUE' : 'MATCH'}
          </Text>
        </View>
      </View>

      {/* Opponent profile chips */}
      {(opp?.skill_level || opp?.usta_rating || winRate !== null || opp?.city) && (
        <View style={s.profileRow}>
          {opp?.skill_level && (
            <View style={[s.profileChip, { backgroundColor: levelColor + '20' }]}>
              <View style={[s.profileChipDot, { backgroundColor: levelColor }]} />
              <Text style={[s.profileChipTxt, { color: levelColor }]}>Level {opp.skill_level}</Text>
            </View>
          )}
          {opp?.usta_rating && (
            <View style={s.profileChip}>
              <Text style={s.profileChipTxt}>USTA {opp.usta_rating}</Text>
            </View>
          )}
          {winRate !== null && (
            <View style={s.profileChip}>
              <Text style={s.profileChipTxt}>{winRate}% wins</Text>
            </View>
          )}
          {opp?.city && (
            <View style={s.profileChip}>
              <Ionicons name="location-outline" size={10} color={Colors.textMuted} />
              <Text style={s.profileChipTxt}>{opp.city}</Text>
            </View>
          )}
        </View>
      )}

      {/* Strava-style 3-up stats */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>STARTS</Text>
          <Text style={s.statValue}>{invite.start_time}</Text>
        </View>
        <View style={[s.stat, s.statMid]}>
          <Text style={s.statLabel}>ENDS</Text>
          <Text style={s.statValue}>{invite.end_time}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>COURT</Text>
          <Text style={s.statValue} numberOfLines={1}>{invite.court_location || '—'}</Text>
        </View>
      </View>

      {/* Optional extras */}
      {(invite.message || invite.proposed_date) && (
        <View style={s.extras}>
          {invite.message && (
            <View style={s.msgBox}>
              <Ionicons name="chatbubble-outline" size={12} color={Colors.textMuted} />
              <Text style={s.msgTxt} numberOfLines={2}>"{invite.message}"</Text>
            </View>
          )}
          {invite.proposed_date && (
            <View style={s.proposedBox}>
              <Ionicons name="time-outline" size={13} color={Colors.warning} />
              <Text style={s.proposedTxt}>New time: {invite.proposed_date} at {invite.proposed_start_time}</Text>
            </View>
          )}
        </View>
      )}

      {/* Full-width CTA */}
      <TouchableOpacity style={s.ctaBtn} onPress={onPress} disabled={isResponding} activeOpacity={0.85}>
        {isResponding
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={s.ctaBtnTxt}>View & Respond</Text>
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ invite, userId, getOpponent, onReschedule, onExport, onRecordResult }: any) {
  const { name, imageUrl } = getOpponent(invite);
  const isSender = invite.sender_id === userId;
  const isPast = new Date(`${invite.date}T${invite.start_time}`) < new Date();
  const hasWinner = !!invite.winner_id;
  const iWon = hasWinner && invite.winner_id === userId;
  const hasScore = invite.player1_score != null && invite.player2_score != null;

  // Resolve which score belongs to me vs opponent
  const mySets  = isSender ? invite.player1_score : invite.player2_score;
  const oppSets = isSender ? invite.player2_score : invite.player1_score;

  return (
    <View style={s.card}>
      {/* Top: avatar + name + result/status badge */}
      <View style={s.cardTop}>
        <Avatar name={name} size={48} imageUrl={imageUrl} />
        <View style={s.cardIdentity}>
          <Text style={s.cardName}>{name}</Text>
          <Text style={s.cardSub}>{format(new Date(invite.date), 'EEEE, MMMM d')}</Text>
        </View>
        {isPast && hasWinner ? (
          <View style={[s.resultBadge, iWon ? s.resultBadgeWon : s.resultBadgeLost]}>
            <Ionicons
              name={iWon ? 'trophy' : 'ribbon-outline'}
              size={11}
              color={iWon ? Colors.success : Palette.red500}
            />
            <Text style={[s.resultBadgeTxt, { color: iWon ? Colors.success : Palette.red500 }]}>
              {iWon ? 'WON' : 'LOST'}
            </Text>
          </View>
        ) : (
          <View style={[s.statusBadge, isPast ? s.statusBadgeGray : s.statusBadgeGreen]}>
            <View style={[s.statusDot, { backgroundColor: isPast ? Colors.textMuted : Colors.success }]} />
            <Text style={[s.statusTxt, { color: isPast ? Colors.textMuted : Colors.success }]}>
              {isPast ? 'Played' : 'Confirmed'}
            </Text>
          </View>
        )}
      </View>

      {/* Score display — only when a result has been logged */}
      {isPast && hasScore && hasWinner && (
        <View style={s.scoreSummary}>
          <View style={[s.scoreSummaryPlayer, iWon && s.scoreSummaryWinner]}>
            <Text style={s.scoreSummaryLabel}>You</Text>
            <Text style={[s.scoreSummaryNum, iWon && s.scoreSummaryNumWinner]}>{mySets}</Text>
          </View>
          <Text style={s.scoreSummarySep}>sets</Text>
          <View style={[s.scoreSummaryPlayer, !iWon && hasWinner && s.scoreSummaryWinner]}>
            <Text style={s.scoreSummaryLabel}>{name.split(' ')[0]}</Text>
            <Text style={[s.scoreSummaryNum, !iWon && hasWinner && s.scoreSummaryNumWinner]}>{oppSets}</Text>
          </View>
        </View>
      )}

      {/* 3-up stats */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>DATE</Text>
          <Text style={s.statValue}>{format(new Date(invite.date), 'MMM d')}</Text>
        </View>
        <View style={[s.stat, s.statMid]}>
          <Text style={s.statLabel}>TIME</Text>
          <Text style={s.statValue}>{invite.start_time}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>COURT</Text>
          <Text style={s.statValue} numberOfLines={1}>{invite.court_location || '—'}</Text>
        </View>
      </View>

      {/* Pending result prompt — for past matches with no result yet */}
      {isPast && !hasWinner && (
        <TouchableOpacity
          style={s.recordBanner}
          onPress={onRecordResult}
          activeOpacity={0.85}
        >
          <View style={s.recordBannerLeft}>
            <Ionicons name="trophy" size={18} color={Colors.primary} />
            <View>
              <Text style={s.recordBannerTitle}>Log the result</Text>
              <Text style={s.recordBannerSub}>Tap to enter the match score</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Actions row */}
      {!isPast ? (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={onReschedule} activeOpacity={0.75}>
            <Ionicons name="time-outline" size={15} color={Colors.primary} />
            <Text style={s.actionBtnTxt}>Reschedule</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionBtn} onPress={onExport} activeOpacity={0.75}>
            <Ionicons name="calendar-outline" size={15} color={Colors.primary} />
            <Text style={s.actionBtnTxt}>Calendar</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionBtn} onPress={onRecordResult} activeOpacity={0.75}>
            <Ionicons name="trophy-outline" size={15} color={Colors.primary} />
            <Text style={s.actionBtnTxt}>Record</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Header ────────────────────────────────────────────────────────────────
  header: { paddingBottom: Spacing.sm },
  headerInner: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  headerTitle: { fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  headerSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontFamily: Font.medium },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabBtnActive: { backgroundColor: '#fff' },
  tabLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', fontFamily: Font.semibold },
  tabLabelActive: { color: Palette.dark900 },
  tabCount: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: Colors.primaryLight },
  tabCountText: { fontSize: FontSize.xxs, color: '#fff', fontFamily: Font.bold },
  tabCountTextActive: { color: Colors.primary },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: { paddingTop: Spacing.md, paddingBottom: 48 },

  // ── Card shell ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },

  // ── Card top row ─────────────────────────────────────────────────────────
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  cardIdentity: { flex: 1 },
  cardName: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text, letterSpacing: -0.3 },
  cardSub:  { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontFamily: Font.medium },

  // Type badge (LEAGUE / MATCH)
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.xs },
  typeBadgeLeague: { backgroundColor: Palette.purpleBg },
  typeBadgeMatch:  { backgroundColor: Colors.primaryLight },
  typeBadgeTxt: { fontSize: 10, fontFamily: Font.extrabold, letterSpacing: 0.6 },

  // Status badge (Confirmed / Completed)
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.xs },
  statusBadgeGreen: { backgroundColor: Colors.successLight },
  statusBadgeGray:  { backgroundColor: Colors.backgroundAlt },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontFamily: Font.semibold },

  // ── Strava stats row ──────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  stat: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    alignItems: 'flex-start',
  },
  statMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.borderLight,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: Font.extrabold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  statValue: {
    fontSize: FontSize.md,
    fontFamily: Font.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },

  // ── Extras (message / proposed time) ────────────────────────────────────
  extras: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.xs },
  msgBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.sm, padding: Spacing.sm,
  },
  msgTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic', flex: 1 },
  proposedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.sm, padding: Spacing.sm,
  },
  proposedTxt: { fontSize: FontSize.xs, color: Colors.warning, fontFamily: Font.semibold, flex: 1 },

  // ── Full-width CTA ───────────────────────────────────────────────────────
  ctaBtn: {
    margin: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.orange,
  },
  ctaBtnTxt: { color: '#fff', fontSize: FontSize.md, fontFamily: Font.bold, letterSpacing: 0.1 },

  // ── Action row (reschedule / export) ─────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  actionDivider: { width: 1, backgroundColor: Colors.borderLight },
  actionBtnTxt: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.primary },

  // ── Search bar ───────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.xs,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 0 },

  // ── Opponent profile chips ────────────────────────────────────────────────
  profileRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  profileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  profileChipDot: { width: 6, height: 6, borderRadius: 3 },
  profileChipTxt: { fontSize: FontSize.xxs, fontFamily: Font.semibold, color: Colors.textSecondary },

  // ── Result badge (Won / Lost) ─────────────────────────────────────────────
  resultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.xs,
  },
  resultBadgeWon:  { backgroundColor: Colors.successLight },
  resultBadgeLost: { backgroundColor: '#FFEEEE' },
  resultBadgeTxt:  { fontSize: 11, fontFamily: Font.extrabold, letterSpacing: 0.5 },

  // ── Score summary (shown on history cards with a result) ─────────────────
  scoreSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginHorizontal: Spacing.lg,
  },
  scoreSummaryPlayer: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  scoreSummaryWinner: { backgroundColor: Colors.successLight },
  scoreSummaryLabel: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.textMuted },
  scoreSummaryNum: { fontSize: 36, fontFamily: Font.black, color: Colors.text, letterSpacing: -1 },
  scoreSummaryNumWinner: { color: Colors.success },
  scoreSummarySep: { fontSize: FontSize.sm, fontFamily: Font.medium, color: Colors.textMuted },

  // ── Record result inline banner (past match, no result) ───────────────────
  recordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  recordBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  recordBannerTitle: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.primary },
  recordBannerSub: { fontSize: FontSize.xs, fontFamily: Font.medium, color: Colors.primaryDark, marginTop: 1 },

  // ── Empty / loading ──────────────────────────────────────────────────────
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:  { alignItems: 'center', paddingTop: 80, gap: Spacing.md, paddingHorizontal: Spacing.xxxl },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text, letterSpacing: -0.3 },
  emptyText:  { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
