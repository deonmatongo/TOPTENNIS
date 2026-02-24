import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Animated,
  Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useNotifications, Notification, NotificationType } from '@/hooks/useNotifications';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import * as ExpoNotifications from 'expo-notifications';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
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
  const token = await ExpoNotifications.getExpoPushTokenAsync();
  return token.data;
}

type ReadFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | NotificationType;

const TYPE_LABELS: Record<string, string> = {
  all: 'All Types',
  match_invite: 'Match Invites',
  match_accepted: 'Accepted',
  match_declined: 'Declined',
  match_cancelled: 'Cancelled',
  match_rescheduled: 'Rescheduled',
  match_scheduled: 'Scheduled',
  match_result: 'Results',
  match_suggestion: 'Suggestions',
  friend_request: 'Friend Requests',
  friend_accepted: 'Friends',
  message_received: 'Messages',
  league_update: 'League',
  achievement: 'Achievements',
  general: 'General',
};

const getIcon = (type: NotificationType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'friend_request': return 'person-add-outline';
    case 'friend_accepted': return 'people-outline';
    case 'match_invite': return 'tennisball-outline';
    case 'match_accepted':
    case 'match_confirmed': return 'checkmark-circle-outline';
    case 'match_declined':
    case 'match_cancelled': return 'close-circle-outline';
    case 'match_rescheduled': return 'calendar-outline';
    case 'match_scheduled': return 'calendar-outline';
    case 'match_result': return 'trophy-outline';
    case 'match_suggestion': return 'people-outline';
    case 'message_received': return 'chatbubble-outline';
    case 'league_update': return 'trophy-outline';
    case 'achievement': return 'ribbon-outline';
    default: return 'notifications-outline';
  }
};

const getIconColor = (type: NotificationType) => {
  switch (type) {
    case 'friend_request':
    case 'friend_accepted': return '#3b82f6';
    case 'match_invite':
    case 'match_scheduled': return Colors.primary;
    case 'match_accepted':
    case 'match_confirmed': return Colors.success;
    case 'match_declined':
    case 'match_cancelled': return Colors.error;
    case 'match_rescheduled': return Colors.accent;
    case 'match_result': return '#f59e0b';
    case 'match_suggestion': return '#8b5cf6';
    case 'message_received': return '#3b82f6';
    case 'league_update': return '#10b981';
    case 'achievement': return '#f59e0b';
    default: return Colors.textSecondary;
  }
};

const fmtTimeAgo = (date: Date): string => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
};

const getActionLabel = (type: NotificationType): string | null => {
  switch (type) {
    case 'match_invite': return 'View Invite';
    case 'match_accepted':
    case 'match_confirmed': return 'View Match';
    case 'friend_request': return 'View Request';
    case 'message_received': return 'Open Chat';
    case 'league_update': return 'View League';
    case 'match_suggestion': return 'Find Matches';
    default: return null;
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
    case 'match_result': return 'Matches';
    case 'friend_request':
    case 'friend_accepted': return 'Social';
    case 'message_received': return 'Messages';
    case 'league_update': return 'MyLeagues';
    case 'match_suggestion': return 'CasualMatch';
    default: return null;
  }
};

