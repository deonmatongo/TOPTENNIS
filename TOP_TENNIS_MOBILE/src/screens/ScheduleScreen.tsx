import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatches } from '@/hooks/useMatches';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useLeagueMatches } from '@/hooks/useLeagueMatches';
import { CasualMatchScoringModal } from '@/components/ui/CasualMatchScoringModal'
import { DateWheelPicker, TimeWheelPicker } from '@/components/ui/DateWheelPicker';
import { supabase } from '@/services/supabase';
import { Palette, AppColors, FontSize, Font, Spacing, Radius } from '@/theme/colors';
import { TAB_BAR_HEIGHT } from '@/components/navigation/TabBar';
import { useTheme, useThemeColors } from '@/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import {
  format, addDays, subWeeks, addWeeks,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isPast, parseISO, startOfDay, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth,
} from 'date-fns';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Grid constants ─────────────────────────────────────────────────────────────
const HOUR_H     = 64;
const TIME_COL_W = 46;
const COL_COUNT  = 3;
const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const GRID_H     = 24 * HOUR_H;

type ViewMode = 'agenda' | 'month';
type GridView = 'day' | '3day' | 'month';

interface CalEvent {
  id: string;
  type: 'availability' | 'match' | 'invite' | 'sent_invite';
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
  { value: 'America/New_York',    label: 'Eastern Time (ET)',  offset: -5  },
  { value: 'America/Chicago',     label: 'Central Time (CT)',  offset: -6  },
  { value: 'America/Denver',      label: 'Mountain Time (MT)', offset: -7  },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)',  offset: -8  },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)',  offset: -9  },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)',   offset: -10 },
  { value: 'America/Phoenix',     label: 'Arizona Time (MST)', offset: -7  },
];

type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly';
interface FormData {
  date: string; start_time: string; end_time: string;
  is_available: boolean; notes: string;
  privacy_level: string; timezone: string;
}
interface RecurrenceData { pattern: RecurrencePattern; interval: number; endDate: string; }

const DEFAULT_FORM: FormData = {
  date: '', start_time: '09:00', end_time: '10:00',
  is_available: true, notes: '', privacy_level: 'public', timezone: 'America/New_York',
};
const DEFAULT_RECURRENCE: RecurrenceData = { pattern: 'none', interval: 1, endDate: '' };

const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

function buildCalendarWeeks(anchor: Date): Date[][] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end   = endOfWeek(endOfMonth(anchor),   { weekStartsOn: 1 });
  const days  = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

const VIEW_ICONS: Record<GridView, string> = {
  day:   'today-outline',
  '3day': 'reorder-three-outline',
  month: 'apps-outline',
};

