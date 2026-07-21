import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Platform,
} from 'react-native';
import { supabase } from '@/services/supabase';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications, Notification, NotificationType } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, Font, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

function getExpoNotifications() {
  try { return require('expo-notifications') as typeof import('expo-notifications'); } catch { return null; }
}

async function registerForPush(): Promise<string | null> {
  if (__DEV__ && Platform.OS === 'web') return null;
  const Notifs = getExpoNotifications();
  if (!Notifs) return null;
  const { status: existing } = await Notifs.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifs.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  if (Platform.OS === 'android') {
    await Notifs.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifs.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
  return (await Notifs.getExpoPushTokenAsync()).data;
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
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead,
          deleteNotification, markVisibleAsRead, refetch } = useNotifications();
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [readFilter, setReadFilter]   = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [selectMode, setSelectMode]   = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [responding, setResponding]   = useState<string | null>(null);
  const autoMarkedRef = useRef(false);

  useEffect(() => {
    const Notifs = getExpoNotifications();
    if (Notifs) {
      Notifs.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
          shouldShowBanner: true, shouldShowList: true,
        }),
      });
    }
    registerForPush().catch(() => {});
  }, []);

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

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const bulkMarkRead = async () => {
    await Promise.all(Array.from(selected).map(id => markAsRead(id)));
    exitSelectMode();
  };

  const bulkDelete = () => {
    Alert.alert('Delete', `Delete ${selected.size} notification${selected.size > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await Promise.all(Array.from(selected).map(id => deleteNotification(id)));
        exitSelectMode();
      }},
    ]);
  };

  const respondToMatchInvite = async (notif: Notification, status: 'accepted' | 'declined') => {
    const matchId = notif.metadata?.match_id;
    if (!matchId || !user) return;
    setResponding(notif.id);
    try {
      if (status === 'accepted') {
        // Accepts + books both players' availability slots + declines conflicts
        const { data, error } = await supabase.rpc('accept_invite_and_lock_slot', {
          p_invite_id: matchId,
          p_user_id: user.id,
          p_conflicting_invite_ids: [],
        });
        if (error) throw error;
        if (data && data.success === false) throw new Error(data.error);
      } else {
        await supabase.from('match_invites').update({ status, response_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', matchId);
        await supabase.rpc('unlock_slots_for_invite', { p_invite_id: matchId, p_user_id: user.id });
      }
      markAsRead(notif.id);
    } catch {}
    finally { setResponding(null); }
  };

  const respondToFriendRequest = async (notif: Notification, status: 'accepted' | 'declined') => {
    const requestId = notif.metadata?.request_id;
    if (!requestId) return;
    setResponding(notif.id);
    try {
      await supabase.from('friend_requests').update({ status }).eq('id', requestId);
      markAsRead(notif.id);
    } catch {}
    finally { setResponding(null); }
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
    const isSelected = selected.has(item.id);
    const isResponding_ = responding === item.id;

    const showInlineRespond = (item.type === 'match_invite' || item.type === 'match_rescheduled') && !!item.metadata?.match_id;
    const showFriendRespond = item.type === 'friend_request' && !!item.metadata?.request_id;

    return (
      <TouchableOpacity
        style={[s.notifRow, !item.read && s.notifRowUnread, isSelected && s.notifRowSelected]}
        onPress={() => selectMode ? toggleSelect(item.id) : handleTap(item)}
        onLongPress={() => {
          if (!selectMode) {
            setSelectMode(true);
            setSelected(new Set([item.id]));
          }
        }}
        activeOpacity={0.8}
      >
        {selectMode && (
          <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}

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

          {/* Inline respond for match invites */}
          {!selectMode && showInlineRespond && (
            <View style={s.inlineActions}>
              {isResponding_ ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                <>
                  <TouchableOpacity style={s.inlineAccept} onPress={() => respondToMatchInvite(item, 'accepted')}>
                    <Text style={s.inlineAcceptTxt}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.inlineDecline} onPress={() => respondToMatchInvite(item, 'declined')}>
                    <Text style={s.inlineDeclineTxt}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Inline respond for friend requests */}
          {!selectMode && showFriendRespond && (
            <View style={s.inlineActions}>
              {isResponding_ ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                <>
                  <TouchableOpacity style={s.inlineAccept} onPress={() => respondToFriendRequest(item, 'accepted')}>
                    <Text style={s.inlineAcceptTxt}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.inlineDecline} onPress={() => respondToFriendRequest(item, 'declined')}>
                    <Text style={s.inlineDeclineTxt}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {!selectMode && !showInlineRespond && !showFriendRespond && actionLbl && (
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
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.lg }]}
      >
        {selectMode ? (
          <TouchableOpacity style={s.backBtn} onPress={exitSelectMode} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Cancel selection" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{selectMode ? `${selected.size} selected` : 'Notifications'}</Text>
          {!selectMode && unreadCount > 0 && <Text style={s.headerSub}>{unreadCount} unread</Text>}
        </View>
        {selectMode ? (
          <View style={s.bulkActions}>
            <TouchableOpacity style={s.bulkBtn} onPress={bulkMarkRead} disabled={selected.size === 0}>
              <Text style={[s.bulkBtnTxt, selected.size === 0 && { opacity: 0.4 }]}>Read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.bulkBtn, s.bulkBtnDanger]} onPress={bulkDelete} disabled={selected.size === 0}>
              <Text style={[s.bulkBtnTxt, { color: '#FF6B6B' }, selected.size === 0 && { opacity: 0.4 }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity style={s.markAllBtn} onPress={markAllAsRead} activeOpacity={0.8}>
                <Text style={s.markAllTxt}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.selectBtn} onPress={() => setSelectMode(true)} activeOpacity={0.8}>
              <Text style={s.selectBtnTxt}>Select</Text>
            </TouchableOpacity>
          </View>
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
              <Text style={[s.typeMenuText, typeFilter === val && { color: Colors.primary, fontFamily: Font.bold }]}>{label}</Text>
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

  // Header — matches the app-wide gradient header (Performance, Manage Bookings, section pages)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  headerSub:   { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  markAllBtn:  {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  markAllTxt:  { fontSize: FontSize.xs, color: '#fff', fontFamily: Font.bold },
  selectBtn: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  selectBtnTxt: { fontSize: FontSize.xs, color: '#fff', fontFamily: Font.bold },
  bulkActions: { flexDirection: 'row', gap: 6 },
  bulkBtn: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  bulkBtnDanger: { backgroundColor: 'rgba(255,107,107,0.2)' },
  bulkBtnTxt: { fontSize: FontSize.xs, color: '#fff', fontFamily: Font.bold },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
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
  filterPillText:   { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.textSecondary },
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
  notifRowSelected: { backgroundColor: Colors.primaryLight },

  // Checkbox
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
    alignSelf: 'center', flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  // Inline respond buttons
  inlineActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  inlineAccept: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.success,
  },
  inlineAcceptTxt: { fontSize: FontSize.xs, fontFamily: Font.bold, color: '#fff' },
  inlineDecline: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorLight,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  inlineDeclineTxt: { fontSize: FontSize.xs, fontFamily: Font.bold, color: Colors.error },
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
  notifTitle: { flex: 1, fontSize: FontSize.md, fontFamily: Font.medium, color: Colors.text },
  notifTitleBold: { fontFamily: Font.bold },
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
  actionPillText: { fontSize: FontSize.xs, color: Colors.primary, fontFamily: Font.bold },

  // Empty
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.md },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  clearBtn:   { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  clearBtnText:{ fontSize: FontSize.sm, color: Colors.primary, fontFamily: Font.bold },
});
