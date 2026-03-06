import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl,
  ActivityIndicator, Alert, ScrollView, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useConversations, Conversation, ConversationMember } from '@/hooks/useConversations';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format, isToday, isYesterday } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

function getConvName(conv: Conversation, currentUserId: string): string {
  if (conv.is_group) return conv.name || 'Group Chat';
  const other = conv.members.find(m => m.user_id !== currentUserId);
  if (!other?.profile) return 'Direct Message';
  return `${other.profile.first_name || ''} ${other.profile.last_name || ''}`.trim() || other.profile.email;
}

function getConvAvatar(conv: Conversation, currentUserId: string): string | undefined {
  if (conv.is_group) return conv.avatar_url ?? undefined;
  const other = conv.members.find(m => m.user_id !== currentUserId);
  return other?.profile?.profile_picture_url ?? undefined;
}

function getMemberName(m: ConversationMember): string {
  if (!m.profile) return 'Unknown';
  return `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email;
}

// ── Group Create Modal ────────────────────────────────────────────────────────

interface GroupCreateModalProps {
  visible: boolean;
  onClose: () => void;
  friends: { userId: string; name: string; avatar?: string }[];
  onSubmit: (name: string, memberIds: string[]) => Promise<void>;
}

const GroupCreateModal: React.FC<GroupCreateModalProps> = ({ visible, onClose, friends, onSubmit }) => {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleCreate = async () => {
    if (!name.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      await onSubmit(name.trim(), Array.from(selected));
      setName(''); setSelected(new Set()); onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.safe}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}><Text style={modalStyles.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={modalStyles.title}>New Group</Text>
          <TouchableOpacity onPress={handleCreate} disabled={!name.trim() || selected.size === 0 || creating}>
            <Text style={[modalStyles.done, (!name.trim() || selected.size === 0) && modalStyles.doneDim]}>
              {creating ? '...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={modalStyles.nameWrap}>
          <TextInput
            style={modalStyles.nameInput}
            placeholder="Group name"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>
        <Text style={modalStyles.sectionLabel}>ADD MEMBERS ({selected.size} selected)</Text>
        <ScrollView>
          {friends.length === 0 ? (
            <View style={modalStyles.empty}>
              <Text style={modalStyles.emptyText}>Add friends first to create a group</Text>
            </View>
          ) : (
            friends.map(f => (
              <TouchableOpacity key={f.userId} style={modalStyles.memberRow} onPress={() => toggle(f.userId)} activeOpacity={0.7}>
                <Avatar name={f.name} size={42} imageUrl={f.avatar} />
                <Text style={modalStyles.memberName}>{f.name}</Text>
                <View style={[modalStyles.checkbox, selected.has(f.userId) && modalStyles.checkboxChecked]}>
                  {selected.has(f.userId) && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Group Info / Manage Members Modal ─────────────────────────────────────────

interface GroupInfoModalProps {
  visible: boolean;
  onClose: () => void;
  conv: Conversation;
  currentUserId: string;
  isAdmin: boolean;
  friends: { userId: string; name: string; avatar?: string }[];
  onRemoveMember: (userId: string) => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onRenameGroup: (name: string) => Promise<void>;
}

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  visible, onClose, conv, currentUserId, isAdmin, friends,
  onRemoveMember, onAddMember, onRenameGroup,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(conv.name || '');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const existingIds = new Set(conv.members.map(m => m.user_id));
  const addableFriends = friends.filter(f => !existingIds.has(f.userId));

  const handleRename = async () => {
    if (!newName.trim()) return;
    try { await onRenameGroup(newName.trim()); setRenaming(false); } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.safe}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}><Text style={modalStyles.cancel}>Done</Text></TouchableOpacity>
          <Text style={modalStyles.title}>Group Info</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Group name */}
          <View style={modalStyles.infoSection}>
            {renaming ? (
              <View style={modalStyles.renameRow}>
                <TextInput
                  style={modalStyles.renameInput}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  maxLength={50}
                />
                <TouchableOpacity onPress={handleRename}><Text style={modalStyles.done}>Save</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setRenaming(false); setNewName(conv.name || ''); }}>
                  <Text style={modalStyles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={modalStyles.infoRow} onPress={() => isAdmin && setRenaming(true)} activeOpacity={isAdmin ? 0.7 : 1}>
                <Ionicons name="people-circle-outline" size={20} color={Colors.primary} />
                <Text style={modalStyles.infoLabel}>{conv.name || 'Group Chat'}</Text>
                {isAdmin && <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            )}
          </View>

          {/* Members */}
          <Text style={modalStyles.sectionLabel}>MEMBERS ({conv.members.length})</Text>
          {conv.members.map(m => (
            <View key={m.user_id} style={modalStyles.memberRow}>
              <Avatar name={getMemberName(m)} size={42} imageUrl={m.profile?.profile_picture_url ?? undefined} />
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.memberName}>
                  {getMemberName(m)}{m.user_id === currentUserId ? ' (you)' : ''}
                </Text>
                {m.role === 'admin' && (
                  <Text style={modalStyles.adminBadge}>Admin</Text>
                )}
              </View>
              {isAdmin && m.user_id !== currentUserId && (
                <TouchableOpacity
                  onPress={async () => {
                    Alert.alert('Remove Member', `Remove ${getMemberName(m)} from this group?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: async () => {
                        setBusy(m.user_id);
                        try { await onRemoveMember(m.user_id); } catch {}
                        setBusy(null);
                      }},
                    ]);
                  }}
                  disabled={busy === m.user_id}
                >
                  <Ionicons name="remove-circle-outline" size={22} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Add members */}
          {isAdmin && addableFriends.length > 0 && (
            <>
              <TouchableOpacity style={modalStyles.addMemberBtn} onPress={() => setShowAddMembers(v => !v)}>
                <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                <Text style={modalStyles.addMemberText}>Add Members</Text>
                <Ionicons name={showAddMembers ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showAddMembers && addableFriends.map(f => (
                <TouchableOpacity
                  key={f.userId}
                  style={modalStyles.memberRow}
                  onPress={async () => {
                    setBusy(f.userId);
                    try { await onAddMember(f.userId); } catch {}
                    setBusy(null);
                  }}
                  disabled={busy === f.userId}
                >
                  <Avatar name={f.name} size={42} imageUrl={f.avatar} />
                  <Text style={[modalStyles.memberName, { flex: 1 }]}>{f.name}</Text>
                  {busy === f.userId
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <Ionicons name="add-circle-outline" size={22} color={Colors.success} />
                  }
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const MessagesScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const { user } = useAuth();
  const {
    conversations, loading, sendMessage, getOrCreateDM, createGroupChat,
    addMember, removeMember, deleteMessage, updateGroup,
    markConversationRead, getTotalUnread, getMyRole, refetch,
  } = useConversations();
  const { friends, pendingReceived, pendingSent, loading: friendsLoading,
    updateRequestStatus, refetch: refetchFriends } = useFriendRequests();

  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    route?.params?.openConvId ?? null
  );
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Open a DM if navigation param provided
  useEffect(() => {
    const openUserId: string | undefined = route?.params?.openDMUserId;
    if (openUserId && !loading) {
      getOrCreateDM(openUserId).then(id => setSelectedConvId(id)).catch(() => {});
    }
  }, [route?.params?.openDMUserId, loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchFriends()]);
    setRefreshing(false);
  };

  const openConv = async (id: string) => {
    setSelectedConvId(id);
    await markConversationRead(id);
  };

  const handleSend = async () => {
    if (!selectedConvId || !msgInput.trim()) return;
    setSending(true);
    try {
      await sendMessage(selectedConvId, msgInput.trim());
      setMsgInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    setResponding(requestId);
    try { await updateRequestStatus(requestId, status); }
    catch (e: any) { Alert.alert('Error', e?.message || 'Failed to respond.'); }
    finally { setResponding(null); }
  };

  const handleDeleteMessage = (msgId: string) => {
    Alert.alert('Delete Message', 'Delete this message for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteMessage(msgId); setLongPressMsg(null); }
        catch { Alert.alert('Error', 'Failed to delete.'); }
      }},
    ]);
  };

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;
  const myRole = selectedConv ? getMyRole(selectedConv) : null;
  const isAdmin = myRole === 'admin';

  const friendsList = friends.map(f => {
    const friendUserId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    return { userId: friendUserId, name: fd?.name || 'Unknown', avatar: fd?.profile_picture_url };
  });

  const unreadTotal = getTotalUnread();
  const isLoading = loading && !refreshing;

  // ── Thread Screen ─────────────────────────────────────────────────────────
  if (selectedConvId && selectedConv) {
    const convName = getConvName(selectedConv, user?.id || '');
    const convAvatarUrl = getConvAvatar(selectedConv, user?.id || '');

    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Header */}
        <View style={styles.threadHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedConvId(null)}>
            <Ionicons name="chevron-back" size={26} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.threadHeaderInfo}
            onPress={() => selectedConv.is_group && setShowGroupInfo(true)}
            activeOpacity={selectedConv.is_group ? 0.7 : 1}
          >
            <Avatar name={convName} size={36} imageUrl={convAvatarUrl} />
            <View style={{ flex: 1 }}>
              <Text style={styles.threadTitle} numberOfLines={1}>{convName}</Text>
              {selectedConv.is_group && (
                <Text style={styles.threadSub}>{selectedConv.members.length} members · tap to manage</Text>
              )}
            </View>
          </TouchableOpacity>
          {selectedConv.is_group && (
            <TouchableOpacity onPress={() => setShowGroupInfo(true)} style={styles.infoBtn}>
              <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            ref={flatListRef}
            data={selectedConv.messages}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.threadContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;
              const senderName = item.sender
                ? `${item.sender.first_name || ''} ${item.sender.last_name || ''}`.trim() || item.sender.email
                : 'Unknown';
              const isLongPressed = longPressMsg === item.id;
              return (
                <TouchableOpacity
                  onLongPress={() => (isMine || isAdmin) && setLongPressMsg(item.id)}
                  activeOpacity={0.9}
                  style={styles.msgWrap}
                >
                  {!isMine && selectedConv.is_group && (
                    <View style={styles.senderRow}>
                      <Avatar name={senderName} size={24} imageUrl={item.sender?.profile_picture_url ?? undefined} />
                      <Text style={styles.senderName}>{senderName}</Text>
                    </View>
                  )}
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                    <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{formatTime(item.created_at)}</Text>
                  </View>
                  {isLongPressed && (
                    <View style={[styles.msgActions, isMine ? styles.msgActionsRight : styles.msgActionsLeft]}>
                      <TouchableOpacity style={styles.msgActionBtn} onPress={() => handleDeleteMessage(item.id)}>
                        <Ionicons name="trash-outline" size={14} color={Colors.error} />
                        <Text style={styles.msgActionText}>Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.msgActionBtn} onPress={() => setLongPressMsg(null)}>
                        <Ionicons name="close" size={14} color={Colors.textMuted} />
                        <Text style={[styles.msgActionText, { color: Colors.textMuted }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                <Text style={styles.emptyThreadText}>No messages yet. Say hello!</Text>
              </View>
            }
          />
          <View style={styles.inputBar}>
            <TextInput
              style={styles.messageInput}
              value={msgInput}
              onChangeText={setMsgInput}
              placeholder="Message..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!msgInput.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!msgInput.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                : <Ionicons name="send" size={18} color={Colors.textInverse} />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {selectedConv.is_group && (
          <GroupInfoModal
            visible={showGroupInfo}
            onClose={() => setShowGroupInfo(false)}
            conv={selectedConv}
            currentUserId={user?.id || ''}
            isAdmin={isAdmin}
            friends={friendsList}
            onRemoveMember={uid => removeMember(selectedConv.id, uid)}
            onAddMember={uid => addMember(selectedConv.id, uid)}
            onRenameGroup={name => updateGroup(selectedConv.id, { name })}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Conversations List ────────────────────────────────────────────────────

  const tabs: { key: typeof activeTab; label: string; badge?: number }[] = [
    { key: 'chats',    label: 'Chats',    badge: unreadTotal || undefined },
    { key: 'friends',  label: 'Friends',  badge: undefined },
    { key: 'requests', label: 'Requests', badge: pendingReceived.length || undefined },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.listTitle}>Messages</Text>
          {unreadTotal > 0 && <Text style={styles.listSub}>{unreadTotal} unread</Text>}
        </View>
        <TouchableOpacity style={styles.newGroupBtn} onPress={() => setShowGroupCreate(true)}>
          <Ionicons name="people-outline" size={18} color={Colors.primary} />
          <Text style={styles.newGroupText}>New Group</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {t.badge != null && t.badge > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{t.badge > 9 ? '9+' : t.badge}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* CHATS TAB */}
          {activeTab === 'chats' && (
            conversations.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={56} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No chats yet</Text>
                <Text style={styles.emptySubtitle}>Start a DM from the Friends tab or create a group chat</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowGroupCreate(true)}>
                  <Ionicons name="people-outline" size={16} color="#fff" />
                  <Text style={styles.emptyBtnText}>New Group</Text>
                </TouchableOpacity>
              </View>
            ) : (
              conversations.map((conv, idx) => {
                const name = getConvName(conv, user?.id || '');
                const avatarUrl = getConvAvatar(conv, user?.id || '');
                const preview = conv.lastMessage
                  ? (conv.is_group && conv.lastMessage.sender
                      ? `${conv.lastMessage.sender.first_name || ''}: ${conv.lastMessage.content}`
                      : conv.lastMessage.content)
                  : 'No messages yet';
                return (
                  <React.Fragment key={conv.id}>
                    <TouchableOpacity style={styles.convRow} onPress={() => openConv(conv.id)} activeOpacity={0.7}>
                      <View style={styles.convAvatarWrap}>
                        {conv.is_group ? (
                          <View style={styles.groupAvatarPlaceholder}>
                            <Ionicons name="people" size={24} color={Colors.primary} />
                          </View>
                        ) : (
                          <Avatar name={name} size={50} imageUrl={avatarUrl} />
                        )}
                        {conv.unreadCount > 0 && (
                          <View style={styles.unreadDot}>
                            <Text style={styles.unreadDotText}>{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.convInfo}>
                        <View style={styles.convTopRow}>
                          <Text style={[styles.convName, conv.unreadCount > 0 && styles.convNameUnread]} numberOfLines={1}>{name}</Text>
                          <Text style={styles.convTime}>{formatTime(conv.lastMessage?.created_at)}</Text>
                        </View>
                        <Text style={[styles.convPreview, conv.unreadCount > 0 && styles.convPreviewUnread]} numberOfLines={1}>{preview}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {idx < conversations.length - 1 && <View style={styles.separator} />}
                  </React.Fragment>
                );
              })
            )
          )}

          {/* FRIENDS TAB */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={56} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptySubtitle}>Search for players in Build Your Network</Text>
              </View>
            ) : (
              friends.map((req, idx) => {
                const friend = req.sender_id === user?.id ? req.receiver : req.sender;
                const friendUserId = req.sender_id === user?.id ? req.receiver_id : req.sender_id;
                if (!friend) return null;
                return (
                  <React.Fragment key={req.id}>
                    <TouchableOpacity
                      style={styles.friendRow}
                      onPress={async () => {
                        try {
                          const id = await getOrCreateDM(friendUserId);
                          setActiveTab('chats');
                          openConv(id);
                        } catch { Alert.alert('Error', 'Failed to open chat.'); }
                      }}
                      activeOpacity={0.7}
                    >
                      <Avatar name={friend.name || 'P'} size={48} imageUrl={friend.profile_picture_url} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <View style={styles.friendMeta}>
                          {friend.skill_level != null && <View style={styles.metaChip}><Text style={styles.metaChipText}>Level {friend.skill_level}</Text></View>}
                          {friend.usta_rating && <View style={styles.metaChip}><Text style={styles.metaChipText}>USTA {friend.usta_rating}</Text></View>}
                        </View>
                      </View>
                      <View style={styles.dmBtn}>
                        <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                      </View>
                    </TouchableOpacity>
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
                <Text style={styles.emptySubtitle}>Search for players in Build Your Network to connect</Text>
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

      <GroupCreateModal
        visible={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        friends={friendsList}
        onSubmit={async (name, ids) => {
          const id = await createGroupChat(name, ids);
          setShowGroupCreate(false);
          openConv(id);
        }}
      />
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // List header
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  listTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  listSub: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, marginTop: 2 },
  newGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  newGroupText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabBadge: { backgroundColor: Colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  // Conversations
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, gap: Spacing.md },
  convAvatarWrap: { position: 'relative' },
  groupAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: Colors.surface },
  unreadDotText: { color: Colors.textInverse, fontSize: 9, fontWeight: FontWeight.bold },
  convInfo: { flex: 1, minWidth: 0 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convName: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text, flex: 1 },
  convNameUnread: { fontWeight: FontWeight.bold },
  convTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: 4 },
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
  dmBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

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
  threadHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: Spacing.sm },
  backBtn: { padding: Spacing.sm },
  threadHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  threadTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  threadSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  infoBtn: { padding: Spacing.sm },
  threadContent: { padding: Spacing.md, paddingBottom: Spacing.lg },
  msgWrap: { marginBottom: Spacing.sm },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 2 },
  senderName: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  bubble: { maxWidth: '78%', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSize.md, color: Colors.text },
  bubbleTextMine: { color: Colors.textInverse },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, alignSelf: 'flex-end', marginTop: 2 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  msgActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  msgActionsRight: { justifyContent: 'flex-end' },
  msgActionsLeft: { justifyContent: 'flex-start' },
  msgActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  msgActionText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.medium },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  messageInput: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text, maxHeight: 120, backgroundColor: Colors.background },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  emptyThread: { alignItems: 'center', paddingTop: 60 },
  emptyThreadText: { fontSize: FontSize.md, color: Colors.textMuted },

  // Empty states
  empty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
});

// ── Modal Styles ──────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  cancel: { fontSize: FontSize.md, color: Colors.primary },
  done: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.bold },
  doneDim: { opacity: 0.4 },
  nameWrap: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, padding: Spacing.lg },
  nameInput: { fontSize: FontSize.lg, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.background },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  memberName: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  adminBadge: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  empty: { alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  infoSection: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  infoLabel: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  renameInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.md },
  addMemberText: { flex: 1, fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
});
