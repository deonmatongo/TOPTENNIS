import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatches } from '@/hooks/useMatches';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useLeagueMatches } from '@/hooks/useLeagueMatches';
import { useCalendarExport } from '@/hooks/useCalendarExport';
import { Palette, Colors, Shadow, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  format, addDays, subDays, addWeeks, subWeeks,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isPast, parseISO, startOfDay,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth,
} from 'date-fns';

const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TIME_COL_W = 44;
const { width: SCREEN_W } = Dimensions.get('window');

type ViewMode = 'day' | 'week' | 'month';

interface CalEvent {
  id: string;
  type: 'availability' | 'match' | 'invite';
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  data: any;
}

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: -5 },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: -6 },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: -7 },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: -8 },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: -9 },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', offset: -10 },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)', offset: -7 },
];

type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly';

interface FormData {
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes: string;
  privacy_level: string;
  timezone: string;
}

interface RecurrenceData {
  pattern: RecurrencePattern;
  interval: number;
  endDate: string;
}

const DEFAULT_FORM: FormData = {
  date: '',
  start_time: '09:00',
  end_time: '10:00',
  is_available: true,
  notes: '',
  privacy_level: 'public',
  timezone: 'America/New_York',
};

const DEFAULT_RECURRENCE: RecurrenceData = { pattern: 'none', interval: 1, endDate: '' };

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${ap}`;
};
const hourLabel = (h: number) =>
  h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

const generateRecurringDates = (startDate: string, rec: RecurrenceData): string[] => {
  const dates: string[] = [startDate];
  if (rec.pattern === 'none') return dates;
  const base = new Date(startDate + 'T00:00:00');
  const end = rec.endDate ? new Date(rec.endDate + 'T00:00:00') : new Date(base.getTime() + 90 * 24 * 60 * 60 * 1000);
  let cur = new Date(base);
  const step = rec.interval || 1;
  for (let i = 0; i < 52; i++) {
    if (rec.pattern === 'daily') cur.setDate(cur.getDate() + step);
    else if (rec.pattern === 'weekly') cur.setDate(cur.getDate() + step * 7);
    else if (rec.pattern === 'monthly') cur.setMonth(cur.getMonth() + step);
    if (cur > end) break;
    dates.push(cur.toISOString().split('T')[0]);
  }
  return dates;
};

// ── Event color palette ───────────────────────────────────────────────────────
const EV = {
  avail:  { bg: '#DCFCE7', border: '#16A34A', text: '#15803D' },
  match:  { bg: '#DBEAFE', border: '#2563EB', text: '#1D4ED8' },
  invite: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  league: { bg: '#F3E8FF', border: '#9333EA', text: '#6B21A8' },
};

export const ScheduleScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { availability, loading, fetchAvailability, createAvailability, deleteAvailability } = useUserAvailability();
  const { invites, respondToInvite, refetch: refetchInvites } = useMatches();
  const { assignments } = useDivisionAssignments();
  const primaryDivisionId = assignments[0]?.division_id;
  const { userMatches: leagueMatches } = useLeagueMatches(primaryDivisionId);
  const { exportMultiple, exporting } = useCalendarExport();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [recurrence, setRecurrence] = useState<RecurrenceData>(DEFAULT_RECURRENCE);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [showEventSheet, setShowEventSheet] = useState(false);

  const goBack = () => {
    if (viewMode === 'day') setCurrentDate(d => subDays(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
  };
  const goForward = () => {
    if (viewMode === 'day') setCurrentDate(d => addDays(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  };

  const headerLabel = useMemo(() => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMM d');
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const we = endOfWeek(currentDate, { weekStartsOn: 0 });
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d')}`;
  }, [currentDate, viewMode]);

  const displayDays = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ws, end: endOfWeek(currentDate, { weekStartsOn: 0 }) });
  }, [currentDate, viewMode]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    (availability || []).forEach(slot => {
      if (!slot.is_available || slot.is_blocked) return;
      if (!map[slot.date]) map[slot.date] = [];
      map[slot.date].push({ id: slot.id, type: 'availability', date: slot.date, start_time: slot.start_time, end_time: slot.end_time, title: 'Available', bgColor: EV.avail.bg, borderColor: EV.avail.border, textColor: EV.avail.text, data: slot });
    });
    (invites || []).filter(i => i.status === 'accepted').forEach(inv => {
      if (!inv.date) return;
      if (!map[inv.date]) map[inv.date] = [];
      const other = inv.sender_id === user?.id ? inv.receiver : inv.sender;
      const name = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
      map[inv.date].push({ id: inv.id, type: 'match', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `vs ${name}`, bgColor: EV.match.bg, borderColor: EV.match.border, textColor: EV.match.text, data: inv });
    });
    (invites || []).filter(i => i.status === 'pending' && i.receiver_id === user?.id).forEach(inv => {
      if (!inv.date) return;
      if (!map[inv.date]) map[inv.date] = [];
      const sender = inv.sender;
      const name = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Someone';
      map[inv.date].push({ id: inv.id, type: 'invite', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `From ${name}`, bgColor: EV.invite.bg, borderColor: EV.invite.border, textColor: EV.invite.text, data: inv });
    });
    (leagueMatches || []).filter(m => m.scheduled_date && (m.status === 'scheduled' || m.status === 'pending')).forEach(m => {
      const date = m.scheduled_date!;
      if (!map[date]) map[date] = [];
      const startTime = m.scheduled_time || '09:00';
      const endHour = parseInt(startTime.split(':')[0]) + 1;
      const endTime = `${String(endHour).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
      map[date].push({ id: `league-${m.id}`, type: 'match', date, start_time: startTime, end_time: endTime, title: `🏆 vs ${m.opponent_name}`, bgColor: EV.league.bg, borderColor: EV.league.border, textColor: EV.league.text, data: { ...m, _isLeagueMatch: true } });
    });
    return map;
  }, [availability, invites, leagueMatches, user?.id]);

  const pendingInvites = useMemo(() =>
    (invites || []).filter(i => i.status === 'pending' && i.receiver_id === user?.id),
    [invites, user?.id]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAvailability(), refetchInvites()]);
    setRefreshing(false);
  };

  const openAdd = (date: Date, hour?: number) => {
    setFormData({ ...DEFAULT_FORM, date: format(date, 'yyyy-MM-dd'), start_time: hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : '09:00', end_time: hour !== undefined ? `${String(Math.min(hour + 1, 23)).padStart(2, '0')}:00` : '10:00' });
    setRecurrence(DEFAULT_RECURRENCE);
    setShowRecurrence(false);
    setTimeError(false);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setFormData(DEFAULT_FORM);
    setRecurrence(DEFAULT_RECURRENCE);
    setShowRecurrence(false);
    setTimeError(false);
  };

  const handleSaveSlot = async () => {
    if (!formData.date || !formData.start_time || !formData.end_time) { Alert.alert('Missing fields', 'Please fill in all fields.'); return; }
    if (formData.start_time >= formData.end_time) { setTimeError(true); Alert.alert('Invalid time', 'End time must be after start time.'); return; }
    setSaving(true);
    try {
      const fmt = (t: string) => t.length === 5 ? `${t}:00` : t;
      const base = { date: formData.date, start_time: fmt(formData.start_time), end_time: fmt(formData.end_time), is_available: formData.is_available, notes: formData.notes || undefined, privacy_level: formData.privacy_level, timezone: formData.timezone };
      if (recurrence.pattern !== 'none') {
        const slots = generateRecurringDates(formData.date, recurrence);
        for (const d of slots) await createAvailability({ ...base, date: d });
        Alert.alert('Done', `Created ${slots.length} recurring slots.`);
      } else {
        await createAvailability(base);
      }
      closeAddModal();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleEventTap = (ev: CalEvent) => { setSelectedEvent(ev); setShowEventSheet(true); };

  const handleDeleteAvailability = (id: string) => {
    Alert.alert('Delete Slot', 'Remove this availability slot?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAvailability(id); setShowEventSheet(false); } },
    ]);
  };

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    try { await respondToInvite(id, status); setShowEventSheet(false); }
    catch (e: any) { Alert.alert('Error', e?.message || 'Failed to respond.'); }
  };

  const getEventLayout = (start: string, end: string) => {
    const top = ((timeToMinutes(start) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(((timeToMinutes(end) - timeToMinutes(start)) / 60) * HOUR_HEIGHT - 2, 22);
    return { top, height };
  };

  const dayColW = viewMode === 'day'
    ? SCREEN_W - TIME_COL_W - 2
    : Math.floor((SCREEN_W - TIME_COL_W - 2) / 7);

  const handleExportAll = async () => {
    const acceptedMatches = (invites || []).filter(i => i.status === 'accepted' && i.date);
    const leagueScheduled = (leagueMatches || []).filter(m => m.scheduled_date && (m.status === 'scheduled' || m.status === 'pending'));
    const events = [
      ...acceptedMatches.map(inv => {
        const other = inv.sender_id === user?.id ? inv.receiver : inv.sender;
        const name = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
        return { title: `Tennis vs ${name}`, date: inv.date, startTime: inv.start_time, endTime: inv.end_time, location: inv.court_location };
      }),
      ...leagueScheduled.map(m => ({
        title: `🏆 League vs ${m.opponent_name}`,
        date: m.scheduled_date!,
        startTime: m.scheduled_time || '09:00',
        endTime: (() => { const h = parseInt((m.scheduled_time || '09:00').split(':')[0]) + 1; return `${String(h).padStart(2, '0')}:00`; })(),
        location: m.court_location,
      })),
    ];
    if (events.length === 0) { Alert.alert('Nothing to Export', 'No upcoming confirmed matches to add to your calendar.'); return; }
    await exportMultiple(events);
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top }]}
      >
        <View style={s.headerInner}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>Schedule</Text>
            <Text style={s.headerSub} numberOfLines={1}>{headerLabel}</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.hBtn} onPress={handleExportAll} disabled={exporting}>
              {exporting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="calendar-outline" size={20} color="#fff" />
              }
            </TouchableOpacity>
            <TouchableOpacity style={[s.hBtn, s.hBtnAdd]} onPress={() => openAdd(currentDate)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* View mode + navigation strip */}
        <View style={s.controlBar}>
          {/* Segmented control */}
          <View style={s.segControl}>
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <TouchableOpacity key={v} style={[s.segBtn, viewMode === v && s.segBtnActive]} onPress={() => setViewMode(v)}>
                <Text style={[s.segBtnText, viewMode === v && s.segBtnTextActive]}>
                  {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nav arrows + today */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navArrow} onPress={goBack}>
              <Ionicons name="chevron-back" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.todayPill} onPress={() => setCurrentDate(new Date())}>
              <Text style={s.todayPillText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.navArrow} onPress={goForward}>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <View style={s.legend}>
        {[
          { ...EV.avail, label: 'Available' },
          { ...EV.match, label: 'Match' },
          { ...EV.invite, label: 'Invite' },
          { ...EV.league, label: 'League' },
        ].map(l => (
          <View key={l.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: l.bg, borderColor: l.border }]} />
            <Text style={s.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Pending banner ─────────────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <TouchableOpacity style={s.pendingBanner} activeOpacity={0.8}>
          <View style={s.pendingDot} />
          <Ionicons name="mail-outline" size={14} color={EV.invite.text} />
          <Text style={s.pendingText}>
            {pendingInvites.length} pending invite{pendingInvites.length > 1 ? 's' : ''} — tap to respond
          </Text>
          <Ionicons name="chevron-forward" size={13} color={EV.invite.text} />
        </TouchableOpacity>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : viewMode === 'month' ? (
          <MonthGrid
            currentDate={currentDate}
            eventsByDate={eventsByDate}
            onDayPress={day => { setCurrentDate(day); setViewMode('day'); }}
          />
        ) : (
          <>
            {/* Day column headers */}
            <View style={[s.dayHeaders, { marginLeft: TIME_COL_W }]}>
              {displayDays.map(day => {
                const today = isToday(day);
                const pastDay = isPast(startOfDay(day)) && !today;
                const hasDot = (eventsByDate[format(day, 'yyyy-MM-dd')] || []).length > 0;
                return (
                  <View key={day.toISOString()} style={[s.dayHeader, { width: dayColW }, today && s.dayHeaderToday]}>
                    <Text style={[s.dayHeaderName, today && s.dayHeaderNameToday, pastDay && s.dimText]}>
                      {format(day, viewMode === 'week' ? 'EEE' : 'EEEE')}
                    </Text>
                    <View style={[s.dayNumCircle, today && s.dayNumCircleToday]}>
                      <Text style={[s.dayNum, today && s.dayNumToday, pastDay && s.dimText]}>
                        {format(day, viewMode === 'week' ? 'd' : 'MMM d')}
                      </Text>
                    </View>
                    {hasDot && <View style={[s.dayDot, today && s.dayDotToday]} />}
                  </View>
                );
              })}
            </View>

            {/* Time grid */}
            <View style={s.gridRow}>
              {/* Time labels */}
              <View style={[s.timeCol, { width: TIME_COL_W }]}>
                {HOURS.map(h => (
                  <View key={h} style={[s.timeCell, { height: HOUR_HEIGHT }]}>
                    <Text style={s.timeLabel}>{hourLabel(h)}</Text>
                  </View>
                ))}
              </View>

              {/* Day columns */}
              <View style={{ flex: 1, flexDirection: 'row' }}>
                {displayDays.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate[dateKey] || [];
                  const today = isToday(day);
                  const pastDay = isPast(startOfDay(day)) && !today;
                  return (
                    <View key={dateKey} style={{ width: dayColW }}>
                      {HOURS.map(h => (
                        <TouchableOpacity key={h}
                          style={[s.hourCell, { height: HOUR_HEIGHT, width: dayColW }, today && s.hourCellToday, pastDay && s.hourCellPast]}
                          onPress={() => !pastDay && openAdd(day, h)}
                          activeOpacity={pastDay ? 1 : 0.4}
                        />
                      ))}
                      <View style={StyleSheet.absoluteFill}>
                        {dayEvents.map(ev => {
                          const { top, height } = getEventLayout(ev.start_time, ev.end_time);
                          return (
                            <TouchableOpacity key={ev.id}
                              style={[s.eventBlock, { top, height, backgroundColor: ev.bgColor, borderLeftColor: ev.borderColor }]}
                              onPress={() => handleEventTap(ev)} activeOpacity={0.8}>
                              <Text style={[s.eventTitle, { color: ev.textColor }]} numberOfLines={1}>{ev.title}</Text>
                              {height > 28 && <Text style={[s.eventTime, { color: ev.textColor }]} numberOfLines={1}>{fmtTime(ev.start_time)}</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Upcoming matches */}
            {(invites || []).filter(i => i.status === 'accepted').length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>UPCOMING MATCHES</Text>
                {(invites || []).filter(i => i.status === 'accepted').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map(inv => {
                  const other = inv.sender_id === user?.id ? inv.receiver : inv.sender;
                  const name = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
                  return (
                    <View key={inv.id} style={s.matchCard}>
                      <View style={s.matchIconWrap}>
                        <Ionicons name="tennisball-outline" size={18} color={Colors.primary} />
                      </View>
                      <View style={s.matchInfo}>
                        <Text style={s.matchName}>vs {name}</Text>
                        <Text style={s.matchTime}>{format(parseISO(inv.date), 'EEE, MMM d')} · {fmtTime(inv.start_time)}–{fmtTime(inv.end_time)}</Text>
                        <Text style={s.matchLoc}><Ionicons name="location-outline" size={10} color={Colors.textMuted} /> {inv.court_location || 'No location set'}</Text>
                      </View>
                      <View style={s.confirmedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                        <Text style={s.confirmedText}>Confirmed</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Pending invites */}
            {pendingInvites.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>PENDING INVITES</Text>
                {pendingInvites.map(inv => {
                  const sender = inv.sender;
                  const name = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Someone';
                  return (
                    <View key={inv.id} style={s.inviteCard}>
                      <View style={s.inviteLeft}>
                        <View style={s.inviteAvatar}>
                          <Ionicons name="person" size={18} color={EV.invite.text} />
                        </View>
                        <View style={s.inviteInfo}>
                          <Text style={s.inviteName}>{name} invited you</Text>
                          <Text style={s.inviteTime}>{format(parseISO(inv.date), 'EEE, MMM d')} · {fmtTime(inv.start_time)}–{fmtTime(inv.end_time)}</Text>
                          {inv.message && <Text style={s.inviteMsg}>"{inv.message}"</Text>}
                        </View>
                      </View>
                      <View style={s.inviteActions}>
                        <TouchableOpacity style={s.acceptBtn} onPress={() => handleRespond(inv.id, 'accepted')}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.declineBtn} onPress={() => handleRespond(inv.id, 'declined')}>
                          <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      {/* ── Add Availability Modal ──────────────────────────────────────────── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={closeAddModal} style={s.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add Availability</Text>
            <TouchableOpacity onPress={handleSaveSlot} disabled={saving} style={s.modalSaveBtn}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.modalSaveTxt}>Save</Text>
              }
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Date */}
            <View style={s.fGroup}>
              <Text style={s.fLabel}>DATE</Text>
              <TextInput style={s.fInput} value={formData.date} onChangeText={v => setFormData(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
            </View>

            {/* Timezone */}
            <View style={s.fGroup}>
              <Text style={s.fLabel}>TIMEZONE</Text>
              <TouchableOpacity style={s.fSelect} onPress={() => setShowTzPicker(true)}>
                <Ionicons name="globe-outline" size={15} color={Colors.textSecondary} />
                <Text style={s.fSelectTxt} numberOfLines={1}>{US_TIMEZONES.find(t => t.value === formData.timezone)?.label ?? formData.timezone}</Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Time row */}
            <View style={s.fRow}>
              <View style={[s.fGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={s.fLabel}>START TIME</Text>
                <TextInput style={[s.fInput, timeError && s.fInputErr]} value={formData.start_time} onChangeText={v => { setFormData(p => ({ ...p, start_time: v })); setTimeError(false); }} placeholder="09:00" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={[s.fGroup, { flex: 1 }]}>
                <Text style={s.fLabel}>END TIME</Text>
                <TextInput style={[s.fInput, timeError && s.fInputErr]} value={formData.end_time} onChangeText={v => { setFormData(p => ({ ...p, end_time: v })); setTimeError(false); }} placeholder="10:00" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            {timeError && <Text style={s.fError}>End time must be after start time</Text>}

            {/* Privacy */}
            <View style={s.fGroup}>
              <Text style={s.fLabel}>PRIVACY</Text>
              <View style={s.pills}>
                {[{ v: 'public', label: 'Public', icon: 'globe-outline' }, { v: 'private', label: 'Private', icon: 'lock-closed-outline' }].map(opt => (
                  <TouchableOpacity key={opt.v} style={[s.pill, formData.privacy_level === opt.v && s.pillActive]} onPress={() => setFormData(p => ({ ...p, privacy_level: opt.v }))}>
                    <Ionicons name={opt.icon as any} size={13} color={formData.privacy_level === opt.v ? '#fff' : Colors.textSecondary} />
                    <Text style={[s.pillText, formData.privacy_level === opt.v && s.pillTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.fHint}>{formData.privacy_level === 'public' ? 'Visible to all players' : 'Used for matching only'}</Text>
            </View>

            {/* Available toggle */}
            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleLabel}>Available for matches</Text>
                <Text style={s.toggleSub}>{formData.is_available ? 'Open for bookings' : 'Block this time'}</Text>
              </View>
              <TouchableOpacity style={[s.toggle, formData.is_available && s.toggleOn]} onPress={() => setFormData(p => ({ ...p, is_available: !p.is_available }))} activeOpacity={0.8}>
                <View style={[s.toggleThumb, formData.is_available && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Recurring toggle */}
            <View style={[s.toggleRow, s.toggleRowBorder]}>
              <View style={s.toggleInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="repeat-outline" size={15} color={Colors.text} />
                  <Text style={s.toggleLabel}>Recurring Availability</Text>
                </View>
              </View>
              <TouchableOpacity style={[s.toggle, showRecurrence && s.toggleOn]} onPress={() => setShowRecurrence(v => !v)} activeOpacity={0.8}>
                <View style={[s.toggleThumb, showRecurrence && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {showRecurrence && (
              <View style={s.recBox}>
                <Text style={s.fLabel}>RECURRENCE PATTERN</Text>
                <View style={s.pills}>
                  {(['none', 'daily', 'weekly', 'monthly'] as RecurrencePattern[]).map(p => (
                    <TouchableOpacity key={p} style={[s.pill, recurrence.pattern === p && s.pillActive]} onPress={() => setRecurrence(r => ({ ...r, pattern: p }))}>
                      <Text style={[s.pillText, recurrence.pattern === p && s.pillTextActive]}>{p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {recurrence.pattern !== 'none' && (
                  <View style={[s.fRow, { marginTop: Spacing.md }]}>
                    <View style={[s.fGroup, { flex: 1, marginRight: Spacing.sm }]}>
                      <Text style={s.fLabel}>REPEAT EVERY</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextInput style={[s.fInput, { flex: 1, marginRight: Spacing.xs }]} value={String(recurrence.interval)} onChangeText={v => setRecurrence(r => ({ ...r, interval: parseInt(v) || 1 }))} keyboardType="number-pad" />
                        <Text style={s.unitText}>{recurrence.pattern === 'daily' ? 'day(s)' : recurrence.pattern === 'weekly' ? 'week(s)' : 'month(s)'}</Text>
                      </View>
                    </View>
                    <View style={[s.fGroup, { flex: 1 }]}>
                      <Text style={s.fLabel}>END DATE (OPT.)</Text>
                      <TextInput style={s.fInput} value={recurrence.endDate} onChangeText={v => setRecurrence(r => ({ ...r, endDate: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Notes */}
            <View style={s.fGroup}>
              <Text style={s.fLabel}>NOTES (OPTIONAL)</Text>
              <TextInput style={[s.fInput, s.fTextArea]} value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))} placeholder="Add any notes..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Timezone Picker ─────────────────────────────────────────────────── */}
      <Modal visible={showTzPicker} animationType="slide" transparent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowTzPicker(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Select Timezone</Text>
          <ScrollView>
            {US_TIMEZONES.map(tz => (
              <TouchableOpacity key={tz.value} style={[s.tzRow, formData.timezone === tz.value && s.tzRowActive]} onPress={() => { setFormData(p => ({ ...p, timezone: tz.value })); setShowTzPicker(false); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.tzLabel, formData.timezone === tz.value && s.tzLabelActive]}>{tz.label}</Text>
                  <Text style={s.tzOffset}>UTC{tz.offset >= 0 ? '+' : ''}{tz.offset}</Text>
                </View>
                {formData.timezone === tz.value && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Event Detail Sheet ───────────────────────────────────────────────── */}
      <Modal visible={showEventSheet} animationType="slide" transparent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowEventSheet(false)} />
        <View style={s.sheet}>
          {selectedEvent && (
            <>
              <View style={s.sheetHandle} />
              {/* Type badge */}
              <View style={[s.sheetBadge, { backgroundColor: selectedEvent.bgColor, borderColor: selectedEvent.borderColor }]}>
                <Ionicons name={selectedEvent.type === 'availability' ? 'time-outline' : selectedEvent.type === 'match' ? 'tennisball-outline' : 'mail-outline'} size={13} color={selectedEvent.textColor} />
                <Text style={[s.sheetBadgeText, { color: selectedEvent.textColor }]}>
                  {selectedEvent.type === 'availability' ? 'Available Slot' : selectedEvent.type === 'match' ? 'Confirmed Match' : 'Match Invite'}
                </Text>
              </View>
              <Text style={s.sheetTitle}>{selectedEvent.title}</Text>
              <View style={s.sheetRow}>
                <Ionicons name="calendar-outline" size={15} color={Colors.textMuted} />
                <Text style={s.sheetRowText}>{format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}</Text>
              </View>
              <View style={s.sheetRow}>
                <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
                <Text style={s.sheetRowText}>{fmtTime(selectedEvent.start_time)} – {fmtTime(selectedEvent.end_time)}</Text>
              </View>
              {selectedEvent.data?.court_location && (
                <View style={s.sheetRow}>
                  <Ionicons name="location-outline" size={15} color={Colors.textMuted} />
                  <Text style={s.sheetRowText}>{selectedEvent.data.court_location}</Text>
                </View>
              )}
              {selectedEvent.data?.message && (
                <View style={s.sheetMsgBox}>
                  <Text style={s.sheetMsg}>"{selectedEvent.data.message}"</Text>
                </View>
              )}
              <View style={s.sheetBtns}>
                {selectedEvent.type === 'invite' && (
                  <>
                    <TouchableOpacity style={[s.shBtn, s.shBtnAccept]} onPress={() => handleRespond(selectedEvent.id, 'accepted')}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={s.shBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.shBtn, s.shBtnDecline]} onPress={() => handleRespond(selectedEvent.id, 'declined')}>
                      <Ionicons name="close-circle-outline" size={16} color="#fff" />
                      <Text style={s.shBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedEvent.type === 'availability' && (
                  <TouchableOpacity style={[s.shBtn, s.shBtnDelete]} onPress={() => handleDeleteAvailability(selectedEvent.id)}>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={s.shBtnText}>Delete Slot</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.shBtn, s.shBtnClose]} onPress={() => setShowEventSheet(false)}>
                  <Text style={[s.shBtnText, { color: Colors.text }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Month grid extracted for clarity ──────────────────────────────────────────
const MonthGrid: React.FC<{
  currentDate: Date;
  eventsByDate: Record<string, CalEvent[]>;
  onDayPress: (d: Date) => void;
}> = ({ currentDate, eventsByDate, onDayPress }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cellW = Math.floor(SCREEN_W / 7);

  return (
    <View style={mg.grid}>
      {/* Day-of-week header */}
      <View style={mg.dowRow}>
        {DOW.map(d => (
          <View key={d} style={[mg.dowCell, { width: cellW }]}>
            <Text style={mg.dowText}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Weeks */}
      {Array.from({ length: allDays.length / 7 }, (_, wi) => (
        <View key={wi} style={mg.weekRow}>
          {allDays.slice(wi * 7, wi * 7 + 7).map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate[dateKey] || [];
            const today = isToday(day);
            const inMonth = isSameMonth(day, currentDate);
            const availCount = dayEvents.filter(e => e.type === 'availability').length;
            const matchCount = dayEvents.filter(e => e.type === 'match').length;
            const inviteCount = dayEvents.filter(e => e.type === 'invite').length;
            return (
              <TouchableOpacity
                key={dateKey}
                style={[mg.cell, { width: cellW }, !inMonth && mg.cellOther]}
                onPress={() => onDayPress(day)}
                activeOpacity={0.7}
              >
                <View style={[mg.numWrap, today && mg.numWrapToday]}>
                  <Text style={[mg.num, today && mg.numToday, !inMonth && mg.numOther]}>
                    {format(day, 'd')}
                  </Text>
                </View>
                <View style={mg.dots}>
                  {availCount > 0 && <View style={[mg.dot, { backgroundColor: EV.avail.border }]} />}
                  {matchCount > 0 && <View style={[mg.dot, { backgroundColor: EV.match.border }]} />}
                  {inviteCount > 0 && <View style={[mg.dot, { backgroundColor: EV.invite.border }]} />}
                </View>
                {dayEvents.length > 0 && (
                  <Text style={[mg.evLabel, !inMonth && { opacity: 0.4 }]} numberOfLines={1}>
                    {dayEvents.length === 1 ? dayEvents[0].title : `${dayEvents.length} events`}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <View style={{ height: 80 }} />
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: { paddingBottom: Spacing.sm },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 6 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: FontWeight.black, color: '#fff' },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  hBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  hBtnAdd: { backgroundColor: 'rgba(255,255,255,0.3)' },

  // Control bar
  controlBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 4, paddingBottom: Spacing.sm },
  segControl: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: Radius.full, padding: 3 },
  segBtn: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full },
  segBtnActive: { backgroundColor: '#fff' },
  segBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: 'rgba(255,255,255,0.8)' },
  segBtnTextActive: { color: Colors.primary },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  navArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  todayPill: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  todayPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#fff' },

  // Legend
  legend: { flexDirection: 'row', gap: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1.5 },
  legendText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.medium },

  // Pending banner
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: 4, backgroundColor: EV.invite.bg, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: EV.invite.border },
  pendingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: EV.invite.border, marginRight: 2 },
  pendingText: { flex: 1, fontSize: FontSize.xs, color: EV.invite.text, fontWeight: FontWeight.medium },

  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  // Calendar day headers
  dayHeaders: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  dayHeader: { alignItems: 'center', paddingVertical: Spacing.xs + 2, borderLeftWidth: 1, borderLeftColor: Colors.borderLight },
  dayHeaderToday: { backgroundColor: Colors.primaryLight },
  dayHeaderName: { fontSize: 9, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  dayHeaderNameToday: { color: Colors.primary },
  dayNumCircle: { marginTop: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: Radius.full },
  dayNumCircleToday: { backgroundColor: Colors.primary },
  dayNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  dayNumToday: { color: '#fff' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.primary, marginTop: 2 },
  dayDotToday: { backgroundColor: Colors.primaryDark },
  dimText: { opacity: 0.35 },

  // Time grid
  gridRow: { flexDirection: 'row' },
  timeCol: { borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: Colors.surface },
  timeCell: { justifyContent: 'flex-start', paddingTop: 4, paddingRight: 5, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, alignItems: 'flex-end' },
  timeLabel: { fontSize: 9, color: Colors.textMuted },
  hourCell: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight, borderLeftWidth: 1, borderLeftColor: Colors.borderLight },
  hourCellToday: { backgroundColor: 'rgba(249,115,22,0.03)' },
  hourCellPast: { backgroundColor: Colors.backgroundAlt, opacity: 0.6 },
  eventBlock: { position: 'absolute', left: 2, right: 2, borderLeftWidth: 3, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 3, overflow: 'hidden' },
  eventTitle: { fontSize: 9, fontWeight: FontWeight.semibold, lineHeight: 12 },
  eventTime: { fontSize: 8, opacity: 0.8, lineHeight: 11 },

  // Sections below grid
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },

  matchCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 1 },
  matchIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  matchInfo: { flex: 1, gap: 2 },
  matchName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  matchTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  matchLoc: { fontSize: FontSize.xs, color: Colors.textMuted },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  confirmedText: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.success },

  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: EV.invite.bg, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: EV.invite.border },
  inviteLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inviteAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${EV.invite.border}22`, alignItems: 'center', justifyContent: 'center' },
  inviteInfo: { flex: 1, gap: 2 },
  inviteName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  inviteTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  inviteMsg: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  inviteActions: { flexDirection: 'row', gap: Spacing.xs },
  acceptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },

  // Add modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  modalSaveBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, minWidth: 56, alignItems: 'center' },
  modalSaveTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#fff' },
  modalBody: { padding: Spacing.lg },

  // Form elements
  fGroup: { marginBottom: Spacing.lg },
  fRow: { flexDirection: 'row' },
  fLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted, letterSpacing: 0.6, marginBottom: Spacing.xs, textTransform: 'uppercase' },
  fInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.surface },
  fTextArea: { height: 80, textAlignVertical: 'top' },
  fInputErr: { borderColor: Colors.error },
  fError: { fontSize: FontSize.xs, color: Colors.error, marginTop: -Spacing.sm + 2, marginBottom: Spacing.sm },
  fHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  fSelect: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.surface },
  fSelectTxt: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  pills: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  pillTextActive: { color: '#fff' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.xs },
  toggleInfo: { flex: 1, marginRight: Spacing.md },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text },
  toggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  recBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  unitText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginLeft: Spacing.xs },

  // Bottom sheets
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 44, minHeight: 280 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  sheetBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, marginBottom: Spacing.sm },
  sheetBadgeText: { fontSize: 11, fontWeight: FontWeight.semibold },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sheetRowText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  sheetMsgBox: { backgroundColor: Colors.backgroundAlt, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  sheetMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  sheetBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  shBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: Radius.full, flex: 1, justifyContent: 'center' },
  shBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#fff' },
  shBtnAccept: { backgroundColor: Colors.success },
  shBtnDecline: { backgroundColor: Colors.error },
  shBtnDelete: { backgroundColor: Colors.error },
  shBtnClose: { backgroundColor: Colors.backgroundAlt, borderWidth: 1, borderColor: Colors.border },

  // Timezone sheet rows
  tzRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tzRowActive: { backgroundColor: Colors.primaryLight },
  tzLabel: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
  tzLabelActive: { color: Colors.primary },
  tzOffset: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

const mg = StyleSheet.create({
  grid: { paddingTop: 2 },
  dowRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  dowCell: { alignItems: 'center', paddingVertical: 7 },
  dowText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  cell: { minHeight: 74, borderRightWidth: 1, borderRightColor: Colors.borderLight, padding: 4, alignItems: 'center' },
  cellOther: { backgroundColor: Colors.backgroundAlt },
  numWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  numWrapToday: { backgroundColor: Colors.primary },
  num: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  numToday: { color: '#fff' },
  numOther: { color: Colors.textMuted, opacity: 0.5 },
  dots: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  evLabel: { fontSize: 9, color: Colors.textSecondary, textAlign: 'center', lineHeight: 12 },
});