// Snap a "HH:MM" string to the nearest 15-minute boundary (ceiling).
function snapTo15(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const snapped = Math.ceil(m / 15) * 15;
  if (snapped >= 60) return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`;
  return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
}

// Next 15-minute slot strictly after now.
function nextSlot(): string {
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes() + 1;
  const snapped = Math.ceil(totalMins / 15) * 15;
  return `${String(Math.floor(snapped / 60) % 24).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
}
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const generateRecurringDates = (startDate: string, rec: RecurrenceData): string[] => {
  const dates: string[] = [startDate];
  if (rec.pattern === 'none') return dates;
  const base = new Date(startDate + 'T00:00:00');
  const end = rec.endDate
    ? new Date(rec.endDate + 'T00:00:00')
    : new Date(base.getTime() + 90 * 24 * 60 * 60 * 1000);
  let cur = new Date(base);
  const step = rec.interval || 1;
  for (let i = 0; i < 52; i++) {
    if (rec.pattern === 'daily')   cur.setDate(cur.getDate() + step);
    else if (rec.pattern === 'weekly')  cur.setDate(cur.getDate() + step * 7);
    else if (rec.pattern === 'monthly') cur.setMonth(cur.getMonth() + step);
    if (cur > end) break;
    dates.push(cur.toISOString().split('T')[0]);
  }
  return dates;
};

type EvPalette = ReturnType<typeof getEV>;

function getEV(isDark: boolean) {
  return {
    avail:       { bg: isDark ? 'rgba(22,163,74,0.18)'   : '#DCFCE7', border: '#16A34A', text: isDark ? '#4ade80' : '#15803D' },
    match:       { bg: isDark ? 'rgba(37,99,235,0.18)'   : '#DBEAFE', border: '#2563EB', text: isDark ? '#60a5fa' : '#1D4ED8' },
    invite:      { bg: isDark ? 'rgba(245,158,11,0.18)'  : '#FEF3C7', border: '#F59E0B', text: isDark ? '#fcd34d' : '#92400E' },
    sent_invite: { bg: isDark ? 'rgba(234,88,12,0.18)'   : '#FFF7ED', border: '#EA580C', text: isDark ? '#fb923c' : '#9A3412' },
    league:      { bg: isDark ? 'rgba(147,51,234,0.18)'  : '#F3E8FF', border: '#9333EA', text: isDark ? '#c084fc' : '#6B21A8' },
  };
}

const EVENT_SYMBOL: Record<string, string> = {
  availability: 'time-outline',
  match:        'tennisball',
  invite:       'mail-outline',
  sent_invite:  'paper-plane-outline',
};

const PRIVACY_OPTS = [
  { v: 'public',  label: 'Public',  icon: 'globe-outline' },
  { v: 'private', label: 'Private', icon: 'lock-closed-outline' },
];

// ── Style factories (rebuilt on theme change) ─────────────────────────────────

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },

    // Header — always dark navy for visual continuity with the floating pill tab bar
    header:       { backgroundColor: Palette.navy, paddingBottom: Spacing.sm },
    headerRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: 6 },
    headerTitle:  { flex: 1, fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
    headerActions:{ flexDirection: 'row', gap: Spacing.sm },
    hBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    subRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    monthNav:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    monthLabel:   { fontSize: FontSize.md, fontFamily: Font.bold, color: '#fff', letterSpacing: -0.3 },
    navArrow: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    segControl:       { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: Radius.full, padding: 3 },
    segBtn:           { paddingHorizontal: 16, paddingVertical: 5, borderRadius: Radius.full },
    segBtnActive:     { backgroundColor: '#fff' },
    segBtnText:       { fontSize: FontSize.xs, fontFamily: Font.semibold, color: 'rgba(255,255,255,0.75)' },
    segBtnTextActive: { color: Palette.orange500 },

    // Week strip
    weekStrip:           { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight, paddingVertical: Spacing.sm },
    weekDayBtn:          { flex: 1, alignItems: 'center', gap: 3 },
    weekDayName:         { fontSize: 10, fontFamily: Font.semibold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
    weekDayNameToday:    { color: c.primary },
    weekDayCircle:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    weekDayCircleToday:  { backgroundColor: c.primary },
    weekDayCircleSel:    { borderWidth: 1.5, borderColor: c.primary },
    weekDayNum:          { fontSize: FontSize.sm, fontFamily: Font.semibold, color: c.text },
    weekDayNumToday:     { color: '#fff' },
    weekDayNumSel:       { color: c.primary },
    weekDot:             { width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.primary },
    weekDotToday:        { backgroundColor: '#fff' },
    dimTxt:              { opacity: 0.35 },

    // Legend
    legend:     { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 8, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot:  { width: 10, height: 10, borderRadius: 3, borderWidth: 1.5 },
    legendText: { fontSize: 10, color: c.textSecondary, fontFamily: Font.medium },

    // Pending banner — EV colors applied as inline styles in JSX
    pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: 2, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1 },
    pendingDot:    { width: 7, height: 7, borderRadius: 3.5, marginRight: 2 },
    pendingText:   { flex: 1, fontSize: FontSize.xs, fontFamily: Font.medium },

    scroll: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

    // Empty state
    emptyWrap:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.semibold, color: c.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    emptySub:   { fontSize: FontSize.sm, color: c.textMuted, textAlign: 'center', lineHeight: 20 },

    // Agenda sections
    agendaSection:   { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
    agendaDayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    agendaChip:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: c.backgroundAlt, borderWidth: 1, borderColor: c.borderLight },
    agendaChipToday: { backgroundColor: c.primaryLight, borderColor: c.primaryMuted },
    agendaChipText:  { fontSize: 10, fontFamily: Font.black, color: c.textMuted, letterSpacing: 0.5 },
    agendaChipTextToday: { color: c.primary },
    agendaDateLabel: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: c.text },
    agendaEmpty:     { fontSize: FontSize.xs, color: c.textMuted, paddingLeft: 2, marginBottom: Spacing.xs },

    agendaCards:        { gap: Spacing.xs },
    agendaCard:         { flexDirection: 'row', alignItems: 'stretch', backgroundColor: c.surface, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    agendaCardBar:      { width: 4 },
    agendaCardContent:  { flex: 1, paddingVertical: 10, paddingHorizontal: Spacing.md, gap: 4 },
    agendaCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    agendaCardIcon:     { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    agendaCardTitle:    { flex: 1, fontSize: FontSize.sm, fontFamily: Font.semibold, color: c.text },
    agendaCardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    agendaCardMetaTxt:  { fontSize: 11, color: c.textMuted },
    metaSep:            { width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.textMuted, marginHorizontal: 2 },

    // Pending invite cards — EV colors applied as inline styles in JSX
    inviteSection: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    sectionLabel:  { fontSize: 10, fontFamily: Font.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
    inviteCard:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1 },
    inviteLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    inviteAvatar:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    inviteInfo:    { flex: 1, gap: 2 },
    inviteName:    { fontSize: FontSize.sm, fontFamily: Font.semibold, color: c.text },
    inviteTime:    { fontSize: FontSize.xs, color: c.textSecondary },
    inviteMsg:     { fontSize: FontSize.xs, color: c.textMuted, fontStyle: 'italic' },
    inviteActions: { flexDirection: 'row', gap: Spacing.xs },
    acceptBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center' },
    declineBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: c.error, alignItems: 'center', justifyContent: 'center' },

    // FAB
    fab: {
      position: 'absolute', right: Spacing.lg,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    },

    // Add availability modal
    modal:         { flex: 1, backgroundColor: c.background },
    modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
    modalTitle:    { fontSize: FontSize.lg, fontFamily: Font.semibold, color: c.text },
    modalSaveBtn:  { backgroundColor: c.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, minWidth: 56, alignItems: 'center' },
    modalSaveTxt:  { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#fff' },
    modalBody:     { padding: Spacing.lg },

    fGroup:     { marginBottom: Spacing.lg },
    fRow:       { flexDirection: 'row' },
    fLabel:     { fontSize: 10, fontFamily: Font.bold, color: c.textMuted, letterSpacing: 0.6, marginBottom: Spacing.xs, textTransform: 'uppercase' },
    fInput:     { borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: c.text, backgroundColor: c.surface },
    fTextArea:  { height: 80, textAlignVertical: 'top' },
    fInputErr:  { borderColor: c.error },
    fError:     { fontSize: FontSize.xs, color: c.error, marginTop: -Spacing.sm + 2, marginBottom: Spacing.sm },
    fHint:      { fontSize: 11, color: c.textMuted, marginTop: 4 },
    fSelect:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: c.surface },
    fSelectTxt: { flex: 1, fontSize: FontSize.md, color: c.text },

    pills:          { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.xs },
    pill:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
    pillActive:     { backgroundColor: c.primary, borderColor: c.primary },
    pillText:       { fontSize: FontSize.sm, fontFamily: Font.medium, color: c.textSecondary },
    pillTextActive: { color: '#fff' },

    toggleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, marginBottom: Spacing.sm },
    toggleRowBorder: { borderTopWidth: 1, borderTopColor: c.borderLight, marginTop: Spacing.xs },
    toggleInfo:      { flex: 1, marginRight: Spacing.md },
    toggleLabel:     { fontSize: FontSize.sm, fontFamily: Font.medium, color: c.text },
    toggleSub:       { fontSize: FontSize.xs, color: c.textMuted, marginTop: 2 },
    toggle:          { width: 44, height: 26, borderRadius: 13, backgroundColor: c.border, justifyContent: 'center', paddingHorizontal: 3 },
    toggleOn:        { backgroundColor: c.primary },
    toggleThumb:     { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
    toggleThumbOn:   { alignSelf: 'flex-end' },

    recBox:   { backgroundColor: c.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: c.borderLight },
    unitText: { fontSize: FontSize.sm, color: c.textSecondary, marginLeft: Spacing.xs },

    // Bottom sheets
    overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
    sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 44, minHeight: 280 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: Spacing.lg },
    sheetTitle:  { fontSize: FontSize.lg, fontFamily: Font.bold, color: c.text, marginBottom: Spacing.md },
    sheetBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, marginBottom: Spacing.sm },
    sheetBadgeText: { fontSize: 11, fontFamily: Font.semibold },
    sheetRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    sheetRowText:{ fontSize: FontSize.sm, color: c.textSecondary, flex: 1 },
    sheetMsgBox: { backgroundColor: c.backgroundAlt, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
    sheetMsg:    { fontSize: FontSize.sm, color: c.textSecondary, fontStyle: 'italic' },
    sheetBtns:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    shBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: Radius.full, flex: 1, justifyContent: 'center' },
    shBtnText:   { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#fff' },
    shBtnAccept: { backgroundColor: c.success },
    shBtnDecline:{ backgroundColor: c.error },
    shBtnDelete: { backgroundColor: c.error },
    shBtnClose:  { backgroundColor: c.backgroundAlt, borderWidth: 1, borderColor: c.border },

    tzRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    tzRowActive:  { backgroundColor: c.primaryLight },
    tzLabel:      { fontSize: FontSize.sm, color: c.text, fontFamily: Font.medium },
    tzLabelActive:{ color: c.primary },
    tzOffset:     { fontSize: FontSize.xs, color: c.textMuted, marginTop: 2 },
  });
}

