import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

export interface PlayerSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  /** Phone-only accounts have no email. */
  email?: string | null;
  skill_level?: number;
  usta_rating?: string;
  wins: number;
  losses: number;
  competitiveness?: string;
  age_range?: string;
  city?: string;
  profile_picture_url?: string;
}

interface Props {
  visible: boolean;
  player: PlayerSearchResult | null;
  onClose: () => void;
  onSendMessage?: (player: PlayerSearchResult) => void;
  onChallengeMatch?: (player: PlayerSearchResult) => void;
}

const getSkillLabel = (level?: number) => {
  if (!level) return 'Not rated';
  if (level >= 7) return 'Advanced';
  if (level >= 4) return 'Intermediate';
  return 'Beginner';
};

const getSkillColor = (level?: number) => {
  if (!level) return Colors.textMuted;
  if (level >= 8) return '#dc2626';
  if (level >= 6) return '#ea580c';
  if (level >= 4) return '#ca8a04';
  return Colors.success;
};

const getCompetitivenessLabel = (c?: string) => {
  switch (c) {
    case 'fun': return '🎾 Just for fun';
    case 'casual': return '😎 Casual but competitive';
    case 'competitive': return '🏆 Very competitive';
    default: return 'Not specified';
  }
};

const getAgeRangeLabel = (a?: string) => {
  switch (a) {
    case 'under-18': return 'Under 18';
    case '18-29': return '18-29';
    case '30-39': return '30-39';
    case '40-49': return '40-49';
    case '50-59': return '50-59';
    case '60-plus': return '60+';
    default: return 'Not specified';
  }
};

export const PlayerProfileModal: React.FC<Props> = ({ visible, player, onClose, onSendMessage, onChallengeMatch }) => {
  const { user } = useAuth();
  const { sendFriendRequest, requests } = useFriendRequests();
  const [actionLoading, setActionLoading] = useState(false);

  if (!player) return null;

  const totalMatches = (player.wins || 0) + (player.losses || 0);
  const winRate = totalMatches > 0 ? Math.round(((player.wins || 0) / totalMatches) * 100) : 0;
  const initials = `${player.first_name?.[0] || ''}${player.last_name?.[0] || ''}`.toUpperCase();
  const fullName = `${player.first_name} ${player.last_name}`.trim();

  const relationship = requests.find(r =>
    (r.sender_id === user?.id && r.receiver_id === player.id) ||
    (r.receiver_id === user?.id && r.sender_id === player.id)
  );
  const isFriend = relationship?.status === 'accepted';
  const isPending = relationship?.status === 'pending';

  const handleAddFriend = async () => {
    setActionLoading(true);
    try {
      await sendFriendRequest(player.id);
      Alert.alert('Friend Request Sent', `A friend request has been sent to ${fullName}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send friend request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = () => {
    onSendMessage?.(player);
    onClose();
  };

  const handleChallenge = () => {
    onChallengeMatch?.(player);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Player Profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              {isFriend && (
                <View style={styles.friendBadge}>
                  <Ionicons name="people" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.heroName}>{fullName}</Text>
            {player.city && (
              <View style={styles.heroLocation}>
                <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.heroLocationText}>{player.city}</Text>
              </View>
            )}
            <View style={styles.heroBadges}>
              <View style={[styles.skillBadge, { borderColor: getSkillColor(player.skill_level) }]}>
                <Text style={[styles.skillBadgeText, { color: getSkillColor(player.skill_level) }]}>
                  {getSkillLabel(player.skill_level)} • {player.skill_level || '?'}/10
                </Text>
              </View>
              {player.usta_rating && (
                <View style={styles.ustaBadge}>
                  <Text style={styles.ustaBadgeText}>USTA {player.usta_rating}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{player.wins || 0}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{player.losses || 0}</Text>
              <Text style={styles.statLabel}>Losses</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalMatches}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: winRate >= 50 ? Colors.success : Colors.error }]}>{winRate}%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Player Info</Text>
            <View style={styles.detailRow}>
              <Ionicons name="tennisball-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.detailLabel}>Style</Text>
              <Text style={styles.detailValue}>{getCompetitivenessLabel(player.competitiveness)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.detailLabel}>Age Group</Text>
              <Text style={styles.detailValue}>{getAgeRangeLabel(player.age_range)}</Text>
            </View>
            {/* Phone-only accounts have no email — hide the row entirely rather
                than rendering a dead mailto: link. */}
            {!!player.email?.trim() && (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Email</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${player.email!.trim()}`)}>
                  <Text style={[styles.detailValue, styles.detailLink]}>{player.email.trim()}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Win rate bar */}
          <View style={styles.winRateCard}>
            <View style={styles.winRateHeader}>
              <Text style={styles.winRateTitle}>Win Rate</Text>
              <Text style={[styles.winRateNum, { color: winRate >= 50 ? Colors.success : Colors.error }]}>{winRate}%</Text>
            </View>
            <View style={styles.winRateBar}>
              <View style={[styles.winRateFill, { width: `${winRate}%` as any, backgroundColor: winRate >= 50 ? Colors.success : Colors.error }]} />
            </View>
            <Text style={styles.winRateSub}>{player.wins} wins out of {totalMatches} matches</Text>
          </View>
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.footer}>
          {!isFriend && !isPending && user?.id !== player.id && (
            <TouchableOpacity style={styles.addFriendBtn} onPress={handleAddFriend} disabled={actionLoading}>
              {actionLoading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <><Ionicons name="person-add-outline" size={18} color={Colors.primary} /><Text style={styles.addFriendBtnText}>Add Friend</Text></>
              }
            </TouchableOpacity>
          )}
          {isPending && (
            <View style={styles.pendingBtn}>
              <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.pendingBtnText}>Request Sent</Text>
            </View>
          )}
          {isFriend && (
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
              <Ionicons name="chatbubble-outline" size={18} color="#fff" />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          )}
          {user?.id !== player.id && (
            <TouchableOpacity style={styles.challengeBtn} onPress={handleChallenge}>
              <Ionicons name="tennisball-outline" size={18} color="#fff" />
              <Text style={styles.challengeBtnText}>Challenge</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  closeBtn: { padding: Spacing.xs },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.lg, gap: Spacing.md },

  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.xxl },
  friendBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background },
  heroName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLocationText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  skillBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1.5 },
  skillBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  ustaBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  ustaBadgeText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  statItem: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.borderLight },

  detailsCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  detailsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, width: 80 },
  detailValue: { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
  detailLink: { color: Colors.primary },

  winRateCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  winRateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  winRateTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  winRateNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  winRateBar: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  winRateFill: { height: '100%', borderRadius: 4 },
  winRateSub: { fontSize: FontSize.xs, color: Colors.textSecondary },

  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  addFriendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary },
  addFriendBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
  pendingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  pendingBtnText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: FontWeight.medium },
  messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary },
  messageBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
  challengeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: '#ea580c' },
  challengeBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
});