function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);

  const handleSwipe = () => {
    if (swiped) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      setSwiped(false);
    } else {
      Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
      setSwiped(true);
    }
  };

  return (
    <View style={sw.container}>
      <View style={sw.deleteAction}>
        <TouchableOpacity style={sw.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity activeOpacity={1} onLongPress={handleSwipe} onPress={() => { if (swiped) { Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); setSwiped(false); } }}>
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const sw = StyleSheet.create({
  container: { overflow: 'hidden' },
  deleteAction: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 72, height: '100%', alignItems: 'center', justifyContent: 'center' },
});

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, markVisibleAsRead, refetch } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const autoMarkedRef = useRef(false);

  useEffect(() => {
    registerForPushNotificationsAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || autoMarkedRef.current || notifications.length === 0) return;
    const unreadIds = notifications.slice(0, 20).filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    autoMarkedRef.current = true;
    const t = setTimeout(() => markVisibleAsRead(unreadIds), 1500);
    return () => clearTimeout(t);
  }, [loading, notifications, markVisibleAsRead]);

  const onRefresh = async () => {
    setRefreshing(true);
    autoMarkedRef.current = false;
    await refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (readFilter === 'unread' && n.read) return false;
      if (readFilter === 'read' && !n.read) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [notifications, readFilter, typeFilter, search]);

  const handleTap = useCallback((item: Notification) => {
    if (!item.read) markAsRead(item.id);
    const target = getNavTarget(item.type);
    if (target) {
      try { navigation.navigate(target); } catch {}
    }
  }, [markAsRead, navigation]);

  const rightEl = unreadCount > 0 ? (
    <TouchableOpacity onPress={markAllAsRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.markAllText}>All read</Text>
    </TouchableOpacity>
  ) : undefined;

  const renderItem = ({ item }: { item: Notification }) => {
    const iconName = getIcon(item.type);
    const iconColor = getIconColor(item.type);
    const actionLabel = getActionLabel(item.type);

    return (
      <SwipeableRow onDelete={() => {
        Alert.alert('Delete', 'Remove this notification?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(item.id) },
        ]);
      }}>
        <TouchableOpacity
          style={[styles.row, !item.read && styles.rowUnread]}
          onPress={() => handleTap(item)}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
            <Ionicons name={iconName} size={22} color={iconColor} />
          </View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.read && <View style={styles.dot} />}
            </View>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            <View style={styles.meta}>
              <Text style={styles.time}>{fmtTimeAgo(item.createdAt)}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.type.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            {actionLabel && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleTap(item)}>
                <Text style={styles.actionBtnText}>{actionLabel}</Text>
                <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const hasFilters = readFilter !== 'all' || typeFilter !== 'all' || search !== '';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        navigation={navigation}
        showBack
        rightElement={rightEl}
      />

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search notifications..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {(['all', 'unread', 'read'] as ReadFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, readFilter === f && styles.filterChipActive]}
            onPress={() => setReadFilter(f)}
          >
            <Text style={[styles.filterChipText, readFilter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.filterChip, typeFilter !== 'all' && styles.filterChipActive]}
          onPress={() => setShowTypeMenu(v => !v)}
        >
          <Ionicons name="funnel-outline" size={13} color={typeFilter !== 'all' ? '#fff' : Colors.textSecondary} />
          <Text style={[styles.filterChipText, typeFilter !== 'all' && styles.filterChipTextActive]}>
            {typeFilter === 'all' ? 'Type' : TYPE_LABELS[typeFilter] ?? typeFilter}
          </Text>
        </TouchableOpacity>
        {hasFilters && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setSearch(''); setReadFilter('all'); setTypeFilter('all'); setShowTypeMenu(false); }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter dropdown */}
      {showTypeMenu && (
        <View style={styles.typeMenu}>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.typeMenuItem, typeFilter === val && styles.typeMenuItemActive]}
              onPress={() => { setTypeFilter(val as TypeFilter); setShowTypeMenu(false); }}
            >
              <Text style={[styles.typeMenuText, typeFilter === val && styles.typeMenuTextActive]}>{label}</Text>
              {typeFilter === val && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => n.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {hasFilters ? 'No matching notifications' : 'No notifications'}
              </Text>
              <Text style={styles.emptySub}>
                {hasFilters ? 'Try adjusting your search or filters' : "You're all caught up! Notifications will appear here."}
              </Text>
              {hasFilters && (
                <TouchableOpacity style={styles.clearFiltersBtn} onPress={() => { setSearch(''); setReadFilter('all'); setTypeFilter('all'); }}>
                  <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  markAllText: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.semibold },

  searchWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text },

  filterBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, flexWrap: 'nowrap' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  clearBtn: { marginLeft: Spacing.xs },

  typeMenu: { position: 'absolute', top: 180, left: Spacing.md, right: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  typeMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  typeMenuItemActive: { backgroundColor: Colors.primaryLight },
  typeMenuText: { fontSize: FontSize.sm, color: Colors.text },
  typeMenuTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  clearFiltersBtn: { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  clearFiltersBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  separator: { height: 1, backgroundColor: Colors.borderLight },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, gap: Spacing.md },
  rowUnread: { backgroundColor: '#eff6ff' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  title: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  titleUnread: { fontWeight: FontWeight.semibold },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, flexShrink: 0 },
  message: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  typeBadge: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, color: Colors.textSecondary, textTransform: 'capitalize' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: Spacing.xs, alignSelf: 'flex-start' },
  actionBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
});