function makeMonthStyles(c: AppColors) {
  return StyleSheet.create({
    grid:      { paddingTop: 2 },
    dowRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
    dowCell:   { alignItems: 'center', paddingVertical: 7 },
    dowText:   { fontSize: 10, fontFamily: Font.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    weekRow:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.borderLight },
    cell:      { minHeight: 74, borderRightWidth: 1, borderRightColor: c.borderLight, padding: 4, alignItems: 'center' },
    cellOther: { backgroundColor: c.backgroundAlt },
    numWrap:      { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    numWrapToday: { backgroundColor: c.primary },
    num:       { fontSize: FontSize.sm, fontFamily: Font.semibold, color: c.text },
    numToday:  { color: '#fff' },
    numOther:  { color: c.textMuted, opacity: 0.5 },
    dots:      { flexDirection: 'row', gap: 3, marginBottom: 2 },
    dot:       { width: 6, height: 6, borderRadius: 3 },
    evLabel:   { fontSize: 9, color: c.textSecondary, textAlign: 'center', lineHeight: 12 },
  });
}

// ── Month grid ─────────────────────────────────────────────────────────────────
const MonthGrid: React.FC<{
  currentDate: Date;
  eventsByDate: Record<string, CalEvent[]>;
  onDayPress: (d: Date) => void;
  ev: EvPalette;
}> = ({ currentDate, eventsByDate, onDayPress, ev }) => {
  const c = useThemeColors();
  const mg = useMemo(() => makeMonthStyles(c), [c]);
  const cellW = Math.floor(SCREEN_W / 7);
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(currentDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays    = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={mg.grid}>
      <View style={mg.dowRow}>
        {DOW.map(d => (
          <View key={d} style={[mg.dowCell, { width: cellW }]}>
            <Text style={mg.dowText}>{d}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: allDays.length / 7 }, (_, wi) => (
        <View key={wi} style={mg.weekRow}>
          {allDays.slice(wi * 7, wi * 7 + 7).map(day => {
            const dateKey  = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate[dateKey] || [];
            const today    = isToday(day);
            const inMonth  = isSameMonth(day, currentDate);
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
                  {dayEvents.filter(e => e.type === 'availability').length > 0 && <View style={[mg.dot, { backgroundColor: ev.avail.border }]} />}
                  {dayEvents.filter(e => e.type === 'match').length > 0 && <View style={[mg.dot, { backgroundColor: ev.match.border }]} />}
                  {dayEvents.filter(e => e.type === 'invite').length > 0 && <View style={[mg.dot, { backgroundColor: ev.invite.border }]} />}
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

// ─────────────────────────────────────────────────────────────────────────────

export const ScheduleScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark, colors: c } = useTheme();
  const { availability, loading, fetchAvailability, createAvailability, deleteAvailability } = useUserAvailability();
  const { invites, respondToInvite, recordMatchResult, refetch: refetchInvites } = useMatches();
  const { assignments } = useDivisionAssignments();
  const primaryDivisionId = assignments[0]?.division_id;
  const { userMatches: leagueMatches } = useLeagueMatches(primaryDivisionId);
  useFocusEffect(useCallback(() => { refetchInvites(); }, [refetchInvites]));

  const scrollRef      = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const agendaDaysRef  = useRef<Date[]>([]);

  const EV = useMemo(() => getEV(isDark), [isDark]);
  const s  = useMemo(() => makeStyles(c), [c]);

  const scrollToDate = useCallback((date: Date) => {
    requestAnimationFrame(() => {
      const targetKey = format(date, 'yyyy-MM-dd');
      const days = agendaDaysRef.current;
      const exact = sectionOffsets.current[targetKey];
      if (exact !== undefined) { scrollRef.current?.scrollTo({ y: exact, animated: true }); return; }
      const targetTime = startOfDay(date).getTime();
      for (const d of days) {
        if (d.getTime() >= targetTime) {
          const offset = sectionOffsets.current[format(d, 'yyyy-MM-dd')];
          if (offset !== undefined) { scrollRef.current?.scrollTo({ y: offset, animated: true }); return; }
        }
      }
    });
  }, []);

  const [viewMode,      setViewMode]      = useState<ViewMode>('agenda');
  const [gridView,      setGridView]      = useState<GridView>('3day');
  const [showViewPicker, setShowViewPicker] = useState(false);
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [refreshing,    setRefreshing]    = useState(false);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [formData,      setFormData]      = useState<FormData>(DEFAULT_FORM);
  const [recurrence,    setRecurrence]    = useState<RecurrenceData>(DEFAULT_RECURRENCE);
  const [showRecurrence,setShowRecurrence]= useState(false);
  const [showTzPicker,  setShowTzPicker]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [timeError,     setTimeError]     = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [showEventSheet,setShowEventSheet]= useState(false);
  const [scoreMatch,    setScoreMatch]    = useState<any>(null);

  const autoOpenHandled = React.useRef(false);
  React.useEffect(() => {
    const openId = route?.params?.openInviteId as string | undefined;
    if (!openId || autoOpenHandled.current || !invites?.length || !user) return;
    const inv = invites.find(i => i.id === openId);
    if (!inv) return;
    autoOpenHandled.current = true;
    const isSender = inv.sender_id === user.id;
    const other = isSender ? inv.receiver : inv.sender;
    const name = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Player';
    setSelectedEvent({
      id: inv.id,
      type: isSender ? 'sent_invite' : 'invite',
      date: inv.date,
      start_time: inv.start_time,
      end_time: inv.end_time,
      title: isSender ? `Sent to ${name}` : `From ${name}`,
      bgColor:     isSender ? EV.sent_invite.bg     : EV.invite.bg,
      borderColor: isSender ? EV.sent_invite.border : EV.invite.border,
      textColor:   isSender ? EV.sent_invite.text   : EV.invite.text,
      data: inv,
    });
    setShowEventSheet(true);
  }, [invites, route?.params?.openInviteId, user, EV]);

  const goBack    = () => { if (viewMode === 'agenda') setCurrentDate(d => subWeeks(d, 1)); else setCurrentDate(d => subMonths(d, 1)); };
  const goForward = () => { if (viewMode === 'agenda') setCurrentDate(d => addWeeks(d, 1));  else setCurrentDate(d => addMonths(d, 1));  };

  const headerLabel = useMemo(() => format(currentDate, 'MMMM yyyy'), [currentDate]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ws, end: endOfWeek(currentDate, { weekStartsOn: 0 }) });
  }, [currentDate]);

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
      const name  = other ? `${other.first_name || ''} ${other.last_name || ''}`.trim() : 'Opponent';
      map[inv.date].push({ id: inv.id, type: 'match', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `vs ${name}`, bgColor: EV.match.bg, borderColor: EV.match.border, textColor: EV.match.text, data: inv });
    });
    (invites || []).filter(i => i.status === 'pending' && i.receiver_id === user?.id).forEach(inv => {
      if (!inv.date) return;
      if (!map[inv.date]) map[inv.date] = [];
      const sender = inv.sender;
      const name   = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Someone';
      map[inv.date].push({ id: inv.id, type: 'invite', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `From ${name}`, bgColor: EV.invite.bg, borderColor: EV.invite.border, textColor: EV.invite.text, data: inv });
    });
    (invites || []).filter(i => i.status === 'pending' && i.sender_id === user?.id).forEach(inv => {
      if (!inv.date) return;
      if (!map[inv.date]) map[inv.date] = [];
      const rec  = inv.receiver;
      const name = rec ? `${rec.first_name || ''} ${rec.last_name || ''}`.trim() : 'Player';
      map[inv.date].push({ id: inv.id, type: 'sent_invite', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `Sent to ${name}`, bgColor: EV.sent_invite.bg, borderColor: EV.sent_invite.border, textColor: EV.sent_invite.text, data: inv });
    });
    (leagueMatches || []).filter(m => m.scheduled_date && (m.status === 'scheduled' || m.status === 'pending')).forEach(m => {
      const date = m.scheduled_date!;
      if (!map[date]) map[date] = [];
      const startTime = m.scheduled_time || '09:00';
      const endHour   = parseInt(startTime.split(':')[0]) + 1;
      const endTime   = `${String(endHour).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
      map[date].push({ id: `league-${m.id}`, type: 'match', date, start_time: startTime, end_time: endTime, title: `🏆 vs ${m.opponent_name}`, bgColor: EV.league.bg, borderColor: EV.league.border, textColor: EV.league.text, data: { ...m, _isLeagueMatch: true } });
    });
    return map;
  }, [availability, invites, leagueMatches, user?.id, EV]);

  const agendaDays = useMemo(() => {
    const days: Date[] = [];
    const start = startOfDay(new Date());
    for (let i = 0; i < 60; i++) {
      const d   = addDays(start, i);
      const key = format(d, 'yyyy-MM-dd');
      if (isToday(d) || (eventsByDate[key] && eventsByDate[key].length > 0)) days.push(d);
    }
    return days;
  }, [eventsByDate]);

  const pendingInvites = useMemo(() =>
    (invites || []).filter(i => i.status === 'pending' && i.receiver_id === user?.id),
    [invites, user?.id],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAvailability(), refetchInvites()]);
    setRefreshing(false);
  };

  const openAdd = (date: Date, defaultTime?: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
    // Snap to 15-min boundary; for today use the next available slot if default is past.
    let start = snapTo15(defaultTime || '09:00');
    if (isToday && start <= format(new Date(), 'HH:mm')) start = nextSlot();
    const [sh] = start.split(':');
    const endH = Math.min(parseInt(sh, 10) + 1, 23);
    const end  = `${String(endH).padStart(2, '0')}:${start.split(':')[1]}`;
    setFormData({ ...DEFAULT_FORM, date: dateStr, start_time: start, end_time: end });
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
    if (formData.date < todayStr) { Alert.alert('Past date', 'Availability cannot be set for a past date.'); return; }
    if (formData.date === todayStr && formData.start_time < format(new Date(), 'HH:mm')) { Alert.alert('Past time', 'Start time has already passed today.'); return; }
    setSaving(true);
    try {
      const fmt  = (t: string) => t.length === 5 ? `${t}:00` : t;
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

  const handleCancelInvite = (id: string) => {
    Alert.alert('Cancel Invite', 'Cancel this match invite?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Invite', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('match_invites').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by_user_id: user!.id }).eq('id', id).eq('sender_id', user!.id);
          await supabase.rpc('unlock_slots_for_invite', { p_invite_id: id, p_user_id: user!.id });
          await refetchInvites(); setShowEventSheet(false);
        } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to cancel invite.'); }
      }},
    ]);
  };

  const handleCancelMatch = (id: string) => {
    Alert.alert('Cancel Match', 'Cancel this confirmed match? Both players will be notified.', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Match', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('match_invites').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by_user_id: user!.id }).eq('id', id);
          await supabase.rpc('unlock_slots_for_invite', { p_invite_id: id, p_user_id: user!.id });
          await refetchInvites(); setShowEventSheet(false);
        } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to cancel match.'); }
      }},
    ]);
  };


  agendaDaysRef.current = agendaDays;

  // ── Grid-view state ────────────────────────────────────────────────────────
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });
  const gridScrollRef = useRef<ScrollView>(null);

  const colCount    = gridView === '3day' ? 3 : 1;
  const COL_W       = (SCREEN_W - TIME_COL_W) / colCount;
  const visibleDays = useMemo(() =>
    Array.from({ length: colCount }, (_, i) => addDays(anchorDate, i)),
    [anchorDate, colCount],
  );
  // Week strip used in day view (Monday-start)
  const stripDays = useMemo(() => {
    const wStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(wStart, i));
  }, [anchorDate]);

  const todayStr    = format(new Date(), 'yyyy-MM-dd');
  const anchorMonth = gridView === 'month'
    ? format(anchorDate, 'MMMM yyyy')
    : format(anchorDate, 'MMMM');

  // Scroll to current time on mount and whenever switching into a grid view
  useEffect(() => {
    if (gridView === 'month') return;
    const y = nowMinutes * (HOUR_H / 60) - 120;
    const t = setTimeout(() => {
      gridScrollRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
    }, 350);
    return () => clearTimeout(t);
  // nowMinutes intentionally excluded — only re-scroll when the view changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridView]);

  // Tick the current-time line every minute
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);


  const nowY = nowMinutes * (HOUR_H / 60);
  const todayVisible = visibleDays.some(d => format(d, 'yyyy-MM-dd') === todayStr);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={g.safe} edges={[]}>
      <StatusBar style="dark" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[g.header, { paddingTop: insets.top + 10 }]}>
        {/* Avatar + month + actions */}
        <View style={g.headerTop}>
          <Text style={g.monthName}>{anchorMonth}</Text>
          <View style={g.headerActions}>
            {/* View picker icon — shows current view's icon; tap to switch */}
            <TouchableOpacity
              style={g.hBtn}
              onPress={() => setShowViewPicker(v => !v)}
              accessibilityRole="button"
              accessibilityLabel="Change calendar view"
            >
              <Ionicons name="apps-outline" size={22} color="rgba(0,0,0,0.55)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Day view — week strip (tap to jump to any day) */}
        {gridView === 'day' && (
          <View style={g.weekStrip}>
            {stripDays.map(day => {
              const key        = format(day, 'yyyy-MM-dd');
              const dayIsToday = key === todayStr;
              const isSelected = key === format(anchorDate, 'yyyy-MM-dd');
              return (
                <TouchableOpacity
                  key={key}
                  style={g.weekStripDay}
                  onPress={() => setAnchorDate(startOfDay(day))}
                  activeOpacity={0.7}
                >
                  <Text style={g.weekStripName}>{format(day, 'EEEEE')}</Text>
                  <View style={[
                    g.weekStripNum,
                    dayIsToday   && g.weekStripNumToday,
                    isSelected && !dayIsToday && g.weekStripNumSelected,
                  ]}>
                    <Text style={[
                      g.weekStripNumText,
                      dayIsToday   && g.weekStripNumTextToday,
                      isSelected && !dayIsToday && g.weekStripNumTextSelected,
                    ]}>
                      {format(day, 'd')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 3-day view — three column headers with prev/next nav */}
        {gridView === '3day' && (
          <View style={g.dayHeaderRow}>
            <View style={{ width: TIME_COL_W }}>
              <TouchableOpacity
                onPress={() => setAnchorDate(d => addDays(d, -colCount))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={g.navArrow}
              >
                <Ionicons name="chevron-back" size={14} color="rgba(0,0,0,0.4)" />
              </TouchableOpacity>
            </View>
            {visibleDays.map(day => {
              const key     = format(day, 'yyyy-MM-dd');
              const isToday = key === todayStr;
              return (
                <View key={key} style={[g.dayHeaderCell, { width: COL_W }]}>
                  <Text style={[g.dayName, isToday && g.dayNameToday]}>
                    {format(day, 'EEE').toUpperCase()}
                  </Text>
                  <View style={[g.dayNumWrap, isToday && g.dayNumWrapToday]}>
                    <Text style={[g.dayNum, isToday && g.dayNumToday]}>
                      {format(day, 'd')}
                    </Text>
                  </View>
                  {(eventsByDate[key] || []).length > 0 && !isToday && (
                    <View style={g.dayDot} />
                  )}
                </View>
              );
            })}
            <TouchableOpacity
              onPress={() => setAnchorDate(d => addDays(d, colCount))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={g.navArrowRight}
            >
              <Ionicons name="chevron-forward" size={14} color="rgba(0,0,0,0.4)" />
            </TouchableOpacity>
          </View>
        )}

        {/* All Day row — hidden in month view */}
        {gridView !== 'month' && (
          <View style={g.allDayRow}>
            <Text style={g.allDayLabel}>All day</Text>
            {visibleDays.map(day => (
              <View key={format(day, 'yyyy-MM-dd')} style={[g.allDayCell, { width: COL_W }]} />
            ))}
          </View>
        )}
      </View>

      {/* ── Month calendar ─────────────────────────────────────────────────── */}
      {gridView === 'month' && (
        <ScrollView style={g.gridScroll} showsVerticalScrollIndicator={false}>
          {/* Month navigation */}
          <View style={g.monthNavRow}>
            <TouchableOpacity
              onPress={() => setAnchorDate(d => subMonths(d, 1))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={18} color="rgba(0,0,0,0.5)" />
            </TouchableOpacity>
            <Text style={g.monthNavLabel}>{format(anchorDate, 'MMMM yyyy')}</Text>
            <TouchableOpacity
              onPress={() => setAnchorDate(d => addMonths(d, 1))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={g.monthWeekNames}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <Text key={d} style={g.monthWeekName}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {buildCalendarWeeks(anchorDate).map((week, wi) => (
            <View key={wi} style={g.monthWeek}>
              {week.map(day => {
                const key      = format(day, 'yyyy-MM-dd');
                const inMonth  = isSameMonth(day, anchorDate);
                const dayIsToday = key === todayStr;
                const events   = eventsByDate[key] || [];
                return (
                  <TouchableOpacity
                    key={key}
                    style={g.monthDayCell}
                    activeOpacity={0.7}
                    onPress={() => { setAnchorDate(startOfDay(day)); setGridView('day'); }}
                  >
                    <View style={[g.monthDayNum, dayIsToday && g.monthDayNumToday]}>
                      <Text style={[
                        g.monthDayText,
                        !inMonth && g.monthDayTextOut,
                        dayIsToday && g.monthDayTextToday,
                      ]}>
                        {format(day, 'd')}
                      </Text>
                    </View>
                    <View style={g.monthDots}>
                      {events.slice(0, 3).map((ev, ei) => (
                        <View key={ei} style={[g.monthDot, { backgroundColor: ev.borderColor }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Time grid ──────────────────────────────────────────────────────── */}
      {gridView !== 'month' && <ScrollView
        ref={gridScrollRef}
        style={g.gridScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.orange500} />}
      >
        <View style={{ height: GRID_H, flexDirection: 'row' }}>

          {/* Hour label column */}
          <View style={{ width: TIME_COL_W }}>
            {HOURS.map(h => (
              <View key={h} style={{ height: HOUR_H, justifyContent: 'flex-start', paddingTop: 4, paddingRight: 8 }}>
                {h > 0 && (
                  <Text style={g.hourLabel}>
                    {h < 12 ? `${h}` : h === 12 ? '12' : `${h}`}
                  </Text>
                )}
              </View>
            ))}
            {todayVisible && (
              <View
                style={[g.nowTimeLabel, { top: nowY - 9 }]}
                pointerEvents="none"
              >
                <Text style={g.nowTimeLabelText}>
                  {`${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`}
                </Text>
              </View>
            )}
          </View>

          {/* Day columns */}
          {visibleDays.map((day, colIdx) => {
            const key       = format(day, 'yyyy-MM-dd');
            const isToday   = key === todayStr;
            const dayEvents = eventsByDate[key] || [];
            const isLast    = colIdx === colCount - 1;

            return (
              <View
                key={key}
                style={[g.dayCol, { width: COL_W }, !isLast && g.dayColBorder]}
              >
                {/* Hour cells (tappable to add) */}
                {HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={g.hourCell}
                    activeOpacity={0.4}
                    onPress={() => {
                      const cellTime = new Date(day);
                      cellTime.setHours(h, 0, 0, 0);
                      if (cellTime < new Date()) return;
                      openAdd(day, `${String(h).padStart(2, '0')}:00`);
                    }}
                  >
                    <View style={g.halfHourLine} />
                  </TouchableOpacity>
                ))}

                {/* Event blocks */}
                {dayEvents.map(ev => {
                  const startM = timeToMinutes(ev.start_time);
                  const endM   = Math.max(timeToMinutes(ev.end_time), startM + 30);
                  const top    = startM * (HOUR_H / 60);
                  const height = Math.max((endM - startM) * (HOUR_H / 60), 28);
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      activeOpacity={0.8}
                      onPress={() => handleEventTap(ev)}
                      style={[g.eventBlock, {
                        top,
                        height,
                        backgroundColor: ev.bgColor,
                        borderLeftColor: ev.borderColor,
                      }]}
                    >
                      <Text style={[g.eventTitle, { color: ev.textColor }]} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      {height > 38 && (
                        <Text style={[g.eventTime, { color: ev.textColor }]}>
                          {fmtTime(ev.start_time)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Current time indicator */}
                {isToday && (
                  <View style={[g.nowLine, { top: nowY }]} pointerEvents="none">
                    <View style={g.nowDot} />
                    <View style={g.nowBar} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <View style={{ height: TAB_BAR_HEIGHT + 40 }} />
      </ScrollView>}

      {/* ── View picker dropdown ───────────────────────────────────────────── */}
      {showViewPicker && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={0}
            onPress={() => setShowViewPicker(false)}
          />
          <View style={[g.viewPickerMenu, { top: insets.top + 60 }]}>
            {(['day', '3day', 'month'] as GridView[]).map(v => (
              <TouchableOpacity
                key={v}
                style={[g.viewPickerItem, gridView === v && g.viewPickerItemActive]}
                onPress={() => { setGridView(v); setShowViewPicker(false); }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={VIEW_ICONS[v] as any}
                  size={17}
                  color={gridView === v ? Palette.orange500 : 'rgba(0,0,0,0.5)'}
                />
                <Text style={[g.viewPickerTxt, gridView === v && g.viewPickerTxtActive]}>
                  {v === 'day' ? 'Day' : v === '3day' ? '3 Days' : 'Month'}
                </Text>
                {gridView === v && (
                  <Ionicons name="checkmark" size={14} color={Palette.orange500} style={{ marginLeft: 'auto' as any }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[g.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}
        onPress={() => openAdd(anchorDate < startOfDay(new Date()) ? new Date() : anchorDate)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add availability"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Pending invites banner ──────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <TouchableOpacity
          style={[g.pendingBanner, { bottom: insets.bottom + TAB_BAR_HEIGHT + 80 }]}
          activeOpacity={0.85}
          onPress={() => { const inv = pendingInvites[0]; handleEventTap({ id: inv.id, type: 'invite', date: inv.date, start_time: inv.start_time, end_time: inv.end_time, title: `From ${inv.sender?.first_name || 'Player'}`, bgColor: EV.invite.bg, borderColor: EV.invite.border, textColor: EV.invite.text, data: inv }); }}
        >
          <Ionicons name="mail-outline" size={14} color="#fff" />
          <Text style={g.pendingBannerText}>
            {pendingInvites.length} pending invite{pendingInvites.length > 1 ? 's' : ''}
          </Text>
          <Ionicons name="chevron-forward" size={13} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Add Availability Modal ──────────────────────────────────────────── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={closeAddModal} style={s.modalCloseBtn} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={16} color={c.textSecondary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add Availability</Text>
            <TouchableOpacity onPress={handleSaveSlot} disabled={saving} style={s.modalSaveBtn}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.modalSaveTxt}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.fGroup}>
              <Text style={s.fLabel}>DATE</Text>
              <DateWheelPicker
                value={formData.date}
                onChange={v => setFormData(p => ({ ...p, date: v }))}
              />
            </View>

            <View style={s.fGroup}>
              <Text style={s.fLabel}>TIMEZONE</Text>
              <TouchableOpacity style={s.fSelect} onPress={() => setShowTzPicker(true)}>
                <Ionicons name="globe-outline" size={15} color={c.textSecondary} />
                <Text style={s.fSelectTxt} numberOfLines={1}>{US_TIMEZONES.find(t => t.value === formData.timezone)?.label ?? formData.timezone}</Text>
                <Ionicons name="chevron-down" size={14} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={s.fRow}>
              <View style={[s.fGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={s.fLabel}>START TIME</Text>
                <TimeWheelPicker
                  value={formData.start_time}
                  onChange={v => { setFormData(p => ({ ...p, start_time: v })); setTimeError(false); }}
                />
              </View>
              <View style={[s.fGroup, { flex: 1 }]}>
                <Text style={s.fLabel}>END TIME</Text>
                <TimeWheelPicker
                  value={formData.end_time}
                  onChange={v => { setFormData(p => ({ ...p, end_time: v })); setTimeError(false); }}
                />
              </View>
            </View>
            {timeError && <Text style={s.fError}>End time must be after start time</Text>}

            <View style={s.fGroup}>
              <Text style={s.fLabel}>PRIVACY</Text>
              <View style={s.pills}>
                {PRIVACY_OPTS.map(opt => (
                  <TouchableOpacity key={opt.v} style={[s.pill, formData.privacy_level === opt.v && s.pillActive]} onPress={() => setFormData(p => ({ ...p, privacy_level: opt.v }))}>
                    <Ionicons name={opt.icon as any} size={13} color={formData.privacy_level === opt.v ? '#fff' : c.textSecondary} />
                    <Text style={[s.pillText, formData.privacy_level === opt.v && s.pillTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.fHint}>{formData.privacy_level === 'public' ? 'Visible to all players' : 'Used for matching only'}</Text>
            </View>

            <View style={s.toggleRow}>
              <View style={s.toggleInfo}>
                <Text style={s.toggleLabel}>Available for matches</Text>
                <Text style={s.toggleSub}>{formData.is_available ? 'Open for bookings' : 'Block this time'}</Text>
              </View>
              <TouchableOpacity style={[s.toggle, formData.is_available && s.toggleOn]} onPress={() => setFormData(p => ({ ...p, is_available: !p.is_available }))} activeOpacity={0.8}>
                <View style={[s.toggleThumb, formData.is_available && s.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            <View style={[s.toggleRow, s.toggleRowBorder]}>
              <View style={s.toggleInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="repeat" size={15} color={c.text} />
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
                  <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
                    <View style={s.fGroup}>
                      <Text style={s.fLabel}>REPEAT EVERY</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextInput style={[s.fInput, { flex: 1, marginRight: Spacing.xs }]} value={String(recurrence.interval)} onChangeText={v => setRecurrence(r => ({ ...r, interval: parseInt(v) || 1 }))} keyboardType="number-pad" />
                        <Text style={s.unitText}>{recurrence.pattern === 'daily' ? 'day(s)' : recurrence.pattern === 'weekly' ? 'week(s)' : 'month(s)'}</Text>
                      </View>
                    </View>
                    <View style={s.fGroup}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                        <Text style={s.fLabel}>END DATE (OPT.)</Text>
                        {recurrence.endDate ? (
                          <TouchableOpacity onPress={() => setRecurrence(r => ({ ...r, endDate: '' }))}>
                            <Text style={{ fontSize: 11, color: c.primary }}>Clear</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <DateWheelPicker
                        value={recurrence.endDate || ''}
                        onChange={v => setRecurrence(r => ({ ...r, endDate: v }))}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={s.fGroup}>
              <Text style={s.fLabel}>NOTES (OPTIONAL)</Text>
              <TextInput style={[s.fInput, s.fTextArea]} value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))} placeholder="Add any notes..." placeholderTextColor={c.textMuted} multiline numberOfLines={3} />
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
                {formData.timezone === tz.value && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
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
              <View style={[s.sheetBadge, { backgroundColor: selectedEvent.bgColor, borderColor: selectedEvent.borderColor }]}>
                <Ionicons name={(EVENT_SYMBOL[selectedEvent.type] ?? 'calendar-outline') as any} size={13} color={selectedEvent.textColor} />
                <Text style={[s.sheetBadgeText, { color: selectedEvent.textColor }]}>
                  {selectedEvent.type === 'availability' ? 'Available Slot' : selectedEvent.type === 'match' ? 'Confirmed Match' : selectedEvent.type === 'sent_invite' ? 'Invite Sent' : 'Match Invite'}
                </Text>
              </View>
              <Text style={s.sheetTitle}>{selectedEvent.title}</Text>
              <View style={s.sheetRow}>
                <Ionicons name="calendar-outline" size={15} color={c.textMuted} />
                <Text style={s.sheetRowText}>{format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}</Text>
              </View>
              <View style={s.sheetRow}>
                <Ionicons name="time-outline" size={15} color={c.textMuted} />
                <Text style={s.sheetRowText}>{fmtTime(selectedEvent.start_time)} – {fmtTime(selectedEvent.end_time)}</Text>
              </View>
              {selectedEvent.data?.court_location && (
                <View style={s.sheetRow}>
                  <Ionicons name="location-outline" size={15} color={c.textMuted} />
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
                {selectedEvent.type === 'sent_invite' && (
                  <TouchableOpacity style={[s.shBtn, s.shBtnDelete]} onPress={() => handleCancelInvite(selectedEvent.id)}>
                    <Ionicons name="close-circle-outline" size={16} color="#fff" />
                    <Text style={s.shBtnText}>Cancel Invite</Text>
                  </TouchableOpacity>
                )}
                {selectedEvent.type === 'match' && !selectedEvent.data?._isLeagueMatch && (() => {
                  const past     = new Date(`${selectedEvent.date}T${selectedEvent.start_time}`) < new Date();
                  const hasScore = !!selectedEvent.data?.winner_id;
                  return past ? (
                    !hasScore ? (
                      <TouchableOpacity
                        style={[s.shBtn, s.shBtnAccept]}
                        onPress={() => { setShowEventSheet(false); setScoreMatch(selectedEvent.data); }}
                      >
                        <Ionicons name="trophy" size={16} color="#fff" />
                        <Text style={s.shBtnText}>Record Score</Text>
                      </TouchableOpacity>
                    ) : null
                  ) : (
                    <TouchableOpacity style={[s.shBtn, s.shBtnDelete]} onPress={() => handleCancelMatch(selectedEvent.id)}>
                      <Ionicons name="close-circle-outline" size={16} color="#fff" />
                      <Text style={s.shBtnText}>Cancel Match</Text>
                    </TouchableOpacity>
                  );
                })()}
                {selectedEvent.type === 'availability' && (
                  <TouchableOpacity style={[s.shBtn, s.shBtnDelete]} onPress={() => handleDeleteAvailability(selectedEvent.id)}>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={s.shBtnText}>Delete Slot</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.shBtn, s.shBtnClose]} onPress={() => setShowEventSheet(false)}>
                  <Text style={[s.shBtnText, { color: c.text }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      <CasualMatchScoringModal
        visible={!!scoreMatch}
        match={scoreMatch}
        userId={user?.id || ''}
        onClose={() => setScoreMatch(null)}
        onSubmit={async (winnerId, senderSets, receiverSets) => {
          await recordMatchResult(scoreMatch.id, winnerId, senderSets, receiverSets);
          Alert.alert('Result Saved!', 'The match result has been logged and both players notified.');
          setScoreMatch(null);
          refetchInvites();
        }}
      />
    </SafeAreaView>
  );
};

// ── Grid styles ────────────────────────────────────────────────────────────────
const GRID_BG   = '#ffffff';
const GRID_LINE = 'rgba(0,0,0,0.18)';
const GRID_DASH = 'rgba(0,0,0,0.08)';

const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GRID_BG },

  header: {
    backgroundColor: GRID_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRID_LINE,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  monthName:  { fontSize: 26, fontFamily: Font.black, color: '#111827', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  hBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  navArrow: {
    width: TIME_COL_W, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  navArrowRight: {
    width: 20, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 2,
  },
  dayHeaderCell:   { alignItems: 'center', gap: 3 },
  dayName:         { fontSize: 10, fontFamily: Font.bold, color: 'rgba(0,0,0,0.45)', letterSpacing: 0.5 },
  dayNameToday:    { color: Palette.orange500 },
  dayNumWrap:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNumWrapToday: { backgroundColor: Palette.orange500 },
  dayNum:          { fontSize: 16, fontFamily: Font.semibold, color: 'rgba(0,0,0,0.85)' },
  dayNumToday:     { color: '#fff' },
  dayDot:          { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Palette.orange500, marginTop: -2 },

  allDayRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRID_LINE,
    minHeight: 22,
  },
  allDayLabel: {
    width: TIME_COL_W,
    fontSize: 9,
    fontFamily: Font.medium,
    color: 'rgba(0,0,0,0.4)',
    textAlign: 'right',
    paddingRight: 8,
    paddingTop: 4,
  },
  allDayCell: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: GRID_LINE,
  },

  gridScroll: { flex: 1, backgroundColor: GRID_BG },

  // ── Day-view week strip ────────────────────────────────────────────────────
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  weekStripDay: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekStripName: {
    fontSize: 11,
    fontFamily: Font.bold,
    color: 'rgba(0,0,0,0.45)',
    letterSpacing: 0.4,
  },
  weekStripNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStripNumToday:    { backgroundColor: Palette.orange500 },
  weekStripNumSelected: { borderWidth: 1.5, borderColor: Palette.orange500 },
  weekStripNumText: {
    fontSize: 15,
    fontFamily: Font.regular,
    color: 'rgba(0,0,0,0.8)',
  },
  weekStripNumTextToday:    { color: '#fff', fontFamily: Font.bold },
  weekStripNumTextSelected: { color: Palette.orange500, fontFamily: Font.semibold },

  // ── View picker dropdown ───────────────────────────────────────────────────
  viewPickerMenu: {
    position: 'absolute',
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 999,
  },
  viewPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  viewPickerItemActive: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  viewPickerTxt: {
    fontSize: 15,
    fontFamily: Font.regular,
    color: 'rgba(0,0,0,0.75)',
    flex: 1,
  },
  viewPickerTxtActive: {
    fontFamily: Font.semibold,
    color: '#111827',
  },

  // ── Month calendar ─────────────────────────────────────────────────────────
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  monthNavLabel: {
    fontSize: 15,
    fontFamily: Font.semibold,
    color: '#111827',
  },
  monthWeekNames: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  monthWeekName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Font.bold,
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 0.4,
  },
  monthWeek: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  monthDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 54,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.12)',
  },
  monthDayNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayNumToday: {
    backgroundColor: Palette.orange500,
  },
  monthDayText: {
    fontSize: 14,
    fontFamily: Font.regular,
    color: '#111827',
  },
  monthDayTextOut: {
    color: 'rgba(0,0,0,0.25)',
  },
  monthDayTextToday: {
    color: '#ffffff',
    fontFamily: Font.bold,
  },
  monthDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 5,
    alignItems: 'center',
  },
  monthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  hourLabel: {
    fontSize: 11,
    fontFamily: Font.regular,
    color: 'rgba(0,0,0,0.4)',
    textAlign: 'right',
    paddingRight: 8,
    marginTop: -6,
  },

  dayCol:       { flex: 1, position: 'relative' },
  dayColBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: GRID_LINE },

  hourCell: {
    height: HOUR_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRID_LINE,
    justifyContent: 'flex-end',
  },
  halfHourLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GRID_DASH,
    marginTop: HOUR_H / 2 - StyleSheet.hairlineWidth,
  },

  eventBlock: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingTop: 3,
    overflow: 'hidden',
  },
  eventTitle: { fontSize: 11, fontFamily: Font.semibold, lineHeight: 14 },
  eventTime:  { fontSize: 10, fontFamily: Font.regular, opacity: 0.85, marginTop: 1 },

  nowLine: {
    position: 'absolute',
    left: -TIME_COL_W,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Palette.orange500,
    marginLeft: TIME_COL_W - 4,
  },
  nowBar: { flex: 1, height: 1.5, backgroundColor: Palette.orange500 },
  nowTimeLabel: {
    position: 'absolute',
    left: 0,
    right: 4,
    alignItems: 'flex-end',
  },
  nowTimeLabelText: {
    fontSize: 10,
    fontFamily: Font.bold,
    color: Palette.orange500,
    lineHeight: 18,
  },

  fab: {
    position: 'absolute',
    right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Palette.orange500,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Palette.orange500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },

  pendingBanner: {
    position: 'absolute',
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  pendingBannerText: { fontSize: 12, fontFamily: Font.semibold, color: '#fff' },
});
