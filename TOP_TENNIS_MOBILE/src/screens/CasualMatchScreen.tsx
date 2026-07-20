import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMatchSuggestions } from '@/hooks/useMatchSuggestions';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { Avatar } from '@/components/ui/Avatar';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';
import { Palette, Colors, Shadow, FontSize, Font, FontWeight, Spacing, Radius } from '@/theme/colors';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { searchPlayersByName } from '@/services/playerSearch';

type Mode = 'selection' | 'ai' | 'search';

const winRate = (p: any) => {
  const t = (p.wins || 0) + (p.losses || 0);
  return t > 0 ? Math.round((p.wins / t) * 100) : 0;
};

export const CasualMatchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { suggestions, loading } = useMatchSuggestions();
  const { player } = usePlayerProfile();
  const { friends, pendingSent, pendingReceived } = useFriendRequests();
  const [mode, setMode] = useState<Mode>('selection');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const rows = await searchPlayersByName(q, { excludePlayerId: player?.id, limit: 15 });
      setSearchResults(rows);
      setSearching(false);
    }, 350);
  }, [player?.id]);

  const friendStatus = (userId: string) => {
    if (friends.some(f => f.sender_id === userId || f.receiver_id === userId)) return 'friend';
    if (pendingSent.some(r => r.receiver_id === userId)) return 'pending';
    if (pendingReceived.some(r => r.sender_id === userId)) return 'received';
    return 'none';
  };

  const PlayerCard = ({ p }: { p: any }) => {
    const status = friendStatus(p.user_id);
    const wr = winRate(p);
    return (
      <TouchableOpacity style={s.playerCard} onPress={() => setSelectedPlayer(p)} activeOpacity={0.85}>
        <Avatar name={p.name || 'P'} size={52} imageUrl={p.profile_picture_url} />
        <View style={s.playerInfo}>
          <View style={s.playerNameRow}>
            <Text style={s.playerName}>{p.name}</Text>
            {status === 'friend' && (
              <View style={s.friendPill}>
                <Ionicons name="checkmark-circle" size={11} color={Colors.success} />
                <Text style={s.friendPillTxt}>Friends</Text>
              </View>
            )}
            {status === 'pending' && (
              <View style={[s.friendPill, { backgroundColor: Colors.warningLight }]}>
                <Ionicons name="time-outline" size={11} color={Colors.warning} />
                <Text style={[s.friendPillTxt, { color: Colors.warning }]}>Pending</Text>
              </View>
            )}
          </View>
          <View style={s.chipRow}>
            {p.skill_level && <View style={s.chip}><Text style={s.chipTxt}>Level {p.skill_level}</Text></View>}
            {p.usta_rating && <View style={s.chip}><Text style={s.chipTxt}>USTA {p.usta_rating}</Text></View>}
            {p.city && <View style={s.chip}><Ionicons name="location-outline" size={10} color={Colors.textMuted} /><Text style={s.chipTxt}>{p.city}</Text></View>}
          </View>
          <Text style={s.playerRecord}>{p.wins || 0}W — {p.losses || 0}L · {wr}% win rate</Text>
          {p.compatibility_score != null && (
            <View style={s.compatRow}>
              <View style={s.compatBar}>
                <View style={[s.compatFill, { width: `${p.compatibility_score}%` as any }]} />
              </View>
              <Text style={s.compatTxt}>{p.compatibility_score}% match</Text>
            </View>
          )}
        </View>
        <View style={s.inviteBtn}>
          <Ionicons name="calendar-outline" size={15} color={Colors.primary} />
          <Text style={s.inviteBtnTxt}>Invite</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Header ── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => mode !== 'selection' ? setMode('selection') : navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Casual Match</Text>
          <Text style={s.headerSub}>
            {mode === 'selection' ? 'Choose how to find an opponent' : mode === 'ai' ? 'AI Recommendations' : 'Search Players'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        {/* ── Selection mode ── */}
        {mode === 'selection' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Find Your Opponent</Text>
            <Text style={s.sectionSub}>Choose how you'd like to find a match</Text>

            {/* AI Mode */}
            <TouchableOpacity style={s.modeCard} onPress={() => setMode('ai')} activeOpacity={0.85}>
              <LinearGradient
                colors={[Palette.orange500, Palette.orange600]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.modeIcon}
              >
                <Ionicons name="flash" size={28} color="#fff" />
              </LinearGradient>
              <View style={s.modeInfo}>
                <Text style={s.modeTitle}>AI Recommendations</Text>
                <Text style={s.modeSub}>Matched to your skill level automatically</Text>
              </View>
              <View style={s.modeChevron}>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Search Mode */}
            <TouchableOpacity style={s.modeCard} onPress={() => setMode('search')} activeOpacity={0.85}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.modeIcon}
              >
                <Ionicons name="search" size={26} color="#fff" />
              </LinearGradient>
              <View style={s.modeInfo}>
                <Text style={s.modeTitle}>Search Players</Text>
                <Text style={s.modeSub}>Find a specific player by name</Text>
              </View>
              <View style={s.modeChevron}>
                <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
              </View>
            </TouchableOpacity>

            {/* Info card */}
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              <Text style={s.infoTxt}>After selecting an opponent, you can send a match invitation with date, time and location.</Text>
            </View>
          </View>
        )}

        {/* ── AI mode ── */}
        {mode === 'ai' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recommended Opponents</Text>
            <Text style={s.sectionSub}>
              Players matched to your skill level{player?.skill_level ? ` (${player.skill_level}/10)` : ''}
            </Text>
            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            ) : suggestions.length === 0 ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="people-outline" size={28} color={Colors.primary} />
                </View>
                <Text style={s.emptyTitle}>No suggestions yet</Text>
                <Text style={s.emptySub}>Make sure your skill level is set in your profile and networking is enabled.</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Profile')}>
                  <Text style={s.emptyBtnTxt}>Update Profile</Text>
                </TouchableOpacity>
              </View>
            ) : (
              suggestions.map(p => <PlayerCard key={p.id} p={p} />)
            )}
          </View>
        )}

        {/* ── Search mode ── */}
        {mode === 'search' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Search Players</Text>
            <View style={s.searchBar}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search by player name..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : searchQuery.length > 0
                  ? <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                      <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  : null}
            </View>
            {searchResults.length > 0 ? (
              searchResults.map(p => <PlayerCard key={p.id} p={p} />)
            ) : searchQuery.length >= 1 && !searching ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIconCircle}>
                  <Ionicons name="search-outline" size={28} color={Colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>No players found</Text>
                <Text style={s.emptySub}>Try a different name.</Text>
              </View>
            ) : null}
          </View>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

  section: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontFamily: Font.bold, color: Colors.text },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // ── Mode cards ──
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  modeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  modeInfo: { flex: 1, gap: 4 },
  modeTitle: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  modeSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  modeChevron: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceWarm, alignItems: 'center', justifyContent: 'center' },

  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryMuted },
  infoTxt: { flex: 1, fontSize: FontSize.xs, color: Colors.primaryDark, lineHeight: 18 },

  // ── Search bar ──
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, height: 50, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  // ── Player card ──
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.xs },
  playerInfo: { flex: 1, gap: 4 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  playerName: { fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.text },
  friendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  friendPillTxt: { fontSize: 10, color: Colors.success, fontFamily: Font.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.surfaceWarm, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  playerRecord: { fontSize: FontSize.xs, color: Colors.textMuted },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  compatBar: { flex: 1, height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  compatFill: { height: 4, backgroundColor: Colors.success, borderRadius: 2 },
  compatTxt: { fontSize: FontSize.xs, color: Colors.success, fontFamily: Font.semibold },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryMuted },
  inviteBtnTxt: { fontSize: FontSize.sm, color: Colors.primaryDark, fontFamily: Font.semibold },

  // ── Empty state ──
  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.md },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceWarm, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  emptyBtnTxt: { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.sm },
});
