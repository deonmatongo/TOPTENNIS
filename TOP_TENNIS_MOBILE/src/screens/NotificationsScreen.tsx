import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications, Notification, NotificationType } from '@/hooks/useNotifications';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as ExpoNotifications from 'expo-notifications';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

async function registerForPush(): Promise<string | null> {
  if (__DEV__ && Platform.OS === 'web') return null;
  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  if (Platform.OS === 'android') {
    await ExpoNotifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: ExpoNotifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
  return (await ExpoNotifications.getExpoPushTokenAsync()).data;
}

type ReadFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | NotificationType;

const getIcon = (type: NotificationType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'friend_request':     return 'person-add-outline';
    case 'friend_accepted':    return 'people-outline';
    case 'match_invite':       return 'tennisball-outline';
    case 'match_accepted':
    case 'match_confirmed':    return 'checkmark-circle-outline';
    case 'match_declined':
    case 'match_cancelled':    return 'close-circle-outline';
    case 'match_rescheduled':  return 'calendar-outline';
    case 'match_scheduled':    return 'calendar-outline';
    case 'match_result':       return 'trophy-outline';
    case 'match_suggestion':   return 'people-outline';
    case 'message_received':   return 'chatbubble-outline';
    case 'league_update':      return 'trophy-outline';
    case 'achievement':        return 'ribbon-outline';
    default:                   return 'notifications-outline';
  }
};

const getIconColor = (type: NotificationType): string => {
  switch (type) {
    case 'friend_request':
    case 'friend_accepted':    return Palette.blue500;
    case 'match_invite':
    case 'match_scheduled':    return Colors.primary;
    case 'match_accepted':
    case 'match_confirmed':    return Palette.green500;
    case 'match_declined':
    case 'match_cancelled':    return Palette.red500;
    case 'match_rescheduled':  return Colors.accent;
    case 'match_result':       return Palette.yellow500;
    case 'match_suggestion':   return Palette.purple500;
    case 'message_received':   return Palette.blue500;
    case 'league_update':      return Palette.green500;
    case 'achievement':        return Palette.yellow500;
    default:                   return Colors.textSecondary;
  }
};

const getActionLabel = (type: NotificationType): string | null => {
  switch (type) {
    case 'match_invite':    return 'View Invite';
    case 'match_accepted':
    case 'match_confirmed': return 'View Match';
    case 'friend_request':  return 'View Request';
    case 'message_received':return 'Open Chat';
    case 'league_update':   return 'View League';
    case 'match_suggestion':return 'Find Matches';
    default:                return null;
  }
};

const getNavTarget = (type: NotificationType): string | null => {
  switch (type) {
    case 'match_invite':
    case 'match_accepted':
    case 'match_confirmed':
    case 'match_declined':
    case 'match_cancelled':
    case 'match_rescheduled':
    case 'match_scheduled':
    case 'match_result':   return 'Matches';
    case 'friend_request':
    case 'friend_accepted':return 'Social';
    case 'message_received':return 'Messages';
    case 'league_update':  return 'MyLeagues';
    case 'match_suggestion':return 'CasualMatch';
    default:               return null;
  }
};

const fmtAgo = (date: Date): string => {
  const d = Math.floor((Date.now() - date.getTime()) / 1000);
  if (d < 60)     return 'Just now';
  if (d < 3600)   return `${Math.floor(d / 60)}m ago`;
  if (d < 86400)  return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return date.toLocaleDateString();
};

