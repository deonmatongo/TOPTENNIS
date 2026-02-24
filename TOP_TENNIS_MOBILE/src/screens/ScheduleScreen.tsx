import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatches } from '@/hooks/useMatches';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useLeagueMatches } from '@/hooks/useLeagueMatches';
import { useCalendarExport } from '@/hooks/useCalendarExport';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
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
const TIME_COL_W = 48;
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

export const ScheduleScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
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
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMM d, yyyy');
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const we = endOfWeek(currentDate, { weekStartsOn: 0 });
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
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
      map[slot.date].push({ id: slot.id, type: 'availability', date: slot.date, start_time: slot.start_time, end_time: slot.end_time, title: 'Available', bgColor: '#dcfce7', borderColor: '#16a34a', textColor: '#15803d', data: slot });
    });
    (invites || []).filter(i => i.status === 'accepted').forEach(inv => {
      if (!inv.date) return;
      if (!map[inv.date]) map[inv.date] = [];
      const other = inv.sender_id === user?.id ? inv.receiver : inv.sender;
      const name = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
      map[inv.date].push({ id: inv.id, type: 'match', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `vs ${name}`, bgColor: '#dbeafe', borderColor: '#2563eb', textColor: '#1d4ed8', data: inv });
    });
    (invites || []).filter(i => i.status === 'pending' && i.receiver_id === user?.id).forEach(inv => {
      if (!inv.date) return;
      if (!map[inv.date]) map[inv.date] = [];
      const sender = inv.sender;
      const name = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Someone';
      map[inv.date].push({ id: inv.id, type: 'invite', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `From ${name}`, bgColor: '#ffedd5', borderColor: '#ea580c', textColor: '#c2410c', data: inv });
    });
    // League matches — show scheduled/pending ones on the calendar
    (leagueMatches || []).filter(m => m.scheduled_date && (m.status === 'scheduled' || m.status === 'pending')).forEach(m => {
      const date = m.scheduled_date!;
      if (!map[date]) map[date] = [];
      const startTime = m.scheduled_time || '09:00';
      const endHour = parseInt(startTime.split(':')[0]) + 1;
      const endTime = `${String(endHour).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
      map[date].push({
        id: `league-${m.id}`,
        type: 'match',
        date,
        start_time: startTime,
        end_time: endTime,
        title: `🏆 vs ${m.opponent_name}`,
        bgColor: '#fef9c3',
        borderColor: '#f59e0b',
        textColor: '#92400e',
        data: { ...m, _isLeagueMatch: true },
      });
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
    setFormData({
      ...DEFAULT_FORM,
      date: format(date, 'yyyy-MM-dd'),
      start_time: hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : '09:00',
      end_time: hour !== undefined ? `${String(Math.min(hour + 1, 23)).padStart(2, '0')}:00` : '10:00',
    });
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
    if (!formData.date || !formData.start_time || !formData.end_time) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (formData.start_time >= formData.end_time) {
      setTimeError(true);
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      const fmt = (t: string) => t.length === 5 ? `${t}:00` : t;
      const base = {
        date: formData.date,
        start_time: fmt(formData.start_time),
        end_time: fmt(formData.end_time),
        is_available: formData.is_available,
        notes: formData.notes || undefined,
        privacy_level: formData.privacy_level,
        timezone: formData.timezone,
      };
      if (recurrence.pattern !== 'none') {
        const slots = generateRecurringDates(formData.date, recurrence);
        for (const d of slots) {
          await createAvailability({ ...base, date: d });
        }
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
        endTime: (() => { const h = parseInt((m.scheduled_time || '09:00').split(':')[0]) + 1; return `${String(h).padStart(2,'0')}:00`; })(),
        location: m.court_location,
      })),
    ];
    if (events.length === 0) {
      Alert.alert('Nothing to Export', 'No upcoming confirmed matches to add to your calendar.');
      return;
    }
    await exportMultiple(events);
  };

  const addBtn = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity
        style={[styles.addBtnHeader, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
        onPress={handleExportAll}
        disabled={exporting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="calendar-outline" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.addBtnHeader} onPress={() => openAdd(currentDate)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="My Schedule" subtitle="Availability & matches" navigation={navigation} showBack={navigation?.canGoBack?.()} rightElement={addBtn} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <View style={styles.viewToggle}>
          {(['day', 'week', 'month'] as ViewMode[]).map(v => (
            <TouchableOpacity key={v} style={[styles.viewBtn, viewMode === v && styles.viewBtnActive]} onPress={() => setViewMode(v)}>
              <Text style={[styles.viewBtnText, viewMode === v && styles.viewBtnTextActive]}>
                {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.navControls}>
          <TouchableOpacity onPress={goBack} style={styles.navArrow}><Ionicons name="chevron-back" size={18} color={Colors.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentDate(new Date())} style={styles.todayBtn}><Text style={styles.todayBtnText}>Today</Text></TouchableOpacity>
          <TouchableOpacity onPress={goForward} style={styles.navArrow}><Ionicons name="chevron-forward" size={18} color={Colors.text} /></TouchableOpacity>
        </View>
      </View>

      <Text style={styles.headerLabel} numberOfLines={1}>{headerLabel}</Text>

      {/* Legend */}
      <View style={styles.legend}>
        {[{ bg: '#dcfce7', border: '#16a34a', label: 'Available' }, { bg: '#dbeafe', border: '#2563eb', label: 'Match' }, { bg: '#ffedd5', border: '#ea580c', label: 'Invite' }].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.bg, borderColor: l.border }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Pending banner */}
      {pendingInvites.length > 0 && (
        <View style={styles.pendingBanner}>
          <Ionicons name="mail-outline" size={15} color="#c2410c" />
          <Text style={styles.pendingBannerText}>{pendingInvites.length} pending invite{pendingInvites.length > 1 ? 's' : ''} — tap to respond</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : viewMode === 'month' ? (
          <>
            {/* Month grid */}
            {(() => {
              const monthStart = startOfMonth(currentDate);
              const monthEnd = endOfMonth(currentDate);
              const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
              const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
              const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
              const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const cellW = Math.floor(SCREEN_W / 7);
              return (
                <View style={styles.monthGrid}>
                  {/* Day-of-week header */}
                  <View style={styles.monthDowRow}>
                    {DOW.map(d => (
                      <View key={d} style={[styles.monthDowCell, { width: cellW }]}>
                        <Text style={styles.monthDowText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Weeks */}
                  {Array.from({ length: allDays.length / 7 }, (_, wi) => (
                    <View key={wi} style={styles.monthWeekRow}>
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
                            style={[styles.monthCell, { width: cellW }, today && styles.monthCellToday, !inMonth && styles.monthCellOtherMonth]}
                            onPress={() => { setCurrentDate(day); setViewMode('day'); }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.monthDayNumWrap, today && styles.monthDayNumWrapToday]}>
                              <Text style={[styles.monthDayNum, today && styles.monthDayNumToday, !inMonth && styles.monthDayNumOther]}>
                                {format(day, 'd')}
                              </Text>
                            </View>
                            <View style={styles.monthDots}>
                              {availCount > 0 && <View style={[styles.monthDot, { backgroundColor: '#16a34a' }]} />}
                              {matchCount > 0 && <View style={[styles.monthDot, { backgroundColor: '#2563eb' }]} />}
                              {inviteCount > 0 && <View style={[styles.monthDot, { backgroundColor: '#ea580c' }]} />}
                            </View>
                            {dayEvents.length > 0 && (
                              <Text style={[styles.monthEventCount, !inMonth && { opacity: 0.4 }]} numberOfLines={1}>
                                {dayEvents.length === 1
                                  ? dayEvents[0].title
                                  : `${dayEvents.length} events`}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })()}
            <View style={{ height: 80 }} />
          </>
        ) : (
          <>
            {/* Day column headers */}
            <View style={[styles.dayHeaders, { marginLeft: TIME_COL_W }]}>
              {displayDays.map(day => {
                const today = isToday(day);
                const pastDay = isPast(startOfDay(day)) && !today;
                return (
                  <View key={day.toISOString()} style={[styles.dayHeader, { width: dayColW }, today && styles.dayHeaderToday]}>
                    <Text style={[styles.dayHeaderName, today && styles.dayHeaderNameToday, pastDay && styles.dimText]}>{format(day, viewMode === 'week' ? 'EEE' : 'EEEE')}</Text>
                    <Text style={[styles.dayHeaderNum, today && styles.dayHeaderNumToday, pastDay && styles.dimText]}>{format(day, viewMode === 'week' ? 'd' : 'MMM d')}</Text>
                    {(eventsByDate[format(day, 'yyyy-MM-dd')] || []).length > 0 && <View style={[styles.dayDot, today && styles.dayDotToday]} />}
                  </View>
                );
              })}
            </View>

            {/* Time grid */}
            <View style={styles.gridContainer}>
              <View style={[styles.timeCol, { width: TIME_COL_W }]}>
                {HOURS.map(h => (
                  <View key={h} style={[styles.timeCell, { height: HOUR_HEIGHT }]}>
                    <Text style={styles.timeLabel}>{hourLabel(h)}</Text>
                  </View>
                ))}
              </View>
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
                          style={[styles.hourCell, { height: HOUR_HEIGHT, width: dayColW }, today && styles.hourCellToday, pastDay && styles.hourCellPast]}
                          onPress={() => !pastDay && openAdd(day, h)}
                          activeOpacity={pastDay ? 1 : 0.5} />
                      ))}
                      <View style={StyleSheet.absoluteFill}>
                        {dayEvents.map(ev => {
                          const { top, height } = getEventLayout(ev.start_time, ev.end_time);
                          return (
                            <TouchableOpacity key={ev.id}
                              style={[styles.eventBlock, { top, height, backgroundColor: ev.bgColor, borderLeftColor: ev.borderColor }]}
                              onPress={() => handleEventTap(ev)} activeOpacity={0.8}>
                              <Text style={[styles.eventTitle, { color: ev.textColor }]} numberOfLines={1}>{ev.title}</Text>
                              <Text style={[styles.eventTime, { color: ev.textColor }]} numberOfLines={1}>{fmtTime(ev.start_time)}–{fmtTime(ev.end_time)}</Text>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Matches</Text>
                {(invites || []).filter(i => i.status === 'accepted').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map(inv => {
                  const other = inv.sender_id === user?.id ? inv.receiver : inv.sender;
                  const name = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
                  return (
                    <View key={inv.id} style={styles.matchCard}>
                      <View style={styles.matchIconWrap}><Ionicons name="tennisball-outline" size={20} color={Colors.primary} /></View>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchName}>vs {name}</Text>
                        <Text style={styles.matchTime}>{format(parseISO(inv.date), 'EEE, MMM d')} · {fmtTime(inv.start_time)}–{fmtTime(inv.end_time)}</Text>
                        {inv.court_location && <Text style={styles.matchLocation}>{inv.court_location}</Text>}
                      </View>
                      <View style={styles.confirmedBadge}><Text style={styles.confirmedBadgeText}>Confirmed</Text></View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Pending invites list */}
            {pendingInvites.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Invites</Text>
                {pendingInvites.map(inv => {
                  const sender = inv.sender;
                  const name = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Someone';
                  return (
                    <View key={inv.id} style={styles.inviteCard}>
                      <View style={styles.inviteInfo}>
                        <Text style={styles.inviteName}>From {name}</Text>
                        <Text style={styles.inviteTime}>{format(parseISO(inv.date), 'EEE, MMM d')} · {fmtTime(inv.start_time)}–{fmtTime(inv.end_time)}</Text>
                        {inv.message && <Text style={styles.inviteMsg}>"{inv.message}"</Text>}
                      </View>
                      <View style={styles.inviteActions}>
                        <TouchableOpacity style={[styles.respondBtn, styles.acceptBtn]} onPress={() => handleRespond(inv.id, 'accepted')}><Ionicons name="checkmark" size={16} color="#fff" /></TouchableOpacity>
                        <TouchableOpacity style={[styles.respondBtn, styles.declineBtn]} onPress={() => handleRespond(inv.id, 'declined')}><Ionicons name="close" size={16} color="#fff" /></TouchableOpacity>
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

      {/* Add Availability Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeAddModal}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Add Availability</Text>
            <TouchableOpacity onPress={handleSaveSlot} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Date */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Date</Text>
              <TextInput
                style={styles.formInput}
                value={formData.date}
                onChangeText={v => setFormData(p => ({ ...p, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Timezone */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Timezone</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowTzPicker(true)}>
                <Ionicons name="globe-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.selectBtnText} numberOfLines={1}>
                  {US_TIMEZONES.find(t => t.value === formData.timezone)?.label ?? formData.timezone}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.tzHint}>
                <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.tzHintText}>Times shown in {formData.timezone}</Text>
              </View>
            </View>

            {/* Start / End time */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={styles.formLabel}>Start Time (24h)</Text>
                <TextInput
                  style={[styles.formInput, timeError && styles.formInputError]}
                  value={formData.start_time}
                  onChangeText={v => { setFormData(p => ({ ...p, start_time: v })); setTimeError(false); }}
                  placeholder="09:00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>End Time (24h)</Text>
                <TextInput
                  style={[styles.formInput, timeError && styles.formInputError]}
                  value={formData.end_time}
                  onChangeText={v => { setFormData(p => ({ ...p, end_time: v })); setTimeError(false); }}
                  placeholder="10:00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {timeError && <Text style={styles.formErrorText}>End time must be after start time</Text>}

            {/* Privacy */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Privacy Level</Text>
              <View style={styles.segmentRow}>
                {[{ v: 'public', label: 'Public' }, { v: 'private', label: 'Private' }].map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={[styles.segmentBtn, formData.privacy_level === opt.v && styles.segmentBtnActive]}
                    onPress={() => setFormData(p => ({ ...p, privacy_level: opt.v }))}
                  >
                    <Text style={[styles.segmentBtnText, formData.privacy_level === opt.v && styles.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formHint}>
                {formData.privacy_level === 'public' ? 'Visible to all players' : 'Used for matching only'}
              </Text>
            </View>

            {/* Available toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Available for matches</Text>
                <Text style={styles.toggleSub}>{formData.is_available ? 'Open for bookings' : 'Block this time'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, formData.is_available && styles.toggleOn]}
                onPress={() => setFormData(p => ({ ...p, is_available: !p.is_available }))}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, formData.is_available && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* Recurring toggle */}
            <View style={[styles.toggleRow, styles.toggleRowBorder]}>
              <View style={styles.toggleInfo}>
                <View style={styles.toggleLabelRow}>
                  <Ionicons name="repeat-outline" size={15} color={Colors.text} />
                  <Text style={styles.toggleLabel}>Recurring Availability</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.toggle, showRecurrence && styles.toggleOn]}
                onPress={() => setShowRecurrence(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, showRecurrence && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {showRecurrence && (
              <View style={styles.recurrenceBox}>
                <Text style={styles.formLabel}>Recurrence Pattern</Text>
                <View style={styles.segmentRow}>
                  {(['none', 'daily', 'weekly', 'monthly'] as RecurrencePattern[]).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.segmentBtnSm, recurrence.pattern === p && styles.segmentBtnActive]}
                      onPress={() => setRecurrence(r => ({ ...r, pattern: p }))}
                    >
                      <Text style={[styles.segmentBtnTextSm, recurrence.pattern === p && styles.segmentBtnTextActive]}>
                        {p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {recurrence.pattern !== 'none' && (
                  <>
                    <View style={[styles.formRow, { marginTop: Spacing.md }]}>
                      <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                        <Text style={styles.formLabel}>Repeat every</Text>
                        <View style={styles.intervalRow}>
                          <TextInput
                            style={[styles.formInput, { flex: 1, marginRight: Spacing.xs }]}
                            value={String(recurrence.interval)}
                            onChangeText={v => setRecurrence(r => ({ ...r, interval: parseInt(v) || 1 }))}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.intervalUnit}>
                            {recurrence.pattern === 'daily' ? 'day(s)' : recurrence.pattern === 'weekly' ? 'week(s)' : 'month(s)'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.formLabel}>End Date (opt.)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={recurrence.endDate}
                          onChangeText={v => setRecurrence(r => ({ ...r, endDate: v }))}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={Colors.textMuted}
                        />
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={formData.notes}
                onChangeText={v => setFormData(p => ({ ...p, notes: v }))}
                placeholder="Add any additional notes..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Timezone Picker Modal */}
      <Modal visible={showTzPicker} animationType="slide" transparent>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowTzPicker(false)} />
        <View style={[styles.sheet, { minHeight: 360 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Timezone</Text>
          <ScrollView>
            {US_TIMEZONES.map(tz => (
              <TouchableOpacity
                key={tz.value}
                style={[styles.tzOption, formData.timezone === tz.value && styles.tzOptionActive]}
                onPress={() => { setFormData(p => ({ ...p, timezone: tz.value })); setShowTzPicker(false); }}
              >
                <Text style={[styles.tzOptionLabel, formData.timezone === tz.value && styles.tzOptionLabelActive]}>{tz.label}</Text>
                <Text style={styles.tzOptionOffset}>UTC{tz.offset >= 0 ? '+' : ''}{tz.offset}</Text>
                {formData.timezone === tz.value && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Event Detail Sheet */}
      <Modal visible={showEventSheet} animationType="slide" transparent>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowEventSheet(false)} />
        <View style={styles.sheet}>
          {selectedEvent && (
            <>
              <View style={styles.sheetHandle} />
              <View style={[styles.sheetTypeBadge, { backgroundColor: selectedEvent.bgColor, borderColor: selectedEvent.borderColor }]}>
                <Ionicons name={selectedEvent.type === 'availability' ? 'time-outline' : selectedEvent.type === 'match' ? 'tennisball-outline' : 'mail-outline'} size={15} color={selectedEvent.textColor} />
                <Text style={[styles.sheetTypeBadgeText, { color: selectedEvent.textColor }]}>
                  {selectedEvent.type === 'availability' ? 'Available Slot' : selectedEvent.type === 'match' ? 'Confirmed Match' : 'Match Invite'}
                </Text>
              </View>
              <Text style={styles.sheetTitle}>{selectedEvent.title}</Text>
              <View style={styles.sheetRow}><Ionicons name="calendar-outline" size={15} color={Colors.textMuted} /><Text style={styles.sheetRowText}>{format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}</Text></View>
              <View style={styles.sheetRow}><Ionicons name="time-outline" size={15} color={Colors.textMuted} /><Text style={styles.sheetRowText}>{fmtTime(selectedEvent.start_time)} – {fmtTime(selectedEvent.end_time)}</Text></View>
              {selectedEvent.data?.court_location && (<View style={styles.sheetRow}><Ionicons name="location-outline" size={15} color={Colors.textMuted} /><Text style={styles.sheetRowText}>{selectedEvent.data.court_location}</Text></View>)}
              {selectedEvent.data?.message && (<View style={styles.sheetMsgBox}><Text style={styles.sheetMsg}>"{selectedEvent.data.message}"</Text></View>)}
              <View style={styles.sheetActions}>
                {selectedEvent.type === 'invite' && (
                  <>
                    <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnAccept]} onPress={() => handleRespond(selectedEvent.id, 'accepted')}><Ionicons name="checkmark-circle-outline" size={17} color="#fff" /><Text style={styles.sheetBtnText}>Accept</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnDecline]} onPress={() => handleRespond(selectedEvent.id, 'declined')}><Ionicons name="close-circle-outline" size={17} color="#fff" /><Text style={styles.sheetBtnText}>Decline</Text></TouchableOpacity>
                  </>
                )}
                {selectedEvent.type === 'availability' && (
                  <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnDelete]} onPress={() => handleDeleteAvailability(selectedEvent.id)}><Ionicons name="trash-outline" size={17} color="#fff" /><Text style={styles.sheetBtnText}>Delete Slot</Text></TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnClose]} onPress={() => setShowEventSheet(false)}><Text style={[styles.sheetBtnText, { color: Colors.text }]}>Close</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  addBtnHeader: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  viewToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  viewBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
  viewBtnActive: { backgroundColor: Colors.primary },
  viewBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  viewBtnTextActive: { color: '#fff' },
  navControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  navArrow: { padding: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  todayBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  todayBtnText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
  headerLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  legend: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.md, marginBottom: Spacing.xs, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  pendingBannerText: { fontSize: FontSize.xs, color: '#c2410c', fontWeight: FontWeight.medium, flex: 1 },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  dayHeaders: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  dayHeader: { alignItems: 'center', paddingVertical: Spacing.xs, borderLeftWidth: 1, borderLeftColor: Colors.borderLight },
  dayHeaderToday: { backgroundColor: '#eff6ff' },
  dayHeaderName: { fontSize: 10, fontWeight: FontWeight.medium, color: Colors.textMuted, textTransform: 'uppercase' },
  dayHeaderNameToday: { color: '#2563eb' },
  dayHeaderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  dayHeaderNumToday: { color: '#2563eb' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.primary, marginTop: 2 },
  dayDotToday: { backgroundColor: '#2563eb' },
  dimText: { opacity: 0.4 },
  gridContainer: { flexDirection: 'row' },
  timeCol: { borderRightWidth: 1, borderRightColor: Colors.border },
  timeCell: { justifyContent: 'flex-start', paddingTop: 3, paddingRight: 4, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, alignItems: 'flex-end' },
  timeLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'right' },
  hourCell: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight, borderLeftWidth: 1, borderLeftColor: Colors.borderLight },
  hourCellToday: { backgroundColor: 'rgba(37,99,235,0.03)' },
  hourCellPast: { opacity: 0.5 },
  eventBlock: { position: 'absolute', left: 1, right: 1, borderLeftWidth: 3, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 2, overflow: 'hidden' },
  eventTitle: { fontSize: 9, fontWeight: FontWeight.semibold },
  eventTime: { fontSize: 8, opacity: 0.85 },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  matchIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  matchInfo: { flex: 1, gap: 2 },
  matchName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  matchTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  matchLocation: { fontSize: FontSize.xs, color: Colors.textMuted },
  confirmedBadge: { backgroundColor: '#dbeafe', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  confirmedBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: '#1d4ed8' },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#fff7ed', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: '#fed7aa' },
  inviteInfo: { flex: 1, gap: 2 },
  inviteName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  inviteTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
  inviteMsg: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  inviteActions: { flexDirection: 'row', gap: Spacing.xs },
  respondBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: '#16a34a' },
  declineBtn: { backgroundColor: Colors.error },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  modalCancel: { fontSize: FontSize.md, color: Colors.textSecondary },
  modalSave: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
  modalContent: { padding: Spacing.lg },
  formGroup: { marginBottom: Spacing.lg },
  formRow: { flexDirection: 'row' },
  formLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text, marginBottom: Spacing.xs },
  formInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.surface },
  formTextArea: { height: 80, textAlignVertical: 'top' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: 40, minHeight: 280 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  sheetTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  sheetTypeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  sheetRowText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  sheetMsgBox: { backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.md },
  sheetMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  sheetActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  sheetBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, flex: 1, justifyContent: 'center' },
  sheetBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#fff' },
  sheetBtnAccept: { backgroundColor: '#16a34a' },
  sheetBtnDecline: { backgroundColor: Colors.error },
  sheetBtnDelete: { backgroundColor: Colors.error },
  sheetBtnClose: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.surface },
  selectBtnText: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  tzHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tzHintText: { fontSize: 11, color: Colors.textMuted },
  formInputError: { borderColor: Colors.error },
  formErrorText: { fontSize: FontSize.xs, color: Colors.error, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  formHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  segmentRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  segmentBtn: { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  segmentBtnSm: { paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  segmentBtnTextSm: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  segmentBtnTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.xs },
  toggleInfo: { flex: 1, marginRight: Spacing.md },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text },
  toggleSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  recurrenceBox: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  intervalRow: { flexDirection: 'row', alignItems: 'center' },
  intervalUnit: { fontSize: FontSize.sm, color: Colors.textSecondary, marginLeft: Spacing.xs },
  // Month view
  monthGrid: { paddingTop: 2 },
  monthDowRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  monthDowCell: { alignItems: 'center', paddingVertical: 6 },
  monthDowText: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase' },
  monthWeekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  monthCell: { minHeight: 72, borderRightWidth: 1, borderRightColor: Colors.borderLight, padding: 4, alignItems: 'center' },
  monthCellToday: { backgroundColor: '#eff6ff' },
  monthCellOtherMonth: { backgroundColor: Colors.background },
  monthDayNumWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  monthDayNumWrapToday: { backgroundColor: Colors.primary },
  monthDayNum: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  monthDayNumToday: { color: '#fff' },
  monthDayNumOther: { color: Colors.textMuted, opacity: 0.5 },
  monthDots: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  monthDot: { width: 6, height: 6, borderRadius: 3 },
  monthEventCount: { fontSize: 9, color: Colors.textSecondary, textAlign: 'center', lineHeight: 12 },

  tzOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  tzOptionActive: { backgroundColor: Colors.primaryLight },
  tzOptionLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  tzOptionLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  tzOptionOffset: { fontSize: FontSize.xs, color: Colors.textMuted },
});
