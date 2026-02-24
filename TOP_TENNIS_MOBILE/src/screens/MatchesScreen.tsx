import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MatchInviteResponseModal } from '@/components/ui/MatchInviteResponseModal';
import { ScoreConfirmationModal } from '@/components/ui/ScoreConfirmationModal';
import { ProposeNewTimeModal } from '@/components/ui/ProposeNewTimeModal';
import { useCalendarExport } from '@/hooks/useCalendarExport';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format } from 'date-fns';

type Tab = 'pending' | 'upcoming' | 'history';

export const MatchesScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { pendingReceived, upcoming, history, loading, respondToInvite, refetch } = useMatches();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<any>(null);
  const [scoreMatch, setScoreMatch] = useState<any>(null);
  const [rescheduleInvite, setRescheduleInvite] = useState<any>(null);
  const { exportEvent, exporting: calExporting } = useCalendarExport();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleRespond = async (inviteId: string, status: 'accepted' | 'declined') => {
    setResponding(inviteId);
    try {
      await respondToInvite(inviteId, status);
    } catch {
      Alert.alert('Error', 'Failed to respond. Please try again.');
    } finally {
      setResponding(null);
    }
  };

  const handleProposeNewTime = async (inviteId: string, date: string, startTime: string, endTime: string) => {
    const { error } = await supabase
      .from('match_invites')
      .update({ proposed_date: date, proposed_start_time: startTime, proposed_end_time: endTime, status: 'pending' })
      .eq('id', inviteId);
    if (error) throw error;
    await refetch();
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Invitations', count: pendingReceived.length },
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'history', label: 'History', count: history.length },
  ];

  const getOpponentName = (invite: ReturnType<typeof useMatches>['upcoming'][0]) => {
    const opponent = invite.sender_id === user?.id ? invite.receiver : invite.sender;
    return opponent ? `${opponent.first_name} ${opponent.last_name}`.trim() : 'Unknown';
  };

  const renderInviteCard = (invite: ReturnType<typeof useMatches>['pendingReceived'][0]) => {
    const senderName = invite.sender
      ? `${invite.sender.first_name} ${invite.sender.last_name}`.trim()
      : 'Unknown';
    const isResponding = responding === invite.id;

    return (
      <Card key={invite.id} elevated style={styles.matchCard}>
        <View style={styles.cardHeader}>
          <Avatar name={senderName} size={48} imageUrl={invite.sender?.profile_picture_url} />
          <View style={styles.cardInfo}>
            <Text style={styles.opponentName}>{senderName}</Text>
            <Text style={styles.matchDate}>
              {format(new Date(invite.date), 'EEE, MMM d, yyyy')}
            </Text>
            <Text style={styles.matchTime}>{invite.start_time} – {invite.end_time}</Text>
          </View>
          <Badge label={invite.is_league_match ? 'League' : 'New'} variant={invite.is_league_match ? 'primary' : 'warning'} />
        </View>
        {invite.court_location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.locationText}>{invite.court_location}</Text>
          </View>
        )}
        {invite.message && (
          <Text style={styles.messageText}>"{invite.message}"</Text>
        )}
        {invite.proposed_date && (
          <View style={styles.proposedRow}>
            <Ionicons name="time-outline" size={14} color="#ea580c" />
            <Text style={styles.proposedText}>New time proposed: {invite.proposed_date} {invite.proposed_start_time}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.viewInviteBtn}
          onPress={() => setSelectedInvite(invite)}
          disabled={isResponding}
        >
          {isResponding
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="eye-outline" size={16} color="#fff" /><Text style={styles.viewInviteBtnText}>View & Respond</Text></>
          }
        </TouchableOpacity>
      </Card>
    );
  };

  const renderMatchCard = (invite: ReturnType<typeof useMatches>['upcoming'][0], showResult = false) => {
    const opponentName = getOpponentName(invite);
    const isSender = invite.sender_id === user?.id;

    return (
      <Card key={invite.id} elevated style={styles.matchCard}>
        <View style={styles.cardHeader}>
          <Avatar name={opponentName} size={48} imageUrl={(invite.sender_id === user?.id ? invite.receiver : invite.sender)?.profile_picture_url} />
          <View style={styles.cardInfo}>
            <Text style={styles.opponentName}>{opponentName}</Text>
            <Text style={styles.matchDate}>
              {format(new Date(invite.date), 'EEE, MMM d, yyyy')}
            </Text>
            <Text style={styles.matchTime}>{invite.start_time} – {invite.end_time}</Text>
          </View>
          <Badge
            label={isSender ? 'You invited' : 'Invited you'}
            variant={isSender ? 'primary' : 'info'}
          />
        </View>
        {invite.court_location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.locationText}>{invite.court_location}</Text>
          </View>
        )}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.statusText}>Confirmed</Text>
          <TouchableOpacity
            style={styles.rescheduleBtn}
            onPress={() => setRescheduleInvite(invite)}
          >
            <Ionicons name="time-outline" size={13} color={Colors.primary} />
            <Text style={styles.rescheduleBtnText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportEvent({
              title: `Tennis vs ${opponentName}`,
              date: invite.date,
              startTime: invite.start_time,
              endTime: invite.end_time,
              location: invite.court_location,
            })}
            disabled={calExporting}
          >
            <Ionicons name="calendar-outline" size={13} color={Colors.success} />
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const currentData = activeTab === 'pending' ? pendingReceived
    : activeTab === 'upcoming' ? upcoming
    : history;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Matches" subtitle="Match invitations & history" navigation={navigation} showBack={navigation?.canGoBack?.()} />

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, activeTab === tab.key && styles.tabCountTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : currentData.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="tennisball-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'No invitations' : activeTab === 'upcoming' ? 'No upcoming matches' : 'No match history'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'pending'
                ? 'When someone invites you to a match, it will appear here'
                : activeTab === 'upcoming'
                ? 'Accept an invitation to schedule your next match'
                : 'Your completed matches will appear here'}
            </Text>
          </View>
        ) : (
          currentData.map(invite =>
            activeTab === 'pending'
              ? renderInviteCard(invite as any)
              : renderMatchCard(invite as any)
          )
        )}
      </ScrollView>

      <MatchInviteResponseModal
        visible={!!selectedInvite}
        invite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onAccept={async (id) => { await handleRespond(id, 'accepted'); setSelectedInvite(null); }}
        onDecline={async (id) => { await handleRespond(id, 'declined'); setSelectedInvite(null); }}
        onProposeNewTime={async (id, date, start, end) => { await handleProposeNewTime(id, date, start, end); setSelectedInvite(null); }}
      />

      <ScoreConfirmationModal
        visible={!!scoreMatch}
        match={scoreMatch}
        userId={user?.id || ''}
        onClose={() => setScoreMatch(null)}
        onConfirmed={() => { setScoreMatch(null); refetch(); }}
      />

      <ProposeNewTimeModal
        visible={!!rescheduleInvite}
        invite={rescheduleInvite}
        userId={user?.id || ''}
        onClose={() => setRescheduleInvite(null)}
        onProposed={() => { setRescheduleInvite(null); refetch(); }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, gap: Spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  tabCount: { backgroundColor: Colors.borderLight, borderRadius: Radius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive: { backgroundColor: Colors.primaryLight },
  tabCountText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  tabCountTextActive: { color: Colors.primaryDark },

  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  matchCard: { gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardInfo: { flex: 1 },
  opponentName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  matchDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  matchTime: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium, marginTop: 1 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: FontSize.sm, color: Colors.textMuted },
  messageText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', backgroundColor: Colors.borderLight, padding: Spacing.sm, borderRadius: Radius.sm },
  proposedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', padding: Spacing.sm, borderRadius: Radius.sm },
  proposedText: { fontSize: FontSize.xs, color: '#ea580c', fontWeight: FontWeight.medium },
  viewInviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.xs },
  viewInviteBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },

  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  declineBtn: {
    flex: 1, height: 42, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
  declineBtnText: { color: Colors.error, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  acceptBtn: {
    flex: 1, height: 42, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { color: Colors.textInverse, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  btnDisabled: { opacity: 0.5 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  rescheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary },
  rescheduleBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.success },
  exportBtnText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.medium },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
