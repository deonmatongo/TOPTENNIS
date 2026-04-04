import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { Avatar } from '@/components/ui/Avatar';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';
import { Palette, Colors, Shadow, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'requests' | 'friends' | 'find';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Requests' },
  { id: 'friends', label: 'Friends' },
  { id: 'find', label: 'Find Players' },
];

const SectionLabel: React.FC<{ text: string }> = ({ text }) => (
  <Text style={s.sectionLabel}>{text}</Text>
);

const EmptyState: React.FC<{ icon: string; title: string; sub: string; btnLabel?: string; onBtn?: () => void }> = ({
  icon, title, sub, btnLabel, onBtn,
}) => (
  <View style={s.emptyCard}>
    <View style={s.emptyIconCircle}>
      <Ionicons name={icon as any} size={28} color={Colors.primary} />
    </View>
    <Text style={s.emptyTitle}>{title}</Text>
    <Text style={s.emptySub}>{sub}</Text>
    {btnLabel && onBtn && (
      <TouchableOpacity style={s.emptyBtn} onPress={onBtn}>
        <Text style={s.emptyBtnTxt}>{btnLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const SocialScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    pendingReceived, pendingSent, friends, loading,
    updateRequestStatus, cancelRequest, sendFriendRequest, refetch,
  } = useFriendRequests();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, skill_level, usta_rating, city, profile_picture_url, user_id')
        .ilike('name', `%${q}%`)
        .neq('user_id', user?.id || '')
        .limit(20);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
  }, [user?.id]);

  const handleSendRequest = async (playerId: string, playerUserId: string) => {
    setSending(playerId);
    try {
      await sendFriendRequest(playerUserId);
      Alert.alert('Request Sent', 'Friend request sent successfully!');
      setSearchResults(prev => prev.filter(p => p.id !== playerId));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send request.');
    } finally {
      setSending(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    Alert.alert('Cancel Request', 'Cancel this friend request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Request', style: 'destructive',
        onPress: async () => {
          try { await cancelRequest(requestId); }
          catch (e: any) { Alert.alert('Error', e?.message || 'Failed to cancel request.'); }
        },
      },
    ]);
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    try { await updateRequestStatus(requestId, status); }
    catch (e: any) { Alert.alert('Error', e?.message || 'Failed to update request.'); }
  };

  const alreadyFriendOrPending = (userId: string) =>
    friends.some(f => f.sender_id === userId || f.receiver_id === userId) ||
    pendingSent.some(r => r.receiver_id === userId) ||
    pendingReceived.some(r => r.sender_id === userId);

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Header ── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.lg }]}
      >
        <View>
          <Text style={s.headerTitle}>Network</Text>
          <Text style={s.headerSub}>Friends & players</Text>
        </View>
        <View style={s.headerCounts}>
          <View style={s.headerCountItem}>
            <Text style={s.headerCountVal}>{friends.length}</Text>
            <Text style={s.headerCountLabel}>Friends</Text>
          </View>
          {pendingReceived.length > 0 && (
            <View style={[s.headerCountItem, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={[s.headerCountVal, { color: '#fff' }]}>{pendingReceived.length}</Text>
              <Text style={[s.headerCountLabel, { color: 'rgba(255,255,255,0.8)' }]}>Pending</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search players by name..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={q => { handleSearch(q); if (q.length > 0) setActiveTab('find'); }}
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
      </View>

      {/* ── Pill tabs ── */}
      <View style={s.tabRow}>
        {TABS.map(t => {
          const count = t.id === 'requests' ? pendingReceived.length : t.id === 'friends' ? friends.length : 0;
          const active = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveTab(t.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabTxt, active && s.tabTxtActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={[s.tabPip, active && s.tabPipActive]}>
                  <Text style={[s.tabPipTxt, active && s.tabPipTxtActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Requests ── */}
        {activeTab === 'requests' && (
          loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : pendingReceived.length === 0 && pendingSent.length === 0 ? (
            <EmptyState
              icon="person-add-outline"
              title="No pending requests"
              sub='Find players to connect with in the "Find Players" tab.'
            />
          ) : (
            <>
              {pendingReceived.length > 0 && (
                <>
                  <SectionLabel text={`Received (${pendingReceived.length})`} />
                  {pendingReceived.map(req => (
                    <View key={req.id} style={s.personCard}>
                      <Avatar name={req.sender?.name || 'P'} size={48} imageUrl={req.sender?.profile_picture_url} />
                      <View style={s.personInfo}>
                        <Text style={s.personName}>{req.sender?.name || 'Unknown'}</Text>
                        {req.sender?.skill_level && (
                          <View style={s.chipRow}>
                            <View style={s.chip}><Text style={s.chipTxt}>Level {req.sender.skill_level}</Text></View>
                          </View>
                        )}
                      </View>
                      <View style={s.reqActions}>
                        <TouchableOpacity style={s.acceptBtn} onPress={() => handleRespond(req.id, 'accepted')}>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.declineBtn} onPress={() => handleRespond(req.id, 'declined')}>
                          <Ionicons name="close" size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}
              {pendingSent.length > 0 && (
                <>
                  <SectionLabel text={`Sent (${pendingSent.length})`} />
                  {pendingSent.map(req => (
                    <View key={req.id} style={s.personCard}>
                      <Avatar name={req.receiver?.name || 'P'} size={48} imageUrl={req.receiver?.profile_picture_url} />
                      <View style={s.personInfo}>
                        <Text style={s.personName}>{req.receiver?.name || 'Unknown'}</Text>
                        <Text style={s.personSub}>Pending response</Text>
                      </View>
                      <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancelRequest(req.id)}>
                        <Ionicons name="close" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </>
          )
        )}

        {/* ── Friends ── */}
        {activeTab === 'friends' && (
          loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : friends.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No friends yet"
              sub="Connect with other players to build your tennis network."
              btnLabel="Find Players"
              onBtn={() => setActiveTab('find')}
            />
          ) : (
            friends.map(req => {
              const friend = req.sender_id === user?.id ? req.receiver : req.sender;
              const friendUserId = req.sender_id === user?.id ? req.receiver_id : req.sender_id;
              return (
                <View key={req.id} style={s.personCard}>
                  <Avatar name={friend?.name || 'P'} size={48} imageUrl={friend?.profile_picture_url} />
                  <View style={s.personInfo}>
                    <Text style={s.personName}>{friend?.name || 'Unknown'}</Text>
                    <View style={s.chipRow}>
                      {friend?.skill_level && <View style={s.chip}><Text style={s.chipTxt}>Level {friend.skill_level}</Text></View>}
                      {friend?.usta_rating && <View style={s.chip}><Text style={s.chipTxt}>USTA {friend.usta_rating}</Text></View>}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={s.msgBtn}
                    onPress={() => navigation.navigate('Messages', { openDMUserId: friendUserId })}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              );
            })
          )
        )}

        {/* ── Find Players ── */}
        {activeTab === 'find' && (
          searchResults.length > 0 ? (
            searchResults.map(p => {
              const connected = alreadyFriendOrPending(p.user_id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={s.personCard}
                  onPress={() => setSelectedPlayer(p)}
                  activeOpacity={0.85}
                >
                  <Avatar name={p.name || 'P'} size={48} imageUrl={p.profile_picture_url} />
                  <View style={s.personInfo}>
                    <Text style={s.personName}>{p.name}</Text>
                    <View style={s.chipRow}>
                      {p.skill_level && <View style={s.chip}><Text style={s.chipTxt}>Level {p.skill_level}</Text></View>}
                      {p.city && <View style={s.chip}><Text style={s.chipTxt}>{p.city}</Text></View>}
                    </View>
                  </View>
                  {connected ? (
                    <View style={s.connectedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.addBtn}
                      onPress={() => handleSendRequest(p.id, p.user_id)}
                      disabled={sending === p.id}
                    >
                      {sending === p.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="person-add-outline" size={16} color="#fff" />}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          ) : searchQuery.length >= 1 && !searching ? (
            <EmptyState icon="search-outline" title="No players found" sub="Try a different name." />
          ) : (
            <EmptyState
              icon="search-outline"
              title="Search for players"
              sub="Type a name above to find players and send friend requests."
            />
          )
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 28, fontWeight: FontWeight.black, color: '#fff' },
  headerSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  headerCounts: { flexDirection: 'row', gap: Spacing.sm },
  headerCountItem: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignItems: 'center', minWidth: 52 },
  headerCountVal: { fontSize: FontSize.lg, fontWeight: FontWeight.black, color: '#fff' },
  headerCountLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },

  // ── Search ──
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, height: 46, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  // ── Tabs ──
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTxtActive: { color: '#fff' },
  tabPip: { backgroundColor: Colors.error, borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabPipActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabPipTxt: { fontSize: 10, fontWeight: FontWeight.bold, color: '#fff' },
  tabPipTxtActive: { color: '#fff' },

  // ── Content ──
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 32, gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.sm, marginBottom: 2 },

  // ── Person card ──
  personCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  personInfo: { flex: 1, gap: 4 },
  personName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  personSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { backgroundColor: Colors.surfaceWarm, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  // ── Actions ──
  reqActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  msgBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  connectedBadge: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  // ── Empty ──
  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.md },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceWarm, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  emptyBtnTxt: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
});
