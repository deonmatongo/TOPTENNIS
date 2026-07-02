import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMatches } from '@/hooks/useMatches';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { MatchInviteResponseModal } from '@/components/ui/MatchInviteResponseModal';
import { supabase } from '@/services/supabase';
import { Palette, Colors, FontSize, Font, FontWeight, Spacing, Radius } from '@/theme/colors';
import { StatusBar } from 'expo-status-bar';
import { format, differenceInHours } from 'date-fns';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'declined' | 'cancelled';
type Tab = 'sent' | 'received' | 'upcoming' | 'history';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  accepted:  { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  declined:  { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  cancelled: { bg: '#f9fafb', text: Colors.textMuted, border: Colors.borderLight },
};

export const ManageBookingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { invites, pendingReceived, upcoming, history, loading, respondToInvite, refetch } = useMatches();
  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCancel = (invite: any) => {
    Alert.alert(
      'Cancel Match',
      'Are you sure you want to cancel this match invitation?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Match',
          style: 'destructive',
          onPress: async () => {
            setCancelling(invite.id);
            try {
              const { error } = await supabase
                .from('match_invites')
                .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by_user_id: user?.id ?? null, updated_at: new Date().toISOString() })
                .eq('id', invite.id)
                .eq('sender_id', user?.id);
              if (error) throw error;
              if (user) await supabase.rpc('unlock_slots_for_invite', { p_invite_id: invite.id, p_user_id: user.id });
              await refetch();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to cancel match.');
            } finally {
              setCancelling(null);
            }
          },
        },
      ]
    );
  };

  const handleProposeNewTime = async (inviteId: string, date: string, startTime: string, endTime: string) => {
    const { error } = await supabase
      .from('match_invites')
      .update({ proposed_date: date, proposed_start_time: startTime, proposed_end_time: endTime, proposed_by_user_id: user?.id ?? null, proposed_at: new Date().toISOString(), status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', inviteId);
    if (error) throw error;
    await refetch();
  };

  const getOpponentName = (invite: any) => {
    const isSender = invite.sender_id === user?.id;
    const opp = isSender ? invite.receiver : invite.sender;
    return opp ? `${opp.first_name || ''} ${opp.last_name || ''}`.trim() : 'Unknown';
  };

  const getOpponentPic = (invite: any) => {
    const isSender = invite.sender_id === user?.id;
    return isSender ? invite.receiver?.profile_picture_url : invite.sender?.profile_picture_url;
  };

  const getUrgencyLabel = (invite: any) => {
    if (invite.status !== 'pending') return null;
    const matchDate = new Date(`${invite.date}T${invite.start_time}`);
    const hours = differenceInHours(matchDate, new Date());
    if (hours < 0) return { label: 'Past', color: Colors.textMuted };
    if (hours < 24) return { label: `${hours}h left`, color: Colors.error };
    if (hours < 48) return { label: '< 2 days', color: '#f59e0b' };
    return null;
  };

  // Compute tab data
  const sentInvites = invites.filter(i => i.sender_id === user?.id);
  const receivedInvites = invites.filter(i => i.receiver_id === user?.id);

  const applyFilters = (list: any[]) => {
    return list.filter(i => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (searchQuery) {
        const name = getOpponentName(i).toLowerCase();
        if (!name.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  };

  const tabData: Record<Tab, any[]> = {
    received: applyFilters(receivedInvites),
    sent: applyFilters(sentInvites),
    upcoming: applyFilters(upcoming),
    history: applyFilters(history),
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'received', label: 'Received', count: pendingReceived.length },
    { key: 'sent', label: 'Sent', count: sentInvites.filter(i => i.status === 'pending').length },
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'history', label: 'History', count: 0 },
  ];

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const renderCard = (invite: any) => {
    const opponentName = getOpponentName(invite);
    const opponentPic = getOpponentPic(invite);
    const isSender = invite.sender_id === user?.id;
    const statusStyle = STATUS_COLORS[invite.status] || STATUS_COLORS.pending;
    const urgency = getUrgencyLabel(invite);
    const isCancelling = cancelling === invite.id;

    return (
      <View key={invite.id} style={styles.card}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <Avatar name={opponentName} size={44} imageUrl={opponentPic} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opponentName}>{opponentName}</Text>
            <View style={styles.cardMeta}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.cardMetaText}>
                {format(new Date(invite.date), 'EEE, MMM d, yyyy')}
              </Text>
              <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.cardMetaText}>{invite.start_time}</Text>
            </View>
          </View>
          <View style={styles.cardBadges}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
              </Text>
            </View>
            {urgency && (
              <View style={[styles.urgencyBadge, { backgroundColor: urgency.color + '20' }]}>
                <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Details */}
        {invite.court_location && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>{invite.court_location}</Text>
          </View>
        )}
        {invite.message && (
          <Text style={styles.messageText}>"{invite.message}"</Text>
        )}
        {invite.is_league_match && (
          <View style={styles.leaguePill}>
            <Ionicons name="trophy-outline" size={12} color={Colors.primary} />
            <Text style={styles.leaguePillText}>League Match</Text>
          </View>
        )}
        {invite.proposed_date && (
          <View style={styles.proposedRow}>
            <Ionicons name="time-outline" size={13} color="#ea580c" />
            <Text style={styles.proposedText}>
              New time proposed: {format(new Date(invite.proposed_date), 'MMM d')} at {invite.proposed_start_time}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          {/* Received pending — view full modal */}
          {!isSender && invite.status === 'pending' && (
            <TouchableOpacity style={styles.viewBtn} onPress={() => setSelectedInvite(invite)}>
              <Ionicons name="eye-outline" size={15} color="#fff" />
              <Text style={styles.viewBtnText}>View & Respond</Text>
            </TouchableOpacity>
          )}
          {/* Sent pending — can cancel */}
          {isSender && invite.status === 'pending' && (
            <TouchableOpacity
              style={[styles.cancelBtn, isCancelling && styles.btnDisabled]}
              onPress={() => handleCancel(invite)}
              disabled={isCancelling}
            >
              {isCancelling
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <><Ionicons name="close-circle-outline" size={15} color={Colors.error} /><Text style={styles.cancelBtnText}>Cancel Invite</Text></>
              }
            </TouchableOpacity>
          )}
          {/* Upcoming accepted — view details */}
          {invite.status === 'accepted' && (
            <View style={styles.confirmedRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.confirmedText}>Confirmed</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const currentData = tabData[activeTab];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      <LinearGradient colors={[Palette.dark900, Palette.dark700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradHeader, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity style={styles.gradBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.gradTitle}>Manage Bookings</Text>
          <Text style={styles.gradSub}>All your match invitations</Text>
        </View>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by opponent name..."
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : currentData.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'received' ? 'No received invitations' :
               activeTab === 'sent' ? 'No sent invitations' :
               activeTab === 'upcoming' ? 'No upcoming matches' : 'No match history'}
            </Text>
          </View>
        ) : (
          currentData.map(renderCard)
        )}
      </ScrollView>

      {/* Response modal */}
      <MatchInviteResponseModal
        visible={!!selectedInvite}
        invite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onAccept={async (id) => { await respondToInvite(id, 'accepted'); setSelectedInvite(null); }}
        onDecline={async (id) => { await respondToInvite(id, 'declined'); setSelectedInvite(null); }}
        onProposeNewTime={async (id, date, start, end) => { await handleProposeNewTime(id, date, start, end); setSelectedInvite(null); }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  gradHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
  gradBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  gradTitle: { fontSize: 22, fontFamily: Font.black, color: '#fff' },
  gradSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  searchRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text },

  tabScroll: { flexGrow: 0, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabContent: { paddingHorizontal: Spacing.md, gap: Spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: Font.medium },
  tabTextActive: { color: Colors.primary, fontFamily: Font.semibold },
  tabBadge: { backgroundColor: Colors.borderLight, borderRadius: Radius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: Colors.primaryLight },
  tabBadgeText: { fontSize: 10, color: Colors.textSecondary, fontFamily: Font.bold },
  tabBadgeTextActive: { color: Colors.primaryDark },

  filterScroll: { flexGrow: 0, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  filterContent: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Font.medium },
  filterChipTextActive: { color: '#fff', fontFamily: Font.semibold },

  list: { flex: 1 },
  listContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  opponentName: { fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  cardMetaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  cardBadges: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontFamily: Font.bold },
  urgencyBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  urgencyText: { fontSize: 10, fontFamily: Font.semibold },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  messageText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic', backgroundColor: Colors.background, padding: Spacing.sm, borderRadius: Radius.sm, borderLeftWidth: 2, borderLeftColor: Colors.primary },
  leaguePill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  leaguePillText: { fontSize: 10, color: Colors.primary, fontFamily: Font.semibold },
  proposedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', padding: Spacing.sm, borderRadius: Radius.sm },
  proposedText: { fontSize: FontSize.xs, color: '#ea580c', fontFamily: Font.medium },

  cardActions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  viewBtnText: { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.sm },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1.5, borderColor: Colors.error, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  cancelBtnText: { color: Colors.error, fontFamily: Font.semibold, fontSize: FontSize.sm },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  confirmedText: { fontSize: FontSize.sm, color: Colors.success, fontFamily: Font.semibold },
  btnDisabled: { opacity: 0.5 },

  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
