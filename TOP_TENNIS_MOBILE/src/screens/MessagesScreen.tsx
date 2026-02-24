import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useMessages } from '@/hooks/useMessages';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format, isToday, isYesterday } from 'date-fns';

type MainTab = 'messages' | 'friends' | 'requests';

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

export const MessagesScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { conversations, getThread, sendMessage, markAsRead, loading: msgsLoading, refetch: refetchMsgs } = useMessages();
  const { friends, pendingReceived, pendingSent, loading: friendsLoading, updateRequestStatus, refetch: refetchFriends } = useFriendRequests();

  const [activeTab, setActiveTab] = useState<MainTab>('messages');
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMsgs(), refetchFriends()]);
    setRefreshing(false);
  };

  const openConversation = async (otherId: string) => {
    setActiveConv(otherId);
    await markAsRead(otherId);
  };

  const handleSend = async () => {
    if (!activeConv || !messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage(activeConv, messageText.trim());
      setMessageText('');
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    setResponding(requestId);
    try {
      await updateRequestStatus(requestId, status);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to respond.');
    } finally {
      setResponding(null);
    }
  };

  // ── Thread view ──────────────────────────────────────────────────────────────
  if (activeConv) {
    const conv = conversations.find(c => c.otherUserId === activeConv);
    const thread = getThread(activeConv);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScreenHeader
          title={conv?.otherUserName || 'Chat'}
          subtitle="Conversation"
          showBack
          navigation={{ goBack: () => setActiveConv(null) }}
        />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            data={thread}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.threadContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;
              return (
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{formatTime(item.created_at)}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyThread}><Text style={styles.emptyThreadText}>No messages yet. Say hello!</Text></View>
            }
          />
          <View style={styles.inputBar}>
            <TextInput
              style={styles.messageInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                : <Ionicons name="send" size={18} color={Colors.textInverse} />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Tab counts ───────────────────────────────────────────────────────────────
  const unreadMsgs = conversations.reduce((n, c) => n + c.unreadCount, 0);
  const loading = msgsLoading || friendsLoading;

  const tabs: { key: MainTab; label: string; icon: string; badge: number }[] = [
    { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline', badge: unreadMsgs },
    { key: 'friends',  label: 'Friends',  icon: 'people-outline',      badge: 0 },
    { key: 'requests', label: 'Requests', icon: 'person-add-outline',  badge: pendingReceived.length },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Messages" subtitle="Chat, friends & requests" navigation={navigation} showBack={navigation?.canGoBack?.()} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <View style={styles.tabIconWrap}>
              <Ionicons name={t.icon as any} size={18} color={activeTab === t.key ? Colors.primary : Colors.textSecondary} />
              {t.badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{t.badge > 9 ? '9+' : t.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            conversations.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={56} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>Accept a match invitation to start chatting</Text>
              </View>
            ) : (
              conversations.map((item, idx) => (
                <React.Fragment key={item.otherUserId}>
                  <TouchableOpacity style={styles.convRow} onPress={() => openConversation(item.otherUserId)} activeOpacity={0.7}>
                    <View style={styles.convAvatarWrap}>
                      <Avatar name={item.otherUserName} size={50} imageUrl={item.otherUserPicture} />
                      {item.unreadCount > 0 && (
                        <View style={styles.unreadDot}>
                          <Text style={styles.unreadDotText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.convInfo}>
                      <View style={styles.convTopRow}>
                        <Text style={[styles.convName, item.unreadCount > 0 && styles.convNameUnread]}>{item.otherUserName}</Text>
                        <Text style={styles.convTime}>{formatTime(item.lastMessageTime)}</Text>
                      </View>
                      <Text style={[styles.convPreview, item.unreadCount > 0 && styles.convPreviewUnread]} numberOfLines={1}>
                        {item.lastMessage}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {idx < conversations.length - 1 && <View style={styles.separator} />}
                </React.Fragment>
              ))
            )
          )}

          {/* FRIENDS TAB */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={56} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptySubtitle}>Search for players and send a friend request to connect</Text>
              </View>
            ) : (
              friends.map((req, idx) => {
                const friend = req.sender_id === user?.id ? req.receiver : req.sender;
                if (!friend) return null;
                return (
                  <React.Fragment key={req.id}>
                    <View style={styles.friendRow}>
                      <Avatar name={friend.name || 'P'} size={48} imageUrl={friend.profile_picture_url} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <View style={styles.friendMeta}>
                          {friend.skill_level != null && <View style={styles.metaChip}><Text style={styles.metaChipText}>Level {friend.skill_level}</Text></View>}
                          {friend.usta_rating && <View style={styles.metaChip}><Text style={styles.metaChipText}>USTA {friend.usta_rating}</Text></View>}
                        </View>
                      </View>
                      <View style={styles.friendBadge}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                        <Text style={styles.friendBadgeText}>Friends</Text>
                      </View>
                    </View>
                    {idx < friends.length - 1 && <View style={styles.separator} />}
                  </React.Fragment>
                );
              })
            )
          )}

          {/* REQUESTS TAB */}
          {activeTab === 'requests' && (
            pendingReceived.length === 0 && pendingSent.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="person-add-outline" size={56} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptySubtitle}>Search for players to send friend requests</Text>
              </View>
            ) : (
              <>
                {pendingReceived.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Received ({pendingReceived.length})</Text>
                    {pendingReceived.map((req, idx) => (
                      <React.Fragment key={req.id}>
                        <View style={styles.requestRow}>
                          <Avatar name={req.sender?.name || 'P'} size={48} imageUrl={req.sender?.profile_picture_url} />
                          <View style={styles.friendInfo}>
                            <Text style={styles.friendName}>{req.sender?.name || 'Unknown'}</Text>
                            {req.sender?.skill_level != null && <Text style={styles.requestMeta}>Level {req.sender.skill_level}/10</Text>}
                          </View>
                          <View style={styles.requestActions}>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(req.id, 'accepted')} disabled={responding === req.id}>
                              {responding === req.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(req.id, 'declined')} disabled={responding === req.id}>
                              <Ionicons name="close" size={18} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {idx < pendingReceived.length - 1 && <View style={styles.separator} />}
                      </React.Fragment>
                    ))}
                  </>
                )}
                {pendingSent.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, pendingReceived.length > 0 && { marginTop: Spacing.lg }]}>Sent ({pendingSent.length})</Text>
                    {pendingSent.map((req, idx) => (
                      <React.Fragment key={req.id}>
                        <View style={styles.requestRow}>
                          <Avatar name={req.receiver?.name || 'P'} size={48} imageUrl={req.receiver?.profile_picture_url} />
                          <View style={styles.friendInfo}>
                            <Text style={styles.friendName}>{req.receiver?.name || 'Unknown'}</Text>
                            <Text style={styles.requestMeta}>Waiting for response</Text>
                          </View>
                          <View style={styles.pendingChip}>
                            <Ionicons name="time-outline" size={13} color={Colors.warning} />
                            <Text style={styles.pendingChipText}>Pending</Text>
                          </View>
                        </View>
                        {idx < pendingSent.length - 1 && <View style={styles.separator} />}
                      </React.Fragment>
                    ))}
                  </>
                )}
              </>
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabIconWrap: { position: 'relative', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  tabBadge: { position: 'absolute', top: -4, right: -8, backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  tabLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  // Conversations
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, gap: Spacing.md },
  convAvatarWrap: { position: 'relative' },
  unreadDot: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: Colors.surface },
  unreadDotText: { color: Colors.textInverse, fontSize: 9, fontWeight: FontWeight.bold },
  convInfo: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convName: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  convNameUnread: { fontWeight: FontWeight.bold },
  convTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  convPreview: { fontSize: FontSize.sm, color: Colors.textSecondary },
  convPreviewUnread: { color: Colors.text, fontWeight: FontWeight.medium },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.lg + 50 + Spacing.md },

  // Friends
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, gap: Spacing.md },
  friendInfo: { flex: 1 },
  friendName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 3 },
  friendMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  metaChipText: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: FontWeight.medium },
  friendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  friendBadgeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },

  // Requests
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.background },
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, gap: Spacing.md },
  requestMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  pendingChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warningLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  pendingChipText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },

  // Thread
  threadContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.lg },
  bubble: { maxWidth: '78%', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 3 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSize.md, color: Colors.text },
  bubbleTextMine: { color: Colors.textInverse },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  messageInput: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text, maxHeight: 100, backgroundColor: Colors.background },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  emptyThread: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyThreadText: { fontSize: FontSize.md, color: Colors.textMuted },

  // Empty states
  empty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
