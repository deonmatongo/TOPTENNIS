import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO } from 'date-fns';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useSendMatchInvite } from '@/hooks/useSendMatchInvite';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { ReportSheet } from '@/components/ui/ReportSheet';
import { useAuth } from '@/contexts/AuthContext';

function getLocation() {
  try { return require('expo-location') as typeof import('expo-location'); } catch { return null; }
}

export interface PlayerSearchResult {
  id: string;
  user_id: string;
  name: string;
  /** Phone-only accounts have no email. */
  email?: string | null;
  skill_level?: number;
  wins?: number;
  losses?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  city?: string;
  profile_picture_url?: string | null;
}

interface Props {
  player: PlayerSearchResult | null;
  visible: boolean;
  onClose: () => void;
  onMessage?: (userId: string) => void;
}

type SheetTab = 'profile' | 'availability';

const skillLabel = (level?: number) => {
  if (!level) return 'Unrated';
  if (level >= 7) return 'Advanced';
  if (level >= 4) return 'Intermediate';
  return 'Beginner';
};

const skillColor = (level?: number) => {
  if (!level) return Colors.textMuted;
  if (level >= 7) return Colors.error;
  if (level >= 4) return Colors.warning;
  return Colors.success;
};

const competitivenessLabel = (c?: string) => {
  switch (c) {
    case 'fun': return '🎾 Just for fun';
    case 'casual': return '😎 Casual';
    case 'competitive': return '🏆 Competitive';
    case 'serious': return '🔥 Serious';
    default: return 'Not specified';
  }
};

