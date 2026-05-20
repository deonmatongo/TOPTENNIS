import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, parseISO, startOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAvailability, AvailabilitySlot } from '@/hooks/useUserAvailability';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useMatchInvites, MatchInviteRecord } from '@/hooks/useMatchInvites';
import { Colors, Palette, Font, Spacing, Radius, Shadow } from '@/theme/colors';
import { Avatar } from '@/components/ui/Avatar';

// ── helpers ────────────────────────────────────────────────────────────────────

function hourLabel(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function fmtTime(t: string) {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr), m = parseInt(mStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const disp = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${disp}:${mStr.padStart(2, '0')} ${suffix}`;
}

function fmtDate(d: string) {
  return format(parseISO(d), 'EEE, MMM d');
}

function slotCoversHour(slots: AvailabilitySlot[], date: string, hour: number): boolean {
  return slots.some(s => {
    if (s.date !== date) return false;
    const start = parseInt(s.start_time.split(':')[0]);
    const end   = parseInt(s.end_time.split(':')[0]);
    return hour >= start && hour < end;
  });
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7AM – 10PM

// ── MatchInviteCard ────────────────────────────────────────────────────────────

interface MatchInviteCardProps {
  inviteId: string;
  isMine: boolean;
}

export const MatchInviteCard: React.FC<MatchInviteCardProps> = ({ inviteId, isMine }) => {
  const { user } = useAuth();
  const { fetchInvite, respondToInvite, acceptProposedTime, cancelInvite } = useMatchInvites();
  const [invite, setInvite] = useState<MatchInviteRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchInvite(inviteId);
    setInvite(data);
  }, [inviteId, fetchInvite]);

  useEffect(() => { load(); }, [load]);

  if (!invite) {
    return (
      <View style={mc.card}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  const isReceiver = invite.receiver_id === user?.id;
  const hasPending = invite.status === 'pending';
  const hasProposal = !!(invite.proposed_date && invite.proposed_start_time);
  const proposedByMe = invite.proposed_by_user_id === user?.id;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); }
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const statusColour = invite.status === 'accepted'
    ? Colors.success
    : invite.status === 'declined' || invite.status === 'cancelled'
    ? Colors.error
    : Colors.warning;

  const statusLabel = invite.status === 'accepted' ? 'Confirmed'
    : invite.status === 'declined' ? 'Declined'
    : invite.status === 'cancelled' ? 'Cancelled'
    : 'Pending';

  const otherName = isReceiver
    ? `${invite.sender?.first_name ?? ''} ${invite.sender?.last_name ?? ''}`.trim()
    : `${invite.receiver?.first_name ?? ''} ${invite.receiver?.last_name ?? ''}`.trim();

  return (
    <View style={[mc.card, isMine ? mc.cardR : mc.cardL]}>
      {/* Header */}
      <View style={mc.cardHeader}>
        <View style={mc.cardIconWrap}>
          <Ionicons name="tennisball" size={18} color="#fff" />
        </View>
        <Text style={mc.cardTitle}>Match Invite</Text>
        <View style={[mc.statusBadge, { backgroundColor: statusColour + '22' }]}>
          <Text style={[mc.statusTxt, { color: statusColour }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={mc.cardBody}>
        <View style={mc.detailRow}>
          <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
          <Text style={mc.detailTxt}>vs {otherName || 'Player'}</Text>
        </View>
        <View style={mc.detailRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
          <Text style={mc.detailTxt}>{fmtDate(invite.date)}</Text>
        </View>
        <View style={mc.detailRow}>
          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
          <Text style={mc.detailTxt}>{fmtTime(invite.start_time)} – {fmtTime(invite.end_time)}</Text>
        </View>
        {invite.court_location && (
          <View style={mc.detailRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={mc.detailTxt}>{invite.court_location}</Text>
          </View>
        )}
        {invite.message && (
          <View style={mc.detailRow}>
            <Ionicons name="chatbubble-outline" size={13} color={Colors.textMuted} />
            <Text style={mc.detailTxt} numberOfLines={2}>{invite.message}</Text>
          </View>
        )}
      </View>

      {/* Proposal notice */}
      {hasProposal && (
        <View style={mc.proposalBanner}>
          <Ionicons name="swap-horizontal-outline" size={13} color={Colors.accent} />
          <Text style={mc.proposalTxt}>
            {proposedByMe ? 'You proposed' : `${otherName} proposed`}:{' '}
            {fmtDate(invite.proposed_date!)} · {fmtTime(invite.proposed_start_time!)}
          </Text>
        </View>
      )}

      {/* Actions */}
      {busy ? (
        <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
      ) : (
        <View style={mc.actions}>
          {/* Pending + I'm receiver → Accept / Decline */}
          {hasPending && isReceiver && !hasProposal && (
            <>
              <TouchableOpacity
                style={[mc.btn, mc.btnAccept]}
                onPress={() => act(() => respondToInvite(invite.id, 'accepted'))}
              >
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={mc.btnTxt}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mc.btn, mc.btnDecline]}
                onPress={() => act(() => respondToInvite(invite.id, 'declined'))}
              >
                <Ionicons name="close" size={14} color={Colors.error} />
                <Text style={[mc.btnTxt, { color: Colors.error }]}>Decline</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Proposal waiting on me */}
          {hasProposal && !proposedByMe && (
            <>
              <TouchableOpacity
                style={[mc.btn, mc.btnAccept]}
                onPress={() => act(() => acceptProposedTime(invite))}
              >
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={mc.btnTxt}>Accept New Time</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mc.btn, mc.btnDecline]}
                onPress={() => act(() => respondToInvite(invite.id, 'declined'))}
              >
                <Text style={[mc.btnTxt, { color: Colors.error }]}>Decline</Text>
              </TouchableOpacity>
            </>
          )}

          {/* My pending invite → Cancel */}
          {hasPending && !isReceiver && (
            <TouchableOpacity
              style={[mc.btn, mc.btnOutline]}
              onPress={() => act(() => cancelInvite(invite.id))}
            >
              <Text style={[mc.btnTxt, { color: Colors.textMuted }]}>Cancel Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ── MatchBookingSheet ──────────────────────────────────────────────────────────

export interface BookingMember {
  userId: string;
  name: string;
  avatarUrl?: string;
}

interface MatchBookingSheetProps {
  visible: boolean;
  onClose: () => void;
  members: BookingMember[];        // other participants in the conversation
  onBooked: (inviteIds: string[]) => void;
}

type Step = 'slots' | 'confirm';

export const MatchBookingSheet: React.FC<MatchBookingSheetProps> = ({
  visible, onClose, members, onBooked,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sendMatchInvites } = useMatchInvites();

  // My availability
  const { availability: myAvail, loading: myLoading } = useUserAvailability();

  // For 1-on-1: load the other player's availability
  const otherUserId = members.length === 1 ? members[0].userId : undefined;
  const { availability: theirAvail, loading: theirLoading } = usePlayerAvailability(otherUserId);

  const [step, setStep] = useState<Step>('slots');
  const [selectedDay, setSelectedDay] = useState(0); // index into DAYS
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [court, setCourt] = useState('');
  const [msgText, setMsgText] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map(m => m.userId)),
  );
  const [sending, setSending] = useState(false);

  // Reset when sheet opens
  useEffect(() => {
    if (visible) {
      setStep('slots');
      setSelectedDay(0);
      setSelectedHour(null);
      setCourt('');
      setMsgText('');
      setSelectedMembers(new Set(members.map(m => m.userId)));
    }
  }, [visible, members]);

  // Build 14-day window
  const today = startOfDay(new Date());
  const DAYS = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const selectedDate = format(DAYS[selectedDay], 'yyyy-MM-dd');

  const mutualCount = DAYS.reduce((acc, d) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const mutual = HOURS.filter(h =>
      slotCoversHour(myAvail, dateStr, h) &&
      (members.length !== 1 || slotCoversHour(theirAvail, dateStr, h))
    ).length;
    return acc + mutual;
  }, 0);

  const startTime = selectedHour !== null ? `${String(selectedHour).padStart(2, '0')}:00:00` : '';
  const endTime   = selectedHour !== null ? `${String(selectedHour + 1).padStart(2, '0')}:00:00` : '';

  const toggleMember = (uid: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleBook = async () => {
    if (!user || selectedHour === null) return;
    const receivers = members.filter(m => selectedMembers.has(m.userId)).map(m => m.userId);
    if (!receivers.length) { Alert.alert('Select at least one player'); return; }
    setSending(true);
    try {
      const ids = await sendMatchInvites({
        receiverIds: receivers,
        date: selectedDate,
        startTime,
        endTime,
        courtLocation: court.trim() || undefined,
        message: msgText.trim() || undefined,
      });
      onBooked(ids);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const loading = myLoading || theirLoading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[bs.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={bs.header}>
          <TouchableOpacity onPress={onClose} style={bs.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={bs.headerCenter}>
            <Ionicons name="tennisball" size={18} color={Colors.primary} />
            <Text style={bs.headerTitle}>Book a Match</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {step === 'slots' && (
          <>
            {/* Mutual slots banner */}
            {!loading && members.length === 1 && (
              <View style={bs.banner}>
                <Ionicons
                  name={mutualCount > 0 ? 'star' : 'calendar-outline'}
                  size={14}
                  color={mutualCount > 0 ? Colors.warning : Colors.textMuted}
                />
                <Text style={bs.bannerTxt}>
                  {mutualCount > 0
                    ? `${mutualCount} mutual free slot${mutualCount > 1 ? 's' : ''} in the next 2 weeks`
                    : 'No shared availability found — pick any time'}
                </Text>
              </View>
            )}

            {/* Day tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={bs.dayBar}
              contentContainerStyle={bs.dayBarContent}
            >
              {DAYS.map((d, i) => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const hasMutual = HOURS.some(h =>
                  slotCoversHour(myAvail, dateStr, h) &&
                  (members.length !== 1 || slotCoversHour(theirAvail, dateStr, h))
                );
                const isActive = selectedDay === i;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[bs.dayBtn, isActive && bs.dayBtnActive]}
                    onPress={() => { setSelectedDay(i); setSelectedHour(null); }}
                  >
                    <Text style={[bs.dayName, isActive && bs.dayNameActive]}>
                      {i === 0 ? 'Today' : i === 1 ? 'Tmrw' : format(d, 'EEE')}
                    </Text>
                    <Text style={[bs.dayNum, isActive && bs.dayNumActive]}>{format(d, 'd')}</Text>
                    {hasMutual && <View style={[bs.dayDot, isActive && bs.dayDotActive]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time slot grid */}
            {loading ? (
              <View style={bs.loadWrap}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={bs.loadTxt}>Loading availability…</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={bs.slotsScroll}>
                {/* Per-day available slot count */}
                {(() => {
                  const availCount = HOURS.filter(h =>
                    slotCoversHour(myAvail, selectedDate, h) &&
                    (members.length !== 1 || slotCoversHour(theirAvail, selectedDate, h))
                  ).length;
                  const myCount = HOURS.filter(h => slotCoversHour(myAvail, selectedDate, h)).length;
                  const hasAny = members.length === 1 ? availCount > 0 : myCount > 0;
                  const count  = members.length === 1 ? availCount : myCount;
                  return (
                    <View style={[bs.daySlotNote, hasAny ? bs.daySlotNoteGreen : bs.daySlotNoteGray]}>
                      <Ionicons
                        name={hasAny ? 'checkmark-circle' : 'close-circle-outline'}
                        size={15}
                        color={hasAny ? Colors.success : Colors.textMuted}
                      />
                      <Text style={[bs.daySlotNoteTxt, { color: hasAny ? Colors.success : Colors.textMuted }]}>
                        {hasAny
                          ? `${count} available slot${count > 1 ? 's' : ''} on ${format(DAYS[selectedDay], 'EEE, MMM d')}`
                          : `No available slots on ${format(DAYS[selectedDay], 'EEE, MMM d')}`}
                      </Text>
                    </View>
                  );
                })()}

                {/* Legend */}
                {members.length === 1 && (
                  <View style={bs.legend}>
                    <View style={bs.legendItem}>
                      <View style={[bs.legendDot, { backgroundColor: Colors.success }]} />
                      <Text style={bs.legendTxt}>Both free</Text>
                    </View>
                    <View style={bs.legendItem}>
                      <View style={[bs.legendDot, { backgroundColor: Colors.accent }]} />
                      <Text style={bs.legendTxt}>Their time</Text>
                    </View>
                    <View style={bs.legendItem}>
                      <View style={[bs.legendDot, { backgroundColor: Palette.gray200 }]} />
                      <Text style={bs.legendTxt}>Unavailable</Text>
                    </View>
                  </View>
                )}

                <View style={bs.slotsGrid}>
                  {HOURS.map(h => {
                    const meAvail    = slotCoversHour(myAvail, selectedDate, h);
                    const themAvail  = members.length === 1
                      ? slotCoversHour(theirAvail, selectedDate, h)
                      : true;
                    const mutual     = meAvail && themAvail;
                    const myFree     = meAvail && !themAvail && members.length === 1;
                    const theirOnly  = !meAvail && themAvail && members.length === 1;
                    const isSelected = selectedHour === h;

                    let bg = '#f5f5f5';
                    let labelColor = Colors.textMuted;
                    let badge: string | null = null;
                    let badgeColor = '';
                    let borderColor = 'transparent';

                    if (mutual) {
                      bg = '#d4f5e0'; labelColor = '#1a7a45';
                      badge = '✓ Both free'; badgeColor = Colors.success;
                      borderColor = Colors.success + '55';
                    } else if (myFree) {
                      bg = '#e8faf0'; labelColor = Colors.success;
                      badge = 'My time'; badgeColor = Colors.success;
                      borderColor = Colors.success + '33';
                    } else if (theirOnly) {
                      bg = '#fff3e6'; labelColor = Colors.accent;
                      badge = 'Their time'; badgeColor = Colors.accent;
                    }

                    return (
                      <TouchableOpacity
                        key={h}
                        style={[
                          bs.slot,
                          { backgroundColor: bg, borderColor },
                          isSelected && bs.slotSelected,
                        ]}
                        onPress={() => {
                          setSelectedHour(h === selectedHour ? null : h);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[bs.slotTime, { color: isSelected ? '#fff' : labelColor }]}>
                          {hourLabel(h)}
                        </Text>
                        {badge && !isSelected && (
                          <View style={[bs.slotBadge, { backgroundColor: badgeColor + '22' }]}>
                            <Text style={[bs.slotBadgeTxt, { color: badgeColor }]}>{badge}</Text>
                          </View>
                        )}
                        {isSelected && (
                          <Text style={bs.slotSelectedTxt}>Selected ✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Continue button */}
            {selectedHour !== null && (
              <View style={bs.bottomBar}>
                <View style={bs.selectedSummary}>
                  <Ionicons name="calendar" size={14} color={Colors.primary} />
                  <Text style={bs.selectedSummaryTxt}>
                    {format(DAYS[selectedDay], 'MMM d')} · {hourLabel(selectedHour)} – {hourLabel(selectedHour + 1)}
                  </Text>
                </View>
                <TouchableOpacity style={bs.continueBtn} onPress={() => setStep('confirm')}>
                  <Text style={bs.continueBtnTxt}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {step === 'confirm' && selectedHour !== null && (
          <ScrollView style={bs.confirmScroll} contentContainerStyle={bs.confirmContent} keyboardShouldPersistTaps="handled">
            {/* Back */}
            <TouchableOpacity style={bs.backRow} onPress={() => setStep('slots')}>
              <Ionicons name="chevron-back" size={16} color={Colors.primary} />
              <Text style={bs.backTxt}>Change time</Text>
            </TouchableOpacity>

            {/* Summary card */}
            <View style={bs.summaryCard}>
              <View style={bs.summaryRow}>
                <Ionicons name="calendar" size={16} color={Colors.primary} />
                <Text style={bs.summaryVal}>{format(DAYS[selectedDay], 'EEEE, MMMM d, yyyy')}</Text>
              </View>
              <View style={bs.summaryRow}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={bs.summaryVal}>{hourLabel(selectedHour)} – {hourLabel(selectedHour + 1)}</Text>
              </View>
            </View>

            {/* Player selection (groups) */}
            {members.length > 1 && (
              <View style={bs.section}>
                <Text style={bs.sectionLabel}>Invite players</Text>
                {members.map(m => (
                  <TouchableOpacity
                    key={m.userId}
                    style={bs.memberRow}
                    onPress={() => toggleMember(m.userId)}
                  >
                    <Avatar name={m.name} size={34} imageUrl={m.avatarUrl} />
                    <Text style={bs.memberName}>{m.name}</Text>
                    <View style={[bs.checkbox, selectedMembers.has(m.userId) && bs.checkboxActive]}>
                      {selectedMembers.has(m.userId) && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Court location */}
            <View style={bs.section}>
              <Text style={bs.sectionLabel}>Court location (optional)</Text>
              <TextInput
                style={bs.textField}
                placeholder="e.g. Central Park Courts, Court 3"
                placeholderTextColor={Colors.textMuted}
                value={court}
                onChangeText={setCourt}
              />
            </View>

            {/* Message */}
            <View style={bs.section}>
              <Text style={bs.sectionLabel}>Message (optional)</Text>
              <TextInput
                style={[bs.textField, bs.textArea]}
                placeholder="Add a note to your invite…"
                placeholderTextColor={Colors.textMuted}
                value={msgText}
                onChangeText={setMsgText}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Send button */}
            <TouchableOpacity
              style={[bs.sendBtn, sending && { opacity: 0.6 }]}
              onPress={handleBook}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="tennisball" size={18} color="#fff" />
                    <Text style={bs.sendBtnTxt}>
                      Send Match Invite{selectedMembers.size > 1 ? ` (${selectedMembers.size})` : ''}
                    </Text>
                  </>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const mc = StyleSheet.create({
  card:        { borderRadius: Radius.lg, padding: 12, minWidth: 240, maxWidth: 300, backgroundColor: '#fff', ...Shadow.sm },
  cardL:       { alignSelf: 'flex-start' },
  cardR:       { alignSelf: 'flex-end' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIconWrap:{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardTitle:   { flex: 1, fontSize: 13, fontFamily: Font.bold, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusTxt:   { fontSize: 11, fontFamily: Font.semibold },
  cardBody:    { gap: 5, marginBottom: 8 },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailTxt:   { fontSize: 13, color: Colors.text, flex: 1 },
  proposalBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent + '15', borderRadius: Radius.sm, padding: 8, marginBottom: 8 },
  proposalTxt: { fontSize: 12, color: Colors.accent, flex: 1 },
  actions:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
  btnAccept:   { backgroundColor: Colors.success },
  btnDecline:  { borderWidth: 1.5, borderColor: Colors.error },
  btnOutline:  { borderWidth: 1, borderColor: Colors.border },
  btnTxt:      { fontSize: 13, fontFamily: Font.semibold, color: '#fff' },
});

const bs = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  headerCenter:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontFamily: Font.bold, color: Colors.text },

  banner:      { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 10, backgroundColor: Colors.warning + '18', borderRadius: Radius.md },
  bannerTxt:   { fontSize: 13, color: Colors.text, flex: 1 },

  dayBar:      { maxHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  dayBarContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 6, alignItems: 'center' },
  dayBtn:      { alignItems: 'center', width: 52, paddingVertical: 6, borderRadius: Radius.md, gap: 2 },
  dayBtnActive:{ backgroundColor: Colors.primary },
  dayName:     { fontSize: 11, fontFamily: Font.semibold, color: Colors.textMuted },
  dayNameActive: { color: '#fff' },
  dayNum:      { fontSize: 16, fontFamily: Font.bold, color: Colors.text },
  dayNumActive:{ color: '#fff' },
  dayDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.success },
  dayDotActive:{ backgroundColor: '#fff' },

  loadWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loadTxt:     { fontSize: 14, color: Colors.textMuted },

  slotsScroll: { flex: 1 },
  daySlotNote:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 12, marginTop: 10, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1 },
  daySlotNoteGreen: { backgroundColor: '#edfaf3', borderColor: '#a8eac5' },
  daySlotNoteGray:  { backgroundColor: '#f5f5f5', borderColor: Colors.borderLight },
  daySlotNoteTxt:   { fontSize: 13, fontFamily: Font.medium, flex: 1 },
  legend:      { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 10 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendTxt:   { fontSize: 11, color: Colors.textMuted },

  slotsGrid:   { paddingHorizontal: 12, paddingBottom: 120, gap: 6 },
  slot:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent' },
  slotSelected:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotTime:    { fontSize: 15, fontFamily: Font.medium },
  slotBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  slotBadgeTxt:{ fontSize: 11, fontFamily: Font.semibold },
  slotSelectedTxt: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: Font.medium },

  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedSummary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedSummaryTxt: { fontSize: 13, fontFamily: Font.medium, color: Colors.text },
  continueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full, ...Shadow.orange },
  continueBtnTxt: { color: '#fff', fontFamily: Font.bold, fontSize: 14 },

  confirmScroll: { flex: 1 },
  confirmContent: { padding: 16, gap: 16 },
  backRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backTxt:     { fontSize: 14, color: Colors.primary, fontFamily: Font.medium },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryVal:  { fontSize: 15, fontFamily: Font.semibold, color: Colors.text },
  section:     { gap: 8 },
  sectionLabel:{ fontSize: 12, fontFamily: Font.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  memberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberName:  { flex: 1, fontSize: 15, color: Colors.text, fontFamily: Font.medium },
  checkbox:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  textField:   { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.text },
  textArea:    { minHeight: 80, textAlignVertical: 'top' },
  sendBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, marginTop: 8, ...Shadow.orange },
  sendBtnTxt:  { fontSize: 16, fontFamily: Font.bold, color: '#fff' },
});
