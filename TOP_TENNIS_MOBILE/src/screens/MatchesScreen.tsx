import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { MatchInviteResponseModal } from '@/components/ui/MatchInviteResponseModal';
import { ScoreConfirmationModal } from '@/components/ui/ScoreConfirmationModal';
import { ProposeNewTimeModal } from '@/components/ui/ProposeNewTimeModal';
import { useCalendarExport } from '@/hooks/useCalendarExport';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';

type Tab = 'pending' | 'upcoming' | 'history';

// ─────────────────────────────────────────────────────────────────────────────

export const MatchesScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { pendingReceived, upcoming, history, loading, respondToInvite, refetch } = useMatches();
  const [tab, setTab] = useState<Tab>('pending');
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
      .update({ proposed_date: date, proposed_start_time: start, proposed_end_time: end, status: 'pending' })
      .eq('id', id);
    if (error) throw error;
    await refetch();
  };

  const getOpponent = (invite: any) => {
    const opp = invite.sender_id === user?.id ? invite.receiver : invite.sender;
    return {
      name: opp ? `${opp.first_name} ${opp.last_name}`.trim() : 'Unknown',
      imageUrl: opp?.profile_picture_url,
    };
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'pending',  label: 'Invitations', count: pendingReceived.length },
    { key: 'upcoming', label: 'Upcoming',    count: upcoming.length       },
    { key: 'history',  label: 'History',     count: history.length        },
  ];

  const data = tab === 'pending' ? pendingReceived : tab === 'upcoming' ? upcoming : history;

  // ── Empty states ──────────────────────────────────────────────────────────
  const EMPTY = {
    pending:  { icon: 'mail-outline'      as const, title: 'No invitations',        sub: 'When someone invites you to a match, it appears here' },
    upcoming: { icon: 'calendar-outline'  as const, title: 'No upcoming matches',   sub: 'Accept an invitation to schedule your next match'     },
    history:  { icon: 'time-outline'      as const, title: 'No match history yet',  sub: 'Your completed matches will appear here'              },
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar style="light" />
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Matches</Text>
          <Text style={s.headerSub}>{pendingReceived.length > 0 ? `${pendingReceived.length} invitation${pendingReceived.length > 1 ? 's' : ''} waiting` : 'Your match activity'}</Text>
        </View>
      </LinearGradient>

      {/* ── Segmented tabs ──────────────────────────────────────────────── */}
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
              <Ionicons name={EMPTY[tab].icon} size={32} color={Colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>{EMPTY[tab].title}</Text>
            <Text style={s.emptyText}>{EMPTY[tab].sub}</Text>
          </View>
        ) : (
          data.map(invite => tab === 'pending'
            ? <InviteCard key={invite.id} invite={invite as any} onPress={() => setSelectedInvite(invite)} isResponding={responding === invite.id} getOpponent={getOpponent} />
            : <MatchCard  key={invite.id} invite={invite as any} userId={user?.id} getOpponent={getOpponent} onReschedule={() => setRescheduleInvite(invite)}
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
        onAccept={async (id) => { await handleRespond(id, 'accepted'); setSelectedInvite(null); }}
        onDecline={async (id) => { await handleRespond(id, 'declined'); setSelectedInvite(null); }}
        onProposeNewTime={async (id, date, start, end) => { await handleProposeNewTime(id, date, start, end); setSelectedInvite(null); }}
      />
      <ScoreConfirmationModal
        visible={!!scoreMatch} match={scoreMatch} userId={user?.id || ''}
        onClose={() => setScoreMatch(null)} onConfirmed={() => { setScoreMatch(null); refetch(); }}
      />
      <ProposeNewTimeModal
        visible={!!rescheduleInvite} invite={rescheduleInvite} userId={user?.id || ''}
        onClose={() => setRescheduleInvite(null)} onProposed={() => { setRescheduleInvite(null); refetch(); }}
      />
    </SafeAreaView>
  );
};

// ─── InviteCard ───────────────────────────────────────────────────────────────

function InviteCard({ invite, onPress, isResponding, getOpponent }: any) {
  const { name, imageUrl } = getOpponent(invite);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85} disabled={isResponding}>
      {/* Accent stripe */}
      <View style={s.cardStripe} />

      <View style={s.cardBody}>
        {/* Avatar + name/time */}
        <View style={s.cardRow}>
          <Avatar name={name} size={52} imageUrl={imageUrl} />
          <View style={{ flex: 1 }}>
            <View style={s.cardNameRow}>
              <Text style={s.cardName}>{name}</Text>
              <View style={[s.typePill, invite.is_league_match ? s.typePillLeague : s.typePillMatch]}>
                <Text style={[s.typePillText, invite.is_league_match ? { color: Palette.purple500 } : { color: Colors.primary }]}>
                  {invite.is_league_match ? 'League' : 'Match'}
                </Text>
              </View>
            </View>
            <Text style={s.cardDate}>{format(new Date(invite.date), 'EEEE, MMMM d')}</Text>
            <Text style={s.cardTime}>{invite.start_time} – {invite.end_time}</Text>
          </View>
        </View>

        {invite.court_location && (
          <View style={s.metaRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={s.metaText}>{invite.court_location}</Text>
          </View>
        )}
        {invite.message && (
          <View style={s.messageBox}>
            <Ionicons name="chatbubble-outline" size={12} color={Colors.textMuted} />
            <Text style={s.messageText}>"{invite.message}"</Text>
          </View>
        )}
        {invite.proposed_date && (
          <View style={s.proposedBox}>
            <Ionicons name="time-outline" size={13} color={Colors.warning} />
            <Text style={s.proposedText}>New time proposed: {invite.proposed_date} at {invite.proposed_start_time}</Text>
          </View>
        )}

        <TouchableOpacity style={s.respondBtn} onPress={onPress} disabled={isResponding} activeOpacity={0.85}>
          {isResponding
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={s.respondBtnText}>View & Respond</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ invite, userId, getOpponent, onReschedule, onExport }: any) {
  const { name, imageUrl } = getOpponent(invite);
  const isSender = invite.sender_id === userId;
  const isHistory = invite.status === 'completed' || invite.status === 'declined';

  return (
    <View style={s.card}>
      <View style={[s.cardStripe, isHistory && s.cardStripeGray]} />
      <View style={s.cardBody}>

        <View style={s.cardRow}>
          <Avatar name={name} size={52} imageUrl={imageUrl} />
          <View style={{ flex: 1 }}>
            <View style={s.cardNameRow}>
              <Text style={s.cardName}>{name}</Text>
              <View style={[s.typePill, isSender ? s.typePillSent : s.typePillReceived]}>
                <Text style={[s.typePillText, { color: isSender ? Colors.accent : Colors.success }]}>
                  {isSender ? 'You invited' : 'Invited you'}
                </Text>
              </View>
            </View>
            <Text style={s.cardDate}>{format(new Date(invite.date), 'EEEE, MMMM d')}</Text>
            <Text style={s.cardTime}>{invite.start_time} – {invite.end_time}</Text>
          </View>
        </View>

        {invite.court_location && (
          <View style={s.metaRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={s.metaText}>{invite.court_location}</Text>
          </View>
        )}

        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: isHistory ? Colors.textMuted : Colors.success }]} />
          <Text style={s.statusText}>{isHistory ? 'Completed' : 'Confirmed'}</Text>

          {!isHistory && (
            <View style={s.actionBtns}>
              <TouchableOpacity style={s.ghostBtn} onPress={onReschedule} activeOpacity={0.7}>
                <Ionicons name="time-outline" size={13} color={Colors.primary} />
                <Text style={s.ghostBtnText}>Reschedule</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ghostBtn, s.ghostBtnGreen]} onPress={onExport} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={13} color={Colors.success} />
                <Text style={[s.ghostBtnText, { color: Colors.success }]}>Export</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.black, color: '#fff', letterSpacing: -1 },
  headerSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: FontWeight.medium },

  // Tabs
  tabsWrap: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.md,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadow.xs,
  },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  tabLabelActive: { color: Colors.text },
  tabCount: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: Colors.primaryLight },
  tabCountText: { fontSize: FontSize.xxs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  tabCountTextActive: { color: Colors.primary },

  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  // Cards
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardStripe: { width: 4, backgroundColor: Colors.primary },
  cardStripeGray: { backgroundColor: Colors.textMuted },
  cardBody: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },

  cardRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap', marginBottom: 2 },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, letterSpacing: -0.2 },
  cardDate: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  cardTime: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 1 },

  typePill: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  typePillLeague:   { backgroundColor: Palette.purpleBg },
  typePillMatch:    { backgroundColor: Colors.primaryLight },
  typePillSent:     { backgroundColor: Colors.accentLight },
  typePillReceived: { backgroundColor: Colors.successLight },
  typePillText: { fontSize: FontSize.xxs, fontWeight: FontWeight.bold },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },

  messageBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.sm, padding: Spacing.sm,
  },
  messageText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', flex: 1 },

  proposedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.sm, padding: Spacing.sm,
  },
  proposedText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.medium, flex: 1 },

  respondBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 12,
    ...Shadow.orange,
  },
  respondBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginRight: 4 },
  actionBtns: { flexDirection: 'row', gap: Spacing.xs, marginLeft: 'auto' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.primary,
  },
  ghostBtnGreen: { borderColor: Colors.success },
  ghostBtnText: { fontSize: FontSize.xxs, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Empty / loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:  { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptyText:  { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});