// ─────────────────────────────────────────────────────────────────────────────

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead,
          deleteNotification, markVisibleAsRead, refetch } = useNotifications();
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [readFilter, setReadFilter]   = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const autoMarkedRef = useRef(false);

  useEffect(() => { registerForPush().catch(() => {}); }, []);

  useEffect(() => {
    if (loading || autoMarkedRef.current || notifications.length === 0) return;
    const ids = notifications.slice(0, 20).filter(n => !n.read).map(n => n.id);
    if (!ids.length) return;
    autoMarkedRef.current = true;
    const t = setTimeout(() => markVisibleAsRead(ids), 1500);
    return () => clearTimeout(t);
  }, [loading, notifications, markVisibleAsRead]);

  const onRefresh = async () => {
    setRefreshing(true);
    autoMarkedRef.current = false;
    await refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => notifications.filter(n => {
    if (readFilter === 'unread' && n.read)   return false;
    if (readFilter === 'read'   && !n.read)  return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [notifications, readFilter, typeFilter, search]);

  const handleTap = useCallback((item: Notification) => {
    if (!item.read) markAsRead(item.id);
    const target = getNavTarget(item.type);
    if (target) try { navigation.navigate(target); } catch {}
  }, [markAsRead, navigation]);

  const hasFilters = readFilter !== 'all' || typeFilter !== 'all' || search !== '';

  const TYPE_OPTIONS: [TypeFilter, string][] = [
    ['all', 'All Types'], ['match_invite', 'Invites'], ['match_accepted', 'Accepted'],
    ['match_result', 'Results'], ['friend_request', 'Friend Requests'],
    ['message_received', 'Messages'], ['league_update', 'League'],
    ['achievement', 'Achievements'], ['general', 'General'],
  ];

  const renderItem = ({ item }: { item: Notification }) => {
    const icon       = getIcon(item.type);
    const iconColor  = getIconColor(item.type);
    const actionLbl  = getActionLabel(item.type);

    return (
      <TouchableOpacity
        style={[s.notifRow, !item.read && s.notifRowUnread]}
        onPress={() => handleTap(item)}
        onLongPress={() => Alert.alert('Delete Notification', 'Remove this notification?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(item.id) },
        ])}
        activeOpacity={0.8}
      >
        <View style={[s.iconBox, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
          {!item.read && <View style={s.unreadDot} />}
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.notifTitleRow}>
            <Text style={[s.notifTitle, !item.read && s.notifTitleBold]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={s.notifTime}>{fmtAgo(item.createdAt)}</Text>
          </View>
          <Text style={s.notifMsg} numberOfLines={2}>{item.message}</Text>
          {actionLbl && (
            <TouchableOpacity style={s.actionPill} onPress={() => handleTap(item)}>
              <Text style={s.actionPillText}>{actionLbl}</Text>
              <Ionicons name="chevron-forward" size={11} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar style="light" />
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={s.headerSub}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={markAllAsRead} activeOpacity={0.8}>
            <Text style={s.markAllTxt}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search notifications..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter pills ────────────────────────────────────────────────── */}
      <View style={s.filterBar}>
        {(['all', 'unread', 'read'] as ReadFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterPill, readFilter === f && s.filterPillActive]}
            onPress={() => setReadFilter(f)}
          >
            <Text style={[s.filterPillText, readFilter === f && s.filterPillTextActive]}>
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.filterPill, typeFilter !== 'all' && s.filterPillActive]}
          onPress={() => setShowTypeMenu(v => !v)}
        >
          <Ionicons name="funnel-outline" size={12} color={typeFilter !== 'all' ? '#fff' : Colors.textMuted} />
          <Text style={[s.filterPillText, typeFilter !== 'all' && s.filterPillTextActive]}>
            {typeFilter === 'all' ? 'Type' : typeFilter.replace(/_/g, ' ')}
          </Text>
        </TouchableOpacity>
        {hasFilters && (
          <TouchableOpacity onPress={() => { setSearch(''); setReadFilter('all'); setTypeFilter('all'); setShowTypeMenu(false); }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Type dropdown ───────────────────────────────────────────────── */}
      {showTypeMenu && (
        <View style={s.typeMenu}>
          {TYPE_OPTIONS.map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[s.typeMenuItem, typeFilter === val && s.typeMenuItemActive]}
              onPress={() => { setTypeFilter(val); setShowTypeMenu(false); }}
            >
              <Text style={[s.typeMenuText, typeFilter === val && { color: Colors.primary, fontWeight: FontWeight.bold }]}>{label}</Text>
              {typeFilter === val && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      {loading && !refreshing ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => n.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={filtered.length === 0 ? s.emptyContainer : s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>{hasFilters ? 'No matching notifications' : 'All caught up'}</Text>
              <Text style={s.emptySub}>{hasFilters ? 'Try adjusting your search or filters' : 'Notifications will appear here.'}</Text>
              {hasFilters && (
                <TouchableOpacity style={s.clearBtn} onPress={() => { setSearch(''); setReadFilter('all'); setTypeFilter('all'); }}>
                  <Text style={s.clearBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.black, color: '#fff', letterSpacing: -1 },
  headerSub:   { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.semibold, marginTop: 1 },
  markAllBtn:  {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  markAllTxt:  { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.bold },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    height: 46,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.xs,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 0 },

  // Filters
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexWrap: 'nowrap',
  },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterPillText:   { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  filterPillTextActive: { color: '#fff' },

  // Type dropdown
  typeMenu: {
    position: 'absolute', top: 200, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    zIndex: 100,
    ...Shadow.lg,
  },
  typeMenuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  typeMenuItemActive: { backgroundColor: Colors.primaryLight },
  typeMenuText: { fontSize: FontSize.sm, color: Colors.text },

  // List
  listContent:    { paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  sep:            { height: 1, backgroundColor: Colors.separator },

  // Notification row
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  notifRowUnread: { backgroundColor: '#F0F5FF' },
  iconBox: {
    width: 46, height: 46,
    borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: 2, right: 2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 1.5, borderColor: Colors.surface,
  },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  notifTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  notifTitleBold: { fontWeight: FontWeight.bold },
  notifTime:  { fontSize: FontSize.xxs, color: Colors.textMuted, flexShrink: 0 },
  notifMsg:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  actionPillText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },

  // Empty
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.md },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  clearBtn:   { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  clearBtnText:{ fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
});
