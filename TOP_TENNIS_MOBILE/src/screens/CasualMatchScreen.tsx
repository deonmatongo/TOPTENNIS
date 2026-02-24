import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useMatchSuggestions } from '@/hooks/useMatchSuggestions';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { supabase } from '@/services/supabase';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';

type Mode = 'selection' | 'ai' | 'search';

export const CasualMatchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
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
      const { data } = await supabase
        .from('players')
        .select('id, user_id, name, skill_level, usta_rating, city, wins, losses, profile_picture_url')
        .ilike('name', `%${q}%`)
        .neq('id', player?.id || '')
        .limit(15);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
  }, [player?.id]);

  const friendStatus = (userId: string) => {
    if (friends.some(f => f.sender_id === userId || f.receiver_id === userId)) return 'friend';
    if (pendingSent.some(r => r.receiver_id === userId)) return 'pending';
    if (pendingReceived.some(r => r.sender_id === userId)) return 'received';
    return 'none';
  };

  const handleInvite = (opponent: any) => {
    setSelectedPlayer(opponent);
  };

  const winRate = (p: any) => {
    const t = (p.wins || 0) + (p.losses || 0);
    return t > 0 ? Math.round((p.wins / t) * 100) : 0;
  };

  const PlayerCard = ({ p }: { p: any }) => {
    const status = friendStatus(p.user_id);
    return (
      <TouchableOpacity style={styles.playerCard} onPress={() => setSelectedPlayer(p)} activeOpacity={0.8}>
        <Avatar name={p.name || 'P'} size={52} imageUrl={p.profile_picture_url} />
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={styles.playerName}>{p.name}</Text>
            {status === 'friend' && (
              <View style={styles.friendChip}><Ionicons name="checkmark-circle" size={12} color={Colors.success} /><Text style={styles.friendChipText}>Friends</Text></View>
            )}
            {status === 'pending' && (
              <View style={[styles.friendChip, { backgroundColor: Colors.warningLight }]}><Ionicons name="time-outline" size={12} color={Colors.warning} /><Text style={[styles.friendChipText, { color: Colors.warning }]}>Pending</Text></View>
            )}
          </View>
          <View style={styles.playerMeta}>
            {p.skill_level && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>Level {p.skill_level}</Text>
              </View>
            )}
            {p.usta_rating && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>USTA {p.usta_rating}</Text>
              </View>
            )}
            {p.city && (
              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.metaChipText}>{p.city}</Text>
              </View>
            )}
          </View>
          <Text style={styles.playerRecord}>{p.wins || 0}W – {p.losses || 0}L · {winRate(p)}% win rate</Text>
          {p.compatibility_score != null && (
            <View style={styles.compatRow}>
              <View style={styles.compatBar}>
                <View style={[styles.compatFill, { width: `${p.compatibility_score}%` }]} />
              </View>
              <Text style={styles.compatText}>{p.compatibility_score}% match</Text>
            </View>
          )}
        </View>
        <View style={styles.inviteBtn}>
          <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
          <Text style={styles.inviteBtnText}>View & Invite</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelection = () => (
    <View style={styles.selectionWrap}>
      <Text style={styles.selectionTitle}>Find Your Opponent</Text>
      <Text style={styles.selectionSub}>How would you like to find an opponent?</Text>
      <View style={styles.modeCards}>
        <TouchableOpacity style={styles.modeCard} onPress={() => setMode('ai')} activeOpacity={0.8}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.modeIconWrap}>
            <Ionicons name="flash" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.modeTitle}>AI Recommendations</Text>
          <Text style={styles.modeSub}>Get matched with players at your skill level automatically</Text>
          <View style={styles.modeArrow}>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeCard} onPress={() => setMode('search')} activeOpacity={0.8}>
          <LinearGradient colors={Colors.gradientBlue} style={styles.modeIconWrap}>
            <Ionicons name="search" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.modeTitle}>Search Players</Text>
          <Text style={styles.modeSub}>Find a specific player by name and invite them to a match</Text>
          <View style={styles.modeArrow}>
            <Ionicons name="arrow-forward" size={16} color={Colors.accent} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAI = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.backRow} onPress={() => setMode('selection')}>
        <Ionicons name="chevron-back" size={18} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Recommended Opponents</Text>
      <Text style={styles.sectionSub}>Players matched to your skill level {player?.skill_level ? `(${player.skill_level}/10)` : ''}</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : suggestions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No suggestions yet</Text>
          <Text style={styles.emptySub}>Make sure your skill level is set in your profile and networking is enabled.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.emptyBtnText}>Update Profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        suggestions.map(p => <PlayerCard key={p.id} p={p} />)
      )}
    </View>
  );

  const renderSearch = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.backRow} onPress={() => setMode('selection')}>
        <Ionicons name="chevron-back" size={18} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Search Players</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          autoFocus
        />
        {searching && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>
      {searchResults.length > 0 ? (
        searchResults.map(p => <PlayerCard key={p.id} p={p} />)
      ) : searchQuery.length >= 1 && !searching ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No players found</Text>
          <Text style={styles.emptySub}>Try a different name.</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Casual Match" subtitle="Find an opponent" navigation={navigation} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        <View style={styles.content}>
          {mode === 'selection' && renderSelection()}
          {mode === 'ai' && renderAI()}
          {mode === 'search' && renderSearch()}
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
  content: { padding: Spacing.lg },

  selectionWrap: { gap: Spacing.lg },
  selectionTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text, textAlign: 'center' },
  selectionSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  modeCards: { gap: Spacing.md },
  modeCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md, position: 'relative' },
  modeIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  modeSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modeArrow: { position: 'absolute', top: Spacing.xl, right: Spacing.xl },

  section: { gap: Spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  backText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 50 },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  playerCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  playerInfo: { flex: 1, gap: 4 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  playerName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  friendChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  friendChipText: { fontSize: 10, color: Colors.success, fontWeight: FontWeight.semibold },
  playerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  metaChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  playerRecord: { fontSize: FontSize.xs, color: Colors.textMuted },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  compatBar: { flex: 1, height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  compatFill: { height: 4, backgroundColor: Colors.success, borderRadius: 2 },
  compatText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primaryMuted },
  inviteBtnText: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: FontWeight.semibold },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});
