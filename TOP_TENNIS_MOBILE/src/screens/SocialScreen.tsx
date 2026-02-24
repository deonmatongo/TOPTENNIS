import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';

type Tab = 'requests' | 'friends' | 'find';

export const SocialScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { pendingReceived, pendingSent, friends, loading, updateRequestStatus, sendFriendRequest, refetch } = useFriendRequests();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      await updateRequestStatus(requestId, status);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update request.');
    }
  };

  const alreadyFriendOrPending = (userId: string) => {
    return friends.some(f => f.sender_id === userId || f.receiver_id === userId) ||
      pendingSent.some(r => r.receiver_id === userId) ||
      pendingReceived.some(r => r.sender_id === userId);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'requests', label: 'Requests', count: pendingReceived.length },
    { id: 'friends', label: 'Friends', count: friends.length },
    { id: 'find', label: 'Find Players' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Build Your Network" subtitle="Friends & connections" navigation={navigation} showBack />

      {/* Persistent Search Bar */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
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

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.tabActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
            {t.count != null && t.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.content}>
          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <>
              {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              ) : pendingReceived.length === 0 && pendingSent.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="person-add-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No pending requests</Text>
                  <Text style={styles.emptySub}>Find players to connect with in the "Find Players" tab.</Text>
                </View>
              ) : (
                <>
                  {pendingReceived.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Received ({pendingReceived.length})</Text>
                      {pendingReceived.map(req => (
                        <View key={req.id} style={styles.requestCard}>
                          <Avatar name={req.sender?.name || 'P'} size={48} imageUrl={req.sender?.profile_picture_url} />
                          <View style={styles.requestInfo}>
                            <Text style={styles.requestName}>{req.sender?.name || 'Unknown'}</Text>
                            {req.sender?.skill_level && (
                              <Text style={styles.requestMeta}>Level {req.sender.skill_level}/10</Text>
                            )}
                          </View>
                          <View style={styles.requestActions}>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(req.id, 'accepted')}>
                              <Ionicons name="checkmark" size={18} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(req.id, 'declined')}>
                              <Ionicons name="close" size={18} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {pendingSent.length > 0 && (
                    <>
                      <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Sent ({pendingSent.length})</Text>
                      {pendingSent.map(req => (
                        <View key={req.id} style={styles.requestCard}>
                          <Avatar name={req.receiver?.name || 'P'} size={48} imageUrl={req.receiver?.profile_picture_url} />
                          <View style={styles.requestInfo}>
                            <Text style={styles.requestName}>{req.receiver?.name || 'Unknown'}</Text>
                            <Text style={styles.requestMeta}>Pending response</Text>
                          </View>
                          <View style={[styles.pendingBadge]}>
                            <Text style={styles.pendingText}>Pending</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <>
              {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              ) : friends.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptySub}>Connect with other players to build your tennis network.</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab('find')}>
                    <Text style={styles.emptyBtnText}>Find Players</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                friends.map(req => {
                  const friend = req.sender_id === user?.id ? req.receiver : req.sender;
                  return (
                    <View key={req.id} style={styles.friendCard}>
                      <Avatar name={friend?.name || 'P'} size={48} imageUrl={friend?.profile_picture_url} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend?.name || 'Unknown'}</Text>
                        <View style={styles.friendMeta}>
                          {friend?.skill_level && (
                            <View style={styles.metaChip}>
                              <Text style={styles.metaChipText}>Level {friend.skill_level}</Text>
                            </View>
                          )}
                          {friend?.usta_rating && (
                            <View style={styles.metaChip}>
                              <Text style={styles.metaChipText}>USTA {friend.usta_rating}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.challengeBtn}
                        onPress={() => navigation.navigate('Messages')}
                      >
                        <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </>
          )}

          {/* Find Players Tab */}
          {activeTab === 'find' && (
            <>
              {searchResults.length > 0 ? (
                searchResults.map(p => {
                  const alreadyConnected = alreadyFriendOrPending(p.user_id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.friendCard}
                      onPress={() => setSelectedPlayer(p)}
                      activeOpacity={0.8}
                    >
                      <Avatar name={p.name || 'P'} size={48} imageUrl={p.profile_picture_url} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{p.name}</Text>
                        <View style={styles.friendMeta}>
                          {p.skill_level && <View style={styles.metaChip}><Text style={styles.metaChipText}>Level {p.skill_level}</Text></View>}
                          {p.city && <View style={styles.metaChip}><Text style={styles.metaChipText}>{p.city}</Text></View>}
                        </View>
                      </View>
                      {alreadyConnected ? (
                        <View style={styles.connectedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                        </View>
                      ) : (
                        <View style={styles.addBtn}>
                          <Ionicons name="chevron-forward" size={16} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : searchQuery.length >= 1 && !searching ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No players found</Text>
                  <Text style={styles.emptySub}>Try a different name.</Text>
                </View>
              ) : searchQuery.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>Search for players</Text>
                  <Text style={styles.emptySub}>Type a name to find players and send friend requests.</Text>
                </View>
              ) : null}
            </>
          )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  tabBadge: { backgroundColor: Colors.error, borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },

  content: { padding: Spacing.lg, gap: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  requestCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  requestInfo: { flex: 1 },
  requestName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  requestMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: Spacing.sm },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  pendingBadge: { backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  pendingText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },

  friendCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  friendInfo: { flex: 1, gap: 4 },
  friendName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  friendMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaChip: { backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  metaChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  challengeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  connectedBadge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  searchBarWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, height: 50 },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});