export const PlayerProfileSheet: React.FC<Props> = ({ player, visible, onClose, onMessage }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<SheetTab>('profile');
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string; start_time: string; end_time: string; id: string;
  } | null>(null);
  const [courtLocation, setCourtLocation] = useState('');
  const [message, setMessage] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [sent, setSent] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const { availability, loading: availLoading } = usePlayerAvailability(
    visible && player ? player.user_id : undefined
  );
  const { sendInvite, sending } = useSendMatchInvite();
  const { sendFriendRequest, friends, pendingSent, pendingReceived, updateRequestStatus } = useFriendRequests();
  const { blockUser } = useBlockedUsers();
  const [addingFriend, setAddingFriend] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showReport, setShowReport] = useState(false);

  if (!player) return null;

  const totalMatches = (player.wins || 0) + (player.losses || 0);
  const winRate = totalMatches > 0 ? Math.round(((player.wins || 0) / totalMatches) * 100) : 0;

  const isFriend = friends.some(f =>
    f.sender_id === player.user_id || f.receiver_id === player.user_id
  );
  const isPendingSent = pendingSent.some(r => r.receiver_id === player.user_id);
  const isPendingReceived = pendingReceived.some(r => r.sender_id === player.user_id);

  const handleAddFriend = async () => {
    setAddingFriend(true);
    try {
      await sendFriendRequest(player.user_id);
      Alert.alert('Request Sent', `Friend request sent to ${player.name}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send request');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptFriend = async () => {
    const req = pendingReceived.find(r => r.sender_id === player?.user_id);
    if (!req) return;
    try {
      await updateRequestStatus(req.id, 'accepted');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to accept request');
    }
  };

  const handleBlock = () => {
    Alert.alert(
      `Block ${player?.name}?`,
      'They won\'t be able to see your profile or contact you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            if (!player) return;
            setBlocking(true);
            const ok = await blockUser(player.user_id);
            setBlocking(false);
            if (ok) { Alert.alert('Blocked', `${player.name} has been blocked.`); onClose(); }
          },
        },
      ]
    );
  };

  const handleSelectSlot = (slot: { id: string; date: string; start_time: string; end_time: string }) => {
    setSelectedSlot(slot);
    setCourtLocation('');
    setMessage('');
    setSent(false);
    setShowBooking(true);
  };

  const handleUseMyLocation = async () => {
    const Location = getLocation();
    if (!Location) {
      Alert.alert('Unavailable', 'Location is not available. Please enter the court location manually.');
      return;
    }
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to use this feature. You can enter the court location manually.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (place) {
        const parts = [place.name, place.street, place.city, place.region].filter(Boolean);
        setCourtLocation(parts.join(', '));
      }
    } catch {
      Alert.alert('Location Unavailable', 'Could not get your current location. Please enter it manually.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedSlot) return;
    try {
      await sendInvite({
        receiver_id: player.user_id,
        date: selectedSlot.date,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        court_location: courtLocation.trim() || undefined,
        message: message.trim() || undefined,
        availability_id: selectedSlot.id,
      });
      setSent(true);
      Alert.alert('Match Request Sent!', `Your match request has been sent to ${player.name}.`, [
        { text: 'OK', onPress: () => { setShowBooking(false); onClose(); } },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send match request');
    }
  };

  // Group availability by date
  const slotsByDate = availability.reduce<Record<string, typeof availability>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const friendBtn = () => {
    if (isFriend) return (
      <View style={styles.friendBadge}>
        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
        <Text style={styles.friendBadgeText}>Friends</Text>
      </View>
    );
    if (isPendingSent) return (
      <View style={[styles.friendBadge, { backgroundColor: Colors.warningLight }]}>
        <Ionicons name="time-outline" size={14} color={Colors.warning} />
        <Text style={[styles.friendBadgeText, { color: Colors.warning }]}>Pending</Text>
      </View>
    );
    if (isPendingReceived) return (
      <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: Colors.primary }]} onPress={handleAcceptFriend}>
        <Ionicons name="checkmark-outline" size={14} color="#fff" />
        <Text style={styles.addFriendText}>Accept</Text>
      </TouchableOpacity>
    );
    return (
      <TouchableOpacity style={styles.addFriendBtn} onPress={handleAddFriend} disabled={addingFriend}>
        {addingFriend
          ? <ActivityIndicator size="small" color="#fff" />
          : <><Ionicons name="person-add-outline" size={14} color="#fff" /><Text style={styles.addFriendText}>Add Friend</Text></>
        }
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <LinearGradient colors={Colors.gradientWarm} style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.avatarCircle}>
              {player.profile_picture_url
                ? <Image source={{ uri: player.profile_picture_url }} style={styles.avatarImage} />
                : <Text style={styles.avatarText}>{(player.name || '?').charAt(0).toUpperCase()}</Text>
              }
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <View style={styles.headerBadges}>
                <View style={[styles.skillBadge, { backgroundColor: skillColor(player.skill_level) + '30' }]}>
                  <Text style={[styles.skillBadgeText, { color: skillColor(player.skill_level) === Colors.textMuted ? '#fff' : '#fff' }]}>
                    {skillLabel(player.skill_level)}{player.skill_level ? ` · ${player.skill_level}/10` : ''}
                  </Text>
                </View>
                {player.usta_rating && (
                  <View style={styles.ustaBadge}>
                    <Text style={styles.ustaBadgeText}>USTA {player.usta_rating}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {friendBtn()}
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{player.wins || 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{player.losses || 0}</Text>
            <Text style={styles.statLabel}>Losses</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{winRate}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalMatches}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(['profile', 'availability'] as SheetTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Ionicons
                name={t === 'profile' ? 'person-outline' : 'calendar-outline'}
                size={16}
                color={tab === t ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'profile' ? 'Profile' : 'Availability'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Profile Tab */}
          {tab === 'profile' && (
            <View style={styles.section}>
              {player.city && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{player.city}</Text>
                </View>
              )}
              {player.age_range && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>Age range: {player.age_range}</Text>
                </View>
              )}
              {player.competitiveness && (
                <View style={styles.infoRow}>
                  <Ionicons name="flame-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{competitivenessLabel(player.competitiveness)}</Text>
                </View>
              )}
              {/* Phone-only accounts have no email — hide the row entirely. */}
              {!!player.email?.trim() && (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{player.email.trim()}</Text>
                </View>
              )}

              {/* Win rate bar */}
              <View style={styles.barSection}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Win Rate</Text>
                  <Text style={styles.barValue}>{winRate}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${winRate}%`, backgroundColor: Colors.success }]} />
                </View>
              </View>
              {player.skill_level && (
                <View style={styles.barSection}>
                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>Skill Level</Text>
                    <Text style={styles.barValue}>{player.skill_level}/10</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(player.skill_level / 10) * 100}%`, backgroundColor: Colors.primary }]} />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.challengeBtn}
                onPress={() => setTab('availability')}
              >
                <Ionicons name="tennisball-outline" size={18} color="#fff" />
                <Text style={styles.challengeBtnText}>View Availability & Request Match</Text>
              </TouchableOpacity>

              {!isFriend && !isPendingSent && !isPendingReceived && (
                <TouchableOpacity
                  style={styles.addFriendBtnLarge}
                  onPress={handleAddFriend}
                  disabled={addingFriend}
                >
                  {addingFriend
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <><Ionicons name="person-add-outline" size={18} color={Colors.primary} /><Text style={styles.addFriendBtnLargeText}>Send Friend Request</Text></>
                  }
                </TouchableOpacity>
              )}
              {isPendingSent && (
                <View style={styles.pendingBanner}>
                  <Ionicons name="time-outline" size={16} color={Colors.warning} />
                  <Text style={styles.pendingBannerText}>Friend request sent — waiting for response</Text>
                </View>
              )}
              {isPendingReceived && (
                <View style={styles.pendingBanner}>
                  <Ionicons name="person-outline" size={16} color={Colors.primary} />
                  <Text style={styles.pendingBannerText}>This player sent you a friend request — check Requests in Messages</Text>
                </View>
              )}
              {isFriend && (
                <View style={[styles.pendingBanner, { backgroundColor: Colors.successLight || '#e6f9f0' }]}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={[styles.pendingBannerText, { color: Colors.success }]}>You are already friends</Text>
                </View>
              )}

              {/* Message button */}
              {onMessage && (
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={() => { onClose(); onMessage(player.user_id); }}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
                  <Text style={styles.messageBtnText}>Send Message</Text>
                </TouchableOpacity>
              )}

              {/* Report + Block */}
              <TouchableOpacity
                style={styles.blockBtn}
                onPress={() => setShowReport(true)}
                accessibilityRole="button"
                accessibilityLabel={`Report ${player?.name || 'player'}`}
              >
                <Ionicons name="flag-outline" size={16} color={Colors.error} />
                <Text style={styles.blockBtnText}>Report Player</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.blockBtn}
                onPress={handleBlock}
                disabled={blocking}
                accessibilityRole="button"
                accessibilityLabel={`Block ${player?.name || 'player'}`}
              >
                {blocking
                  ? <ActivityIndicator size="small" color={Colors.error} />
                  : <><Ionicons name="ban-outline" size={16} color={Colors.error} /><Text style={styles.blockBtnText}>Block Player</Text></>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Availability Tab */}
          {tab === 'availability' && (
            <View style={styles.section}>
              {availLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              ) : Object.keys(slotsByDate).length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={44} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No availability set</Text>
                  <Text style={styles.emptySub}>{player.name} hasn't added any available time slots yet.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.availHint}>Tap a slot to send a match request</Text>
                  {Object.entries(slotsByDate).map(([date, slots]) => (
                    <View key={date} style={styles.dateGroup}>
                      <Text style={styles.dateLabel}>
                        {format(parseISO(date), 'EEEE, MMM d')}
                      </Text>
                      {slots.map(slot => (
                        <TouchableOpacity
                          key={slot.id}
                          style={styles.slotRow}
                          onPress={() => handleSelectSlot(slot)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.slotTime}>
                            <Ionicons name="time-outline" size={16} color={Colors.primary} />
                            <Text style={styles.slotTimeText}>
                              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                            </Text>
                          </View>
                          {slot.notes ? (
                            <Text style={styles.slotNotes} numberOfLines={1}>{slot.notes}</Text>
                          ) : null}
                          <View style={styles.requestBtn}>
                            <Text style={styles.requestBtnText}>Request</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Booking Modal */}
        <Modal visible={showBooking} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowBooking(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <SafeAreaView style={styles.bookingSafe} edges={['top']}>
              <View style={styles.bookingHeader}>
                <TouchableOpacity onPress={() => setShowBooking(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.bookingTitle}>Send Match Request</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView
                style={styles.bookingBody}
                contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Slot summary */}
                <View style={styles.slotSummary}>
                  <LinearGradient colors={Colors.gradientWarm} style={styles.slotSummaryGrad}>
                    <Text style={styles.slotSummaryName}>{player.name}</Text>
                    {selectedSlot && (
                      <>
                        <Text style={styles.slotSummaryDate}>
                          {format(parseISO(selectedSlot.date), 'EEEE, MMMM d, yyyy')}
                        </Text>
                        <Text style={styles.slotSummaryTime}>
                          {selectedSlot.start_time.slice(0, 5)} – {selectedSlot.end_time.slice(0, 5)}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </View>

                {/* Court location */}
                <View>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Court Location (optional)</Text>
                    <TouchableOpacity
                      style={styles.geoBtn}
                      onPress={handleUseMyLocation}
                      disabled={fetchingLocation}
                    >
                      {fetchingLocation
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <><Ionicons name="locate-outline" size={13} color={Colors.primary} /><Text style={styles.geoBtnText}>Use My Location</Text></>
                      }
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Downtown Tennis Center, Court 3"
                    placeholderTextColor={Colors.textMuted}
                    value={courtLocation}
                    onChangeText={setCourtLocation}
                  />
                </View>

                {/* Message */}
                <View>
                  <Text style={styles.fieldLabel}>Message (optional)</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputMulti]}
                    placeholder="Add a note to your match request..."
                    placeholderTextColor={Colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                  onPress={handleSendRequest}
                  disabled={sending}
                >
                  {sending
                    ? <ActivityIndicator color="#fff" />
                    : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.sendBtnText}>Send Match Request</Text></>
                  }
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        <ReportSheet
          visible={showReport}
          onClose={() => setShowReport(false)}
          context="profile"
          targetUserId={player?.user_id}
          refId={player?.user_id}
          subjectLabel={player?.name}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  closeBtn: { alignSelf: 'center', marginBottom: Spacing.md, width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: FontWeight.bold },
  headerInfo: { flex: 1, gap: 6 },
  playerName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#fff' },
  headerBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  skillBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  skillBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#fff' },
  ustaBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  ustaBadgeText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.medium },

  friendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
  friendBadgeText: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.semibold },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  addFriendText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  statsRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Spacing.md },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  body: { flex: 1 },
  bodyContent: { paddingBottom: Spacing.xxxl },
  section: { padding: Spacing.lg, gap: Spacing.md },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  infoText: { fontSize: FontSize.md, color: Colors.text },

  barSection: { gap: 6 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  barValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  barTrack: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  challengeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.sm },
  challengeBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  addFriendBtnLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md },
  addFriendBtnLargeText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.warningLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pendingBannerText: { fontSize: FontSize.sm, color: Colors.warning, flex: 1 },

  availHint: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  dateGroup: { marginBottom: Spacing.lg },
  dateLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  slotRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: 6, gap: Spacing.sm },
  slotTime: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  slotTimeText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  slotNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  requestBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
  requestBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  emptyCard: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // Booking modal
  bookingSafe: { flex: 1, backgroundColor: Colors.background },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bookingTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  bookingBody: { flex: 1 },
  slotSummary: { borderRadius: Radius.lg, overflow: 'hidden' },
  slotSummaryGrad: { padding: Spacing.lg, gap: 4 },
  slotSummaryName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff' },
  slotSummaryDate: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.9)' },
  slotSummaryTime: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#fff' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  geoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.primaryLight, borderRadius: Radius.full },
  geoBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  fieldInput: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  fieldInputMulti: { height: 90, paddingTop: Spacing.sm },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md + 2 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md },
  messageBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  blockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  blockBtnText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});
