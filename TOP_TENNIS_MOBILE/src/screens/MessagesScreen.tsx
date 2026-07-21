import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl,
  ActivityIndicator, Alert, ScrollView, Clipboard, Modal,
  Keyboard, Image, Dimensions, useWindowDimensions, Animated, PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useConversations, Conversation, ConversationMember, ConversationMessage } from '@/hooks/useConversations';
import { uploadChatMedia, isImageMessage, parseVoiceMessage } from '@/services/chatMedia';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useTypingIndicator, TypingUser } from '@/hooks/useTypingIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { PlayerProfileSheet, PlayerSearchResult } from '@/components/ui/PlayerProfileSheet';
import { ReportSheet } from '@/components/ui/ReportSheet';
import { MatchInviteCard, MatchBookingSheet, BookingMember } from '@/components/chat/MatchBooking';
import { useMatchInvites, MatchInviteRecord } from '@/hooks/useMatchInvites';
import { Palette, Colors, Shadow, FontSize, Font, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';

function getAudio() {
  try { return require('expo-av').Audio; } catch { return null; }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtConvTime = (d?: string) => {
  if (!d) return '';
  const date = new Date(d);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if ((Date.now() - date.getTime()) / 86400000 < 7) return format(date, 'EEE');
  return format(date, 'M/d/yy');
};
const fmtMsgTime = (d: string) => format(new Date(d), 'h:mm a');
const fmtDivider = (d: string) => {
  const date = new Date(d);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
};

function getConvName(conv: Conversation, uid: string): string {
  if (conv.is_group) return conv.name || 'Group Chat';
  const other = conv.members.find(m => m.user_id !== uid);
  if (!other?.profile) return 'Direct Message';
  return `${other.profile.first_name || ''} ${other.profile.last_name || ''}`.trim() || other.profile.email;
}
function getConvOtherId(conv: Conversation, uid: string): string | null {
  if (conv.is_group) return null;
  return conv.members.find(m => m.user_id !== uid)?.user_id ?? null;
}
function getConvAvatar(conv: Conversation, uid: string): string | undefined {
  if (conv.is_group) return conv.avatar_url ?? undefined;
  return conv.members.find(m => m.user_id !== uid)?.profile?.profile_picture_url ?? undefined;
}
function getMemberName(m: ConversationMember): string {
  if (!m.profile) return 'Unknown';
  return `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email;
}
function getSenderName(msg: ConversationMessage): string {
  if (!msg.sender) return '';
  return `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email;
}

type ListItem =
  | { type: 'divider'; label: string; key: string }
  | { type: 'message'; data: ConversationMessage; key: string };

function buildItems(messages: ConversationMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate: Date | null = null;
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const msg of sorted) {
    if (msg.deleted_at) continue;
    const d = new Date(msg.created_at);
    if (!lastDate || !isSameDay(d, lastDate)) {
      items.push({ type: 'divider', label: fmtDivider(msg.created_at), key: `div_${msg.id}` });
      lastDate = d;
    }
    items.push({ type: 'message', data: msg, key: msg.id });
  }
  return items;
}

// ── Media bubbles ──────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['❤️', '😂', '👍', '🎾', '😮', '🔥'];

const ImageContent: React.FC<{ url: string; onOpen: (url: string) => void }> = ({ url, onOpen }) => (
  <TouchableOpacity onPress={() => onOpen(url)} activeOpacity={0.9}>
    <Image source={{ uri: url }} style={mb.image} resizeMode="cover" />
  </TouchableOpacity>
);

const VoiceContent: React.FC<{ url: string; isMine: boolean }> = ({ url, isMine }) => {
  const [playing, setPlaying] = useState(false);
  const [loadingSnd, setLoadingSnd] = useState(false);
  const soundRef = useRef<any>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync?.().catch(() => {}); }, []);

  const toggle = async () => {
    const Audio = getAudio();
    if (!Audio) { Alert.alert('Not supported', 'Voice playback requires a development build.'); return; }
    try {
      if (playing) {
        await soundRef.current?.pauseAsync();
        setPlaying(false);
        return;
      }
      if (!soundRef.current) {
        setLoadingSnd(true);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false });
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish) { setPlaying(false); sound.setPositionAsync(0).catch(() => {}); }
        });
        soundRef.current = sound;
        setLoadingSnd(false);
      }
      await soundRef.current.playAsync();
      setPlaying(true);
    } catch {
      setLoadingSnd(false);
      Alert.alert('Error', 'Could not play voice message.');
    }
  };

  return (
    <TouchableOpacity style={mb.voiceRow} onPress={toggle} activeOpacity={0.8}>
      <View style={[mb.voiceBtn, isMine && mb.voiceBtnMine]}>
        {loadingSnd
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#fff" />}
      </View>
      <View style={mb.voiceWave}>
        {[10, 16, 8, 18, 12, 20, 9, 15, 11, 17, 8, 13].map((h, i) => (
          <View key={i} style={[mb.voiceBar, { height: h }, playing && mb.voiceBarActive]} />
        ))}
      </View>
      <Ionicons name="mic" size={13} color={CHAT.muted} />
    </TouchableOpacity>
  );
};

const ReactionChips: React.FC<{
  reactions: { emoji: string; user_id: string }[];
  myId: string;
  isMine: boolean;
  onToggle: (emoji: string) => void;
}> = ({ reactions, myId, isMine, onToggle }) => {
  if (!reactions || reactions.length === 0) return null;
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const g = grouped.get(r.emoji) || { count: 0, mine: false };
    g.count += 1;
    if (r.user_id === myId) g.mine = true;
    grouped.set(r.emoji, g);
  }
  return (
    <View style={[mb.chipRow, isMine ? { justifyContent: 'flex-end' } : {}]}>
      {Array.from(grouped.entries()).map(([emoji, g]) => (
        <TouchableOpacity
          key={emoji}
          style={[mb.chip, g.mine && mb.chipMine]}
          onPress={() => onToggle(emoji)}
          activeOpacity={0.7}
        >
          <Text style={mb.chipEmoji}>{emoji}</Text>
          {g.count > 1 && <Text style={mb.chipCount}>{g.count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const mb = StyleSheet.create({
  image: { width: 210, height: 210, borderRadius: 10, backgroundColor: Colors.borderLight },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 170 },
  voiceBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  voiceBtnMine: { backgroundColor: Colors.primaryDark },
  voiceWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  voiceBar: { width: 3, borderRadius: 1.5, backgroundColor: Colors.primaryMuted },
  voiceBarActive: { backgroundColor: Colors.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.xs,
  },
  chipMine: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipEmoji: { fontSize: 13 },
  chipCount: { fontSize: 11, fontFamily: Font.bold, color: Colors.textSecondary },
});

// ── Chat tokens ────────────────────────────────────────────────────────────────

const CHAT = {
  bg: '#F1F0EE',
  sentBg: '#FFF7ED',
  sentBorder: Colors.primaryMuted,
  recvBg: '#FFFFFF',
  recvBorder: Colors.borderLight,
  muted: '#8696A0',
  tick: Colors.primary,
  inputBg: '#F0F2F5',
  divBg: 'rgba(241,240,238,0.9)',
  divText: Colors.textSecondary,
};

// ── Online dot ─────────────────────────────────────────────────────────────────

const OnlineDot: React.FC<{ online: boolean; size?: number }> = ({ online, size = 12 }) => {
  if (!online) return null;
  return (
    <View style={[od.ring, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      <View style={[od.dot, { width: size, height: size, borderRadius: size / 2 }]} />
    </View>
  );
};
const od = StyleSheet.create({
  ring: { backgroundColor: '#fff', position: 'absolute', bottom: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: '#25D366' },
});

// ── Typing indicator ───────────────────────────────────────────────────────────

const TypingBar: React.FC<{ users: TypingUser[] }> = ({ users }) => {
  if (users.length === 0) return null;
  const label = users.length === 1
    ? `${users[0].displayName} is typing…`
    : `${users.map(u => u.displayName).join(', ')} are typing…`;
  return (
    <View style={ty.wrap}>
      <View style={ty.dots}>
        {[0, 1, 2].map(i => <View key={i} style={ty.dot} />)}
      </View>
      <Text style={ty.txt}>{label}</Text>
    </View>
  );
};
const ty = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 5, backgroundColor: CHAT.bg },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CHAT.muted },
  txt: { fontSize: 12, color: CHAT.muted, fontStyle: 'italic' },
});

// ── Reply preview ──────────────────────────────────────────────────────────────

const ReplyPreview: React.FC<{ msg: ConversationMessage; onClear: () => void }> = ({ msg, onClear }) => (
  <View style={rp.wrap}>
    <View style={rp.bar} />
    <View style={{ flex: 1 }}>
      <Text style={rp.name}>{getSenderName(msg)}</Text>
      <Text style={rp.content} numberOfLines={1}>{msg.content}</Text>
    </View>
    <TouchableOpacity onPress={onClear} style={rp.close}>
      <Ionicons name="close" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  </View>
);
const rp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  bar: { width: 3, height: '100%', borderRadius: 2, backgroundColor: Colors.primary },
  name: { fontSize: 12, fontFamily: Font.bold, color: Colors.primary },
  content: { fontSize: 12, color: Colors.textSecondary },
  close: { padding: 4 },
});

// ── Message Bubble ─────────────────────────────────────────────────────────────

const Bubble: React.FC<{
  item: ConversationMessage;
  replySource?: ConversationMessage | null;
  myId: string;
  onReact: (messageId: string, emoji: string) => void;
  onOpenImage: (url: string) => void;
  isMine: boolean;
  isGroup: boolean;
  prevSameSender: boolean;
  isLongPressed: boolean;
  onLongPress: () => void;
  onReply: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onReport: () => void;
  onDismiss: () => void;
  onSenderPress?: (senderId: string) => void;
  recentInvites?: Map<string, MatchInviteRecord>;
}> = ({ item, replySource, isMine, isGroup, prevSameSender, isLongPressed, onLongPress, onReply, onDelete, onCopy, onReport, onDismiss, onSenderPress, recentInvites, myId, onReact, onOpenImage }) => {
  const imageMsg = isImageMessage(item.content);
  const voiceUrl = parseVoiceMessage(item.content);
  const senderName = getSenderName(item);
  const showAvatar = isGroup && !isMine && !prevSameSender;
  const showName = isGroup && !isMine && !prevSameSender;

  // Match invite card
  if (item.content.startsWith('__match_invite__:')) {
    const inviteId = item.content.replace('__match_invite__:', '');
    return (
      <View style={[bub.wrap, isMine ? bub.wrapR : bub.wrapL, prevSameSender && bub.tight]}>
        {isGroup && !isMine && (
          <View style={bub.avatarCol}>
            {showAvatar
              ? <TouchableOpacity onPress={() => onSenderPress?.(item.sender_id)} activeOpacity={0.8}>
                  <Avatar name={senderName} size={28} imageUrl={item.sender?.profile_picture_url ?? undefined} />
                </TouchableOpacity>
              : <View style={{ width: 28 }} />
            }
          </View>
        )}
        <View style={bub.col}>
          {showName && <Text style={bub.senderName}>{senderName}</Text>}
          <MatchInviteCard inviteId={inviteId} isMine={isMine} initialData={recentInvites?.get(inviteId)} />
          <Text style={[bub.time, isMine ? bub.timeR : bub.timeL, { marginTop: 4 }]}>
            {fmtMsgTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[bub.wrap, isMine ? bub.wrapR : bub.wrapL, prevSameSender && bub.tight]}>
      {isGroup && !isMine && (
        <View style={bub.avatarCol}>
          {showAvatar
            ? <Avatar name={senderName} size={28} imageUrl={item.sender?.profile_picture_url ?? undefined} />
            : <View style={{ width: 28 }} />
          }
        </View>
      )}

      <View style={bub.col}>
        {showName && (
          <TouchableOpacity onPress={() => onSenderPress?.(item.sender_id)} activeOpacity={0.7}>
            <Text style={bub.senderName}>{senderName}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onLongPress={onLongPress} activeOpacity={0.88} delayLongPress={300}>
          <View style={[bub.bubble, isMine ? bub.bubR : bub.bubL]}>
            {replySource && (
              <View style={bub.replyBox}>
                <View style={bub.replyBar} />
                <View style={{ flex: 1 }}>
                  <Text style={bub.replyName}>{getSenderName(replySource)}</Text>
                  <Text style={bub.replyContent} numberOfLines={1}>{replySource.content}</Text>
                </View>
              </View>
            )}
            {imageMsg ? (
              <ImageContent url={item.content.trim()} onOpen={onOpenImage} />
            ) : voiceUrl ? (
              <VoiceContent url={voiceUrl} isMine={isMine} />
            ) : (
              <Text style={[bub.text, isMine ? bub.textR : bub.textL]}>{item.content}</Text>
            )}
            <View style={bub.meta}>
              <Text style={[bub.time, isMine ? bub.timeR : bub.timeL]}>{fmtMsgTime(item.created_at)}</Text>
              {isMine && <Ionicons name="checkmark-done" size={13} color={CHAT.tick} style={{ marginLeft: 2 }} />}
            </View>
          </View>
        </TouchableOpacity>

        <ReactionChips
          reactions={item.reactions || []}
          myId={myId}
          isMine={isMine}
          onToggle={emoji => onReact(item.id, emoji)}
        />

        {isLongPressed && (
          <View style={[bub.menuWrap, isMine ? bub.menuR : bub.menuL]}>
            <View style={bub.reactRow}>
              {QUICK_REACTIONS.map(e => (
                <TouchableOpacity key={e} style={bub.reactBtn} onPress={() => { onReact(item.id, e); onDismiss(); }} activeOpacity={0.7}>
                  <Text style={bub.reactEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[bub.menu]}>
            <TouchableOpacity style={bub.menuItem} onPress={onReply}>
              <Ionicons name="arrow-undo-outline" size={14} color={Colors.text} />
              <Text style={bub.menuTxt}>Reply</Text>
            </TouchableOpacity>
            <View style={bub.menuSep} />
            <TouchableOpacity style={bub.menuItem} onPress={onCopy}>
              <Ionicons name="copy-outline" size={14} color={Colors.text} />
              <Text style={bub.menuTxt}>Copy</Text>
            </TouchableOpacity>
            {isMine ? (
              <>
                <View style={bub.menuSep} />
                <TouchableOpacity style={bub.menuItem} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                  <Text style={[bub.menuTxt, { color: Colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={bub.menuSep} />
                <TouchableOpacity style={bub.menuItem} onPress={onReport}>
                  <Ionicons name="flag-outline" size={14} color={Colors.error} />
                  <Text style={[bub.menuTxt, { color: Colors.error }]}>Report</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={bub.menuSep} />
            <TouchableOpacity style={bub.menuItem} onPress={onDismiss}>
              <Ionicons name="close" size={14} color={CHAT.muted} />
              <Text style={[bub.menuTxt, { color: CHAT.muted }]}>Dismiss</Text>
            </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const bub = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: Spacing.sm, marginBottom: 2 },
  wrapR: { justifyContent: 'flex-end' },
  wrapL: { justifyContent: 'flex-start' },
  tight: { marginBottom: 1 },
  avatarCol: { width: 32, alignItems: 'flex-start', justifyContent: 'flex-end', marginRight: 4 },
  col: { maxWidth: '76%' },
  senderName: { fontSize: 11, fontFamily: Font.semibold, color: Colors.primary, marginBottom: 2, marginLeft: 10 },
  bubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 5 },
  bubR: { backgroundColor: CHAT.sentBg, borderTopRightRadius: 3, borderWidth: 1, borderColor: CHAT.sentBorder },
  bubL: { backgroundColor: CHAT.recvBg, borderTopLeftRadius: 3, borderWidth: 1, borderColor: CHAT.recvBorder, ...Shadow.xs },
  replyBox: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 6, marginBottom: 6 },
  replyBar: { width: 3, borderRadius: 2, backgroundColor: Colors.primary, alignSelf: 'stretch' },
  replyName: { fontSize: 11, fontFamily: Font.semibold, color: Colors.primary },
  replyContent: { fontSize: 11, color: Colors.textSecondary },
  text: { fontSize: FontSize.md, lineHeight: 21 },
  textR: { color: '#1A1A2E' },
  textL: { color: '#1A1A2E' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3, gap: 1 },
  time: { fontSize: 10 },
  timeR: { color: Colors.primary },
  timeL: { color: CHAT.muted },
  menuWrap: { marginTop: 4, gap: 4, alignSelf: 'flex-start' },
  reactRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 4, gap: 2, ...Shadow.md, alignSelf: 'flex-start' },
  reactBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  reactEmoji: { fontSize: 20 },
  menu: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, ...Shadow.md, overflow: 'hidden', alignSelf: 'flex-start' },
  menuR: { alignSelf: 'flex-end' },
  menuL: { alignSelf: 'flex-start' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10 },
  menuTxt: { fontSize: FontSize.xs, fontFamily: Font.medium, color: Colors.text },
  menuSep: { width: 1, height: 28, backgroundColor: Colors.borderLight },
});

// ── Group Create Modal ─────────────────────────────────────────────────────────

const GroupCreateModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  friends: { userId: string; name: string; avatar?: string }[];
  onSubmit: (name: string, ids: string[]) => Promise<void>;
}> = ({ visible, onClose, friends, onSubmit }) => {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) => setSelected(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const handleCreate = async () => {
    if (!name.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      await onSubmit(name.trim(), Array.from(selected));
      setName(''); setSelected(new Set()); onClose();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to create group'); }
    finally { setCreating(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={gcm.safe}>
        <View style={gcm.header}>
          <TouchableOpacity onPress={onClose} style={gcm.closeBtn}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={gcm.title}>New Group</Text>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!name.trim() || selected.size < 1 || creating}
            style={[gcm.createBtn, (!name.trim() || selected.size < 1) && { opacity: 0.4 }]}
          >
            {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={gcm.createBtnTxt}>Create</Text>}
          </TouchableOpacity>
        </View>

        <View style={gcm.nameRow}>
          <View style={gcm.nameIcon}>
            <Ionicons name="people" size={20} color="#fff" />
          </View>
          <TextInput
            style={gcm.nameInput}
            placeholder="Group name..."
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>

        {selected.size > 0 && (
          <Text style={gcm.selCount}>{selected.size} member{selected.size > 1 ? 's' : ''} selected</Text>
        )}

        <Text style={gcm.sectionLbl}>SELECT FRIENDS</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {friends.map(f => {
            const on = selected.has(f.userId);
            return (
              <TouchableOpacity key={f.userId} style={gcm.row} onPress={() => toggle(f.userId)}>
                <Avatar name={f.name} size={44} imageUrl={f.avatar} />
                <Text style={gcm.rowName}>{f.name}</Text>
                <View style={[gcm.chk, on && gcm.chkOn]}>
                  {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
          {friends.length === 0 && (
            <View style={gcm.emptyWrap}>
              <Text style={gcm.emptyTxt}>No friends to add yet</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const gcm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.lg, fontFamily: Font.semibold, color: Colors.text },
  createBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full },
  createBtnTxt: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  nameIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  nameInput: { flex: 1, fontSize: FontSize.lg, color: Colors.text },
  selCount: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: 8, backgroundColor: Colors.primaryLight },
  sectionLbl: { fontSize: 10, fontFamily: Font.bold, color: Colors.textMuted, letterSpacing: 0.8, paddingHorizontal: Spacing.lg, paddingVertical: 10, backgroundColor: Colors.backgroundAlt, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowName: { flex: 1, fontSize: FontSize.md, fontFamily: Font.medium, color: Colors.text },
  chk: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  chkOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textMuted },
});

// ── Group Info Modal ───────────────────────────────────────────────────────────

const GroupInfoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  conv: Conversation;
  currentUserId: string;
  isAdmin: boolean;
  friends: { userId: string; name: string; avatar?: string }[];
  onRemoveMember: (uid: string) => Promise<void>;
  onAddMember: (uid: string) => Promise<void>;
  onRenameGroup: (name: string) => Promise<void>;
  onLeaveGroup: () => Promise<void>;
}> = ({ visible, onClose, conv, currentUserId, isAdmin, friends, onRemoveMember, onAddMember, onRenameGroup, onLeaveGroup }) => {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(conv.name || '');
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const existing = new Set(conv.members.map(m => m.user_id));
  const addable = friends.filter(f => !existing.has(f.userId));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={gim.safe}>
        <View style={gim.header}>
          <View style={{ width: 64 }} />
          <Text style={gim.title}>Group Info</Text>
          <TouchableOpacity onPress={onClose} style={gim.doneBtn}><Text style={gim.doneTxt}>Done</Text></TouchableOpacity>
        </View>
        <View style={gim.hero}>
          <View style={gim.heroAvt}><Ionicons name="people" size={34} color="#fff" /></View>
          {renaming ? (
            <View style={gim.renameRow}>
              <TextInput style={gim.renameInput} value={newName} onChangeText={setNewName} autoFocus maxLength={50} />
              <TouchableOpacity onPress={async () => { if (newName.trim()) { await onRenameGroup(newName.trim()); setRenaming(false); } }}>
                <Text style={gim.doneTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={gim.nameRow} onPress={() => isAdmin && setRenaming(true)} activeOpacity={isAdmin ? 0.7 : 1}>
              <Text style={gim.heroName}>{conv.name || 'Group Chat'}</Text>
              {isAdmin && <Ionicons name="pencil-outline" size={13} color={Colors.textMuted} style={{ marginLeft: 5 }} />}
            </TouchableOpacity>
          )}
          <Text style={gim.heroSub}>Group · {conv.members.length} members</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <Text style={gim.sectionLbl}>MEMBERS</Text>
          {conv.members.map(m => (
            <View key={m.user_id} style={gim.row}>
              <Avatar name={getMemberName(m)} size={44} imageUrl={m.profile?.profile_picture_url ?? undefined} />
              <View style={{ flex: 1 }}>
                <Text style={gim.rowName}>{getMemberName(m)}{m.user_id === currentUserId ? ' (you)' : ''}</Text>
                {m.role === 'admin' && <Text style={gim.adminTag}>Admin</Text>}
              </View>
              {isAdmin && m.user_id !== currentUserId && (
                <TouchableOpacity onPress={() => Alert.alert('Remove', `Remove ${getMemberName(m)}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: async () => { setBusy(m.user_id); try { await onRemoveMember(m.user_id); } catch {} setBusy(null); } },
                ])} disabled={busy === m.user_id}>
                  {busy === m.user_id ? <ActivityIndicator size="small" color={Colors.error} /> : <Ionicons name="remove-circle-outline" size={22} color={Colors.error} />}
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isAdmin && addable.length > 0 && (
            <>
              <TouchableOpacity style={gim.addRow} onPress={() => setShowAdd(v => !v)}>
                <View style={gim.addIcon}><Ionicons name="person-add-outline" size={17} color={Colors.primary} /></View>
                <Text style={gim.addTxt}>Add Members</Text>
                <Ionicons name={showAdd ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.textMuted} />
              </TouchableOpacity>
              {showAdd && addable.map(f => (
                <TouchableOpacity key={f.userId} style={gim.row} onPress={async () => { setBusy(f.userId); try { await onAddMember(f.userId); } catch {} setBusy(null); }} disabled={busy === f.userId}>
                  <Avatar name={f.name} size={44} imageUrl={f.avatar} />
                  <Text style={[gim.rowName, { flex: 1 }]}>{f.name}</Text>
                  {busy === f.userId ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </>
          )}
          <TouchableOpacity style={gim.leaveBtn} onPress={() => Alert.alert('Leave Group', 'Leave this group?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: onLeaveGroup },
          ])}>
            <Ionicons name="exit-outline" size={18} color={Colors.error} />
            <Text style={gim.leaveTxt}>Leave Group</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const gim = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.lg, fontFamily: Font.semibold, color: Colors.text },
  doneBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, minWidth: 64, alignItems: 'center' },
  doneTxt: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#fff' },
  hero: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 8 },
  heroAvt: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: FontSize.xl, fontFamily: Font.bold, color: Colors.text },
  heroSub: { fontSize: FontSize.sm, color: Colors.textMuted },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg },
  renameInput: { flex: 1, fontSize: FontSize.lg, color: Colors.text, borderBottomWidth: 2, borderBottomColor: Colors.primary, paddingBottom: 4 },
  sectionLbl: { fontSize: 10, fontFamily: Font.bold, color: Colors.textMuted, letterSpacing: 0.8, paddingHorizontal: Spacing.lg, paddingVertical: 10, backgroundColor: Colors.backgroundAlt, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowName: { fontSize: FontSize.md, fontFamily: Font.medium, color: Colors.text },
  adminTag: { fontSize: 11, color: Colors.primary, fontFamily: Font.semibold, marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addTxt: { flex: 1, fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.primary },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: 14, marginTop: Spacing.lg, backgroundColor: Colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderLight },
  leaveTxt: { fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.error },
});

// ── Empty state ────────────────────────────────────────────────────────────────

const EmptyState: React.FC<{
  icon: any; title: string; sub: string;
  action?: { label: string; onPress: () => void };
}> = ({ icon, title, sub, action }) => (
  <View style={em.wrap}>
    <View style={em.circle}><Ionicons name={icon} size={32} color={Colors.primary} /></View>
    <Text style={em.title}>{title}</Text>
    <Text style={em.sub}>{sub}</Text>
    {action && (
      <TouchableOpacity style={em.btn} onPress={action.onPress}>
        <Text style={em.btnTxt}>{action.label}</Text>
      </TouchableOpacity>
    )}
  </View>
);
const em = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full, marginTop: Spacing.sm },
  btnTxt: { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.md },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

type ActiveTab = 'chats' | 'friends' | 'requests' | 'blocked';

const LIST_TABS: { key: ActiveTab; label: string }[] = [
  { key: 'chats', label: 'Chats' },
  { key: 'friends', label: 'Friends' },
  { key: 'requests', label: 'Requests' },
  { key: 'blocked', label: 'Blocked' },
];

export const MessagesScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation, route }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    conversations, loading, sendMessage, getOrCreateDM, createGroupChat,
    addMember, removeMember, deleteMessage, updateGroup, leaveGroup,
    markConversationRead, getTotalUnread, getMyRole, refetch, toggleReaction,
  } = useConversations();
  const { friends, pendingReceived, pendingSent, updateRequestStatus, cancelRequest, refetch: refetchFriends } = useFriendRequests();
  const { blockedUsers, blockUser, unblockUser, unfriendUser, refetch: refetchBlocked } = useBlockedUsers();
  const { isOnline } = useOnlinePresence();

  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(route?.params?.openConvId ?? null);

  useEffect(() => {
    (navigation as any)?.setOptions?.({
      tabBarStyle: selectedConvId ? { display: 'none' } : undefined,
    });
  }, [selectedConvId, navigation]);

  useFocusEffect(
    useCallback(() => {
      (navigation as any)?.setOptions?.({
        tabBarStyle: selectedConvId ? { display: 'none' } : undefined,
      });
      return () => {
        (navigation as any)?.setOptions?.({ tabBarStyle: undefined });
      };
    }, [selectedConvId, navigation]),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState<PlayerSearchResult | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<ConversationMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [recentInvites, setRecentInvites] = useState<Map<string, MatchInviteRecord>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCancelled, setRecordingCancelled] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordingRef = useRef<any>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingPulse = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  const { typingUsers, broadcastTyping } = useTypingIndicator(selectedConvId);

  useEffect(() => {
    const uid: string | undefined = route?.params?.openDMUserId;
    if (uid && !loading) getOrCreateDM(uid).then(id => openConv(id)).catch(() => {});
  }, [route?.params?.openDMUserId, loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchFriends(), refetchBlocked()]);
    setRefreshing(false);
  };

  const openConv = async (id: string) => {
    setSelectedConvId(id);
    setLongPressMsg(null);
    setReplyTo(null);
    await markConversationRead(id);
  };

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try { await toggleReaction(messageId, emoji); } catch { /* non-critical */ }
  }, [toggleReaction]);

  // Keep read receipts current while a thread is open — new incoming
  // messages are marked read immediately instead of accruing as unread.
  const openConvMsgCount = selectedConvId
    ? conversations.find(c => c.id === selectedConvId)?.messages.length ?? 0
    : 0;
  useEffect(() => {
    if (selectedConvId && openConvMsgCount > 0) {
      markConversationRead(selectedConvId).catch(() => {});
    }
  }, [selectedConvId, openConvMsgCount]);

  const handleSend = async () => {
    if (!selectedConvId || (!msgInput.trim() && !pendingImage)) return;
    const text = msgInput.trim();
    const replyId = replyTo?.id;
    const imageUri = pendingImage;
    setMsgInput('');
    setReplyTo(null);
    setPendingImage(null);
    setSending(true);
    try {
      if (imageUri) {
        const publicUrl = await uploadChatMedia(user!.id, imageUri, 'image');
        await sendMessage(selectedConvId, publicUrl, replyId);
      }
      if (text) await sendMessage(selectedConvId, text, replyId);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      Alert.alert('Error', 'Failed to send.');
      if (text) setMsgInput(text);
      if (imageUri) setPendingImage(imageUri);
    } finally { setSending(false); }
  };

  const handleBooked = async (invites: MatchInviteRecord[]) => {
    if (!selectedConvId) return;
    setRecentInvites(prev => {
      const next = new Map(prev);
      invites.forEach(inv => next.set(inv.id, inv));
      return next;
    });
    for (const inv of invites) {
      await sendMessage(selectedConvId, `__match_invite__:${inv.id}`, undefined).catch(() => {});
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleEmojiToggle = () => {
    if (!showEmojiPicker) Keyboard.dismiss();
    setShowEmojiPicker(v => !v);
  };

  const handlePickImage = () => {
    Alert.alert('Attachment', 'Choose a source', [
      {
        text: 'Photo Library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to send images.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!result.canceled && result.assets[0]) { setPendingImage(result.assets[0].uri); setShowEmojiPicker(false); }
        },
      },
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera access to take photos.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!result.canceled && result.assets[0]) { setPendingImage(result.assets[0].uri); setShowEmojiPicker(false); }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const startRecording = async () => {
    try {
      const Audio = getAudio();
      if (!Audio) { Alert.alert('Not supported', 'Voice messages require a dev build — run eas build --profile development.'); return; }
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow microphone access to send voice messages.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingCancelled(false);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } catch { Alert.alert('Error', 'Could not start recording.'); }
  };

  const stopRecording = async (cancel = false) => {
    if (!recordingRef.current) return;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    recordingPulse.stopAnimation();
    recordingPulse.setValue(1);
    setIsRecording(false);
    const rec = recordingRef.current;
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      getAudio()?.setAudioModeAsync({ allowsRecordingIOS: false });
      if (cancel || recordSecs < 1) return;
      const uri = rec.getURI();
      if (!uri || !selectedConvId) return;
      setSending(true);
      const publicUrl = await uploadChatMedia(user!.id, uri, 'voice', 'm4a');
      await sendMessage(selectedConvId, `🎤 ${publicUrl}`, undefined);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch { Alert.alert('Error', 'Failed to send voice message.'); }
    finally { setSending(false); setRecordSecs(0); }
  };

  const micPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startRecording(); },
    onPanResponderMove: (_, gs) => {
      if (gs.dx < -60) setRecordingCancelled(true);
      else setRecordingCancelled(false);
    },
    onPanResponderRelease: (_, gs) => { stopRecording(gs.dx < -60); },
    onPanResponderTerminate: () => { stopRecording(true); },
  });

  const fmtRecordTime = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const handleTyping = useCallback((text: string) => {
    setMsgInput(text);
    if (text.length > 0 && user) {
      const name = `${(user as any).user_metadata?.first_name || ''}`.trim() || user.email || 'Someone';
      broadcastTyping(name);
    }
  }, [broadcastTyping, user]);

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    setResponding(id);
    try { await updateRequestStatus(id, status); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setResponding(null); }
  };

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;
  const isAdmin = selectedConv ? getMyRole(selectedConv) === 'admin' : false;
  const friendsList = friends.map(f => {
    const uid = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    return { userId: uid, name: fd?.name || 'Unknown', avatar: fd?.profile_picture_url ?? undefined };
  });
  const blockedIds = new Set(blockedUsers.map(b => b.blocked_user_id));

  const visibleConvs = conversations.filter(c => {
    if (c.is_group) return true;
    const otherId = getConvOtherId(c, user?.id || '');
    return !otherId || !blockedIds.has(otherId);
  });

  const filteredConvs = visibleConvs.filter(c =>
    !searchQuery.trim() || getConvName(c, user?.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriends = friends.filter(req => {
    const fd = req.sender_id === user?.id ? req.receiver : req.sender;
    if (!fd) return false;
    if (!friendSearch.trim()) return true;
    return fd.name?.toLowerCase().includes(friendSearch.toLowerCase());
  });

  const unreadTotal = getTotalUnread();

  // ── Thread view ──────────────────────────────────────────────────────────────

  if (selectedConvId && selectedConv) {
    const convName = getConvName(selectedConv, user?.id || '');
    const convAvatar = getConvAvatar(selectedConv, user?.id || '');
    const otherId = getConvOtherId(selectedConv, user?.id || '');
    const otherIsOnline = otherId ? isOnline(otherId) : false;
    const items = buildItems(selectedConv.messages);
    const msgMap = new Map(selectedConv.messages.map(m => [m.id, m]));

    return (
      <View style={{ flex: 1, backgroundColor: CHAT.bg }}>
        {/* Thread header */}
        <LinearGradient
          colors={[Palette.dark900, Palette.dark800]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[th.header, { paddingTop: insets.top + 8 }]}
        >
          <TouchableOpacity style={th.backBtn} onPress={() => { setSelectedConvId(null); setReplyTo(null); }} accessibilityRole="button" accessibilityLabel="Back to conversations" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={th.identity}
            onPress={() => {
              if (selectedConv.is_group) setShowGroupInfo(true);
              else if (otherId) {
                const m = selectedConv.members.find(mb => mb.user_id === otherId);
                setProfilePlayer({
                  id: m?.profile?.id ?? otherId,
                  user_id: otherId,
                  name: convName,
                  profile_picture_url: convAvatar ?? null,
                  email: m?.profile?.email,
                });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={{ position: 'relative' }}>
              {selectedConv.is_group
                ? <View style={th.groupAvt}><Ionicons name="people" size={19} color={Colors.primary} /></View>
                : <Avatar name={convName} size={38} imageUrl={convAvatar} />
              }
              {!selectedConv.is_group && <OnlineDot online={otherIsOnline} size={10} />}
            </View>
            <View style={th.nameCol}>
              <Text style={th.name} numberOfLines={1}>{convName}</Text>
              <Text style={th.sub} numberOfLines={1}>
                {selectedConv.is_group
                  ? `${selectedConv.members.length} members`
                  : otherIsOnline ? 'Online now' : 'Tap to view profile'}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={th.actions}>
            {/* Book a match */}
            <TouchableOpacity
              style={th.iconBtn}
              activeOpacity={0.7}
              onPress={() => setShowBookingSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Book a match"
            >
              <Ionicons name="tennisball-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            {selectedConv.is_group && (
              <TouchableOpacity style={th.iconBtn} onPress={() => setShowGroupInfo(true)} accessibilityRole="button" accessibilityLabel="Group info">
                <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Match booking sheet */}
        {(() => {
          const bookingMembers: BookingMember[] = selectedConv.is_group
            ? selectedConv.members
                .filter(m => m.user_id !== user?.id)
                .map(m => ({
                  userId: m.user_id,
                  name: [m.profile?.first_name, m.profile?.last_name].filter(Boolean).join(' ') || 'Player',
                  avatarUrl: m.profile?.profile_picture_url ?? undefined,
                }))
            : otherId
            ? [{ userId: otherId, name: convName, avatarUrl: convAvatar ?? undefined }]
            : [];
          return (
            <MatchBookingSheet
              visible={showBookingSheet}
              onClose={() => setShowBookingSheet(false)}
              members={bookingMembers}
              onBooked={handleBooked}
            />
          );
        })()}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={flatListRef}
            data={items}
            keyExtractor={i => i.key}
            contentContainerStyle={th.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item, index }) => {
              if (item.type === 'divider') {
                return (
                  <View style={th.divider}>
                    <Text style={th.dividerTxt}>{item.label}</Text>
                  </View>
                );
              }
              const msg = item.data;
              const isMine = msg.sender_id === user?.id;
              const prev = index > 0 ? items[index - 1] : null;
              const prevSameSender = prev?.type === 'message' && prev.data.sender_id === msg.sender_id;
              const replySource = msg.reply_to_id ? msgMap.get(msg.reply_to_id) ?? null : null;
              return (
                <Bubble
                  item={msg}
                  replySource={replySource}
                  isMine={isMine}
                  myId={user?.id ?? ''}
                  onReact={handleReact}
                  onOpenImage={setViewerImage}
                  isGroup={selectedConv.is_group}
                  prevSameSender={prevSameSender}
                  isLongPressed={longPressMsg === msg.id}
                  onLongPress={() => setLongPressMsg(msg.id)}
                  onReply={() => { setReplyTo(msg); setLongPressMsg(null); }}
                  onDelete={() => Alert.alert('Delete', 'Delete this message?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      try { await deleteMessage(msg.id); setLongPressMsg(null); }
                      catch { Alert.alert('Error', 'Failed to delete.'); }
                    }},
                  ])}
                  onCopy={() => { Clipboard.setString(msg.content); setLongPressMsg(null); }}
                  onReport={() => { setReportMsg(msg); setLongPressMsg(null); }}
                  onDismiss={() => setLongPressMsg(null)}
                  onSenderPress={uid => {
                    const m = selectedConv.members.find(mb => mb.user_id === uid);
                    if (!m) return;
                    setProfilePlayer({
                      id: m.profile?.id ?? uid,
                      user_id: uid,
                      name: getMemberName(m),
                      profile_picture_url: m.profile?.profile_picture_url ?? null,
                      email: m.profile?.email,
                    });
                  }}
                  recentInvites={recentInvites}
                />
              );
            }}
            ListEmptyComponent={
              <View style={th.emptyWrap}>
                <View style={th.emptyPill}>
                  <Ionicons name="lock-closed" size={12} color={CHAT.muted} />
                  <Text style={th.emptyPillTxt}>Messages are private</Text>
                </View>
                <Text style={th.emptyTxt}>Say hello to {convName} 👋</Text>
              </View>
            }
          />

          <TypingBar users={typingUsers} />
          {replyTo && <ReplyPreview msg={replyTo} onClear={() => setReplyTo(null)} />}

          {pendingImage && (
            <View style={th.imgPreviewBar}>
              <Image source={{ uri: pendingImage }} style={th.imgPreviewThumb} />
              <TouchableOpacity style={th.imgRemoveBtn} onPress={() => setPendingImage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}

          {showEmojiPicker && (
            <EmojiPanel onSelect={e => setMsgInput(v => v + e)} />
          )}

          {/* Recording overlay bar */}
          {isRecording && (
            <View style={th.recBar}>
              <Animated.View style={[th.recDot, { transform: [{ scale: recordingPulse }] }]} />
              <Text style={th.recTimer}>{fmtRecordTime(recordSecs)}</Text>
              <Text style={[th.recHint, recordingCancelled && th.recHintCancel]}>
                {recordingCancelled ? '← Release to cancel' : '← Slide to cancel'}
              </Text>
            </View>
          )}

          <View style={[th.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {!isRecording && (
              <View style={th.inputWrap}>
                <TouchableOpacity style={th.emojiBtn} onPress={handleEmojiToggle}>
                  <Ionicons name={showEmojiPicker ? 'happy' : 'happy-outline'} size={22} color={showEmojiPicker ? Colors.primary : CHAT.muted} />
                </TouchableOpacity>
                <TextInput
                  style={th.input}
                  value={msgInput}
                  onChangeText={handleTyping}
                  placeholder="Message"
                  placeholderTextColor={CHAT.muted}
                  multiline
                  maxLength={2000}
                  onFocus={() => { setShowEmojiPicker(false); setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300); }}
                />
                <TouchableOpacity style={th.attachBtn} onPress={handlePickImage}>
                  <Ionicons name="attach-outline" size={22} color={pendingImage ? Colors.primary : CHAT.muted} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
              </View>
            )}
            {isRecording && <View style={{ flex: 1 }} />}

            {/* Send / mic button */}
            {(msgInput.trim() || pendingImage) ? (
              <TouchableOpacity
                style={[th.sendBtn, th.sendBtnActive]}
                onPress={handleSend}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={17} color="#fff" style={{ marginLeft: 2 }} />
                }
              </TouchableOpacity>
            ) : (
              <Animated.View
                style={[th.sendBtn, th.sendBtnActive, isRecording && th.sendBtnRecording, { transform: [{ scale: isRecording ? recordingPulse : 1 }] }]}
                {...micPanResponder.panHandlers}
              >
                <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={20} color="#fff" />
              </Animated.View>
            )}
          </View>
        </KeyboardAvoidingView>

        <PlayerProfileSheet
          visible={!!profilePlayer}
          player={profilePlayer}
          onClose={() => setProfilePlayer(null)}
          onMessage={async (uid) => {
            setProfilePlayer(null);
            const convId = await getOrCreateDM(uid);
            if (convId) setSelectedConvId(convId);
          }}
        />

        <ReportSheet
          visible={!!reportMsg}
          onClose={() => setReportMsg(null)}
          context="message"
          targetUserId={reportMsg?.sender_id}
          refId={reportMsg?.id}
          subjectLabel="message"
        />

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
            onLeaveGroup={async () => {
              await leaveGroup(selectedConv.id);
              setSelectedConvId(null);
              setShowGroupInfo(false);
            }}
          />
        )}
      </View>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={ls.safe} edges={[]}>
      <StatusBar style="light" />
      {/* Header */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[ls.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={ls.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={ls.title}>Messages</Text>
            <Text style={ls.headerSub}>
              {unreadTotal > 0 ? `${unreadTotal} unread` : pendingReceived.length > 0 ? `${pendingReceived.length} request${pendingReceived.length > 1 ? 's' : ''}` : 'All caught up'}
            </Text>
          </View>
          <View style={ls.headerActions}>
            <TouchableOpacity style={ls.hBtn} onPress={() => setShowSearch(v => !v)} accessibilityRole="button" accessibilityLabel={showSearch ? 'Close search' : 'Search conversations'}>
              <Ionicons name={showSearch ? 'close' : 'search-outline'} size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={ls.hBtn} onPress={() => setShowGroupCreate(true)} accessibilityRole="button" accessibilityLabel="New group chat">
              <Ionicons name="create-outline" size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pill tabs */}
        <View style={ls.tabRow}>
          {LIST_TABS.map(t => {
            const badge = t.key === 'chats' ? (unreadTotal || undefined) : t.key === 'requests' ? (pendingReceived.length || undefined) : undefined;
            const active = activeTab === t.key;
            return (
              <TouchableOpacity key={t.key} style={[ls.tab, active && ls.tabActive]} onPress={() => setActiveTab(t.key)}>
                <Text style={[ls.tabTxt, active && ls.tabTxtActive]}>{t.label}</Text>
                {badge != null && badge > 0 && (
                  <View style={ls.tabBadge}><Text style={ls.tabBadgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Search bar */}
      {showSearch && (
        <View style={ls.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={ls.searchInput}
            placeholder={activeTab === 'friends' ? 'Search friends…' : 'Search chats…'}
            placeholderTextColor={Colors.textMuted}
            value={activeTab === 'friends' ? friendSearch : searchQuery}
            onChangeText={activeTab === 'friends' ? setFriendSearch : setSearchQuery}
            autoFocus
          />
          {(searchQuery.length > 0 || friendSearch.length > 0) && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setFriendSearch(''); }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading && !refreshing ? (
        <View style={ls.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Chats */}
          {activeTab === 'chats' && (
            filteredConvs.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title={searchQuery ? 'No results' : 'No chats yet'}
                sub={searchQuery ? `Nothing matching "${searchQuery}"` : 'Message a friend or create a group'}
                action={!searchQuery ? { label: 'New Group', onPress: () => setShowGroupCreate(true) } : undefined}
              />
            ) : filteredConvs.map(conv => {
              const name = getConvName(conv, user?.id || '');
              const avatarUrl = getConvAvatar(conv, user?.id || '');
              const otherId = getConvOtherId(conv, user?.id || '');
              const online = !!otherId && isOnline(otherId);
              const last = conv.lastMessage;
              const isMine = last?.sender_id === user?.id;
              const preview = last
                ? (conv.is_group && last.sender && !isMine
                    ? `${last.sender.first_name || ''}: ${last.content}`
                    : isMine ? `You: ${last.content}` : last.content)
                : 'No messages yet';
              const hasUnread = conv.unreadCount > 0;

              return (
                <TouchableOpacity key={conv.id} style={ls.convRow} onPress={() => openConv(conv.id)} activeOpacity={0.75}>
                  <View style={{ position: 'relative' }}>
                    {conv.is_group
                      ? <View style={ls.groupAvt}><Ionicons name="people" size={22} color="#fff" /></View>
                      : <Avatar name={name} size={52} imageUrl={avatarUrl} />
                    }
                    {!conv.is_group && <OnlineDot online={online} size={12} />}
                  </View>
                  <View style={ls.convBody}>
                    <View style={ls.convTop}>
                      <Text style={[ls.convName, hasUnread && ls.convNameBold]} numberOfLines={1}>{name}</Text>
                      <Text style={[ls.convTime, hasUnread && ls.convTimeUnread]}>{fmtConvTime(last?.created_at)}</Text>
                    </View>
                    <View style={ls.convBottom}>
                      <Text style={[ls.convPrev, hasUnread && ls.convPrevBold]} numberOfLines={1}>{preview}</Text>
                      {hasUnread && (
                        <View style={ls.unreadBadge}>
                          <Text style={ls.unreadTxt}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Friends */}
          {activeTab === 'friends' && (
            filteredFriends.length === 0 ? (
              <EmptyState icon="people-outline" title="No friends yet" sub="Find players in Build Your Network" />
            ) : filteredFriends.map(req => {
              const friend = req.sender_id === user?.id ? req.receiver : req.sender;
              const friendUid = req.sender_id === user?.id ? req.receiver_id : req.sender_id;
              if (!friend) return null;
              const online = isOnline(friendUid);
              return (
                <TouchableOpacity
                  key={req.id}
                  style={ls.convRow}
                  onPress={async () => {
                    try { const id = await getOrCreateDM(friendUid); setActiveTab('chats'); openConv(id); }
                    catch { Alert.alert('Error', 'Failed to open chat.'); }
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ position: 'relative' }}>
                    <Avatar name={friend.name || 'P'} size={52} imageUrl={friend.profile_picture_url} />
                    <OnlineDot online={online} size={12} />
                  </View>
                  <View style={ls.convBody}>
                    <View style={ls.convTop}>
                      <Text style={ls.convName}>{friend.name}</Text>
                      <View style={[ls.statusPill, online ? ls.statusOnline : ls.statusOffline]}>
                        <Text style={[ls.statusTxt, online ? ls.statusOnlineTxt : ls.statusOfflineTxt]}>
                          {online ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                    <Text style={ls.convPrev}>
                      {friend.usta_rating ? `USTA ${friend.usta_rating}` : friend.skill_level ? `Level ${friend.skill_level}/10` : 'Tennis player'}
                    </Text>
                  </View>
                  <TouchableOpacity style={ls.msgBtn} onPress={async () => {
                    try { const id = await getOrCreateDM(friendUid); setActiveTab('chats'); openConv(id); } catch {}
                  }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}

          {/* Requests */}
          {activeTab === 'requests' && (
            pendingReceived.length === 0 && pendingSent.length === 0 ? (
              <EmptyState icon="person-add-outline" title="No pending requests" sub="Search for players in Build Your Network" />
            ) : (
              <>
                {pendingReceived.length > 0 && (
                  <>
                    <Text style={ls.sectionLbl}>RECEIVED · {pendingReceived.length}</Text>
                    {pendingReceived.map(req => (
                      <View key={req.id} style={ls.convRow}>
                        <Avatar name={req.sender?.name || 'P'} size={52} imageUrl={req.sender?.profile_picture_url} />
                        <View style={ls.convBody}>
                          <Text style={ls.convName}>{req.sender?.name || 'Unknown'}</Text>
                          {req.sender?.skill_level != null && <Text style={ls.convPrev}>Level {req.sender.skill_level}/10</Text>}
                        </View>
                        <View style={ls.reqBtns}>
                          <TouchableOpacity style={ls.acceptBtn} onPress={() => handleRespond(req.id, 'accepted')} disabled={responding === req.id}>
                            {responding === req.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={17} color="#fff" />}
                          </TouchableOpacity>
                          <TouchableOpacity style={ls.declineBtn} onPress={() => handleRespond(req.id, 'declined')} disabled={responding === req.id}>
                            <Ionicons name="close" size={17} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}
                {pendingSent.length > 0 && (
                  <>
                    <Text style={[ls.sectionLbl, pendingReceived.length > 0 && { marginTop: 8 }]}>SENT · {pendingSent.length}</Text>
                    {pendingSent.map(req => (
                      <View key={req.id} style={ls.convRow}>
                        <Avatar name={req.receiver?.name || 'P'} size={52} imageUrl={req.receiver?.profile_picture_url} />
                        <View style={ls.convBody}>
                          <Text style={ls.convName}>{req.receiver?.name || 'Unknown'}</Text>
                          <Text style={ls.convPrev}>Waiting for response…</Text>
                        </View>
                        <TouchableOpacity style={ls.cancelBtn} onPress={() => Alert.alert('Cancel Request', 'Cancel this friend request?', [
                          { text: 'No', style: 'cancel' },
                          { text: 'Cancel Request', style: 'destructive', onPress: () => cancelRequest(req.id) },
                        ])}>
                          <Ionicons name="time-outline" size={13} color={Colors.warning} />
                          <Text style={ls.cancelBtnTxt}>Pending</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </>
            )
          )}

          {/* Blocked */}
          {activeTab === 'blocked' && (
            blockedUsers.length === 0 ? (
              <EmptyState icon="ban-outline" title="No blocked users" sub="Block a player from their profile or a conversation" />
            ) : blockedUsers.map(b => (
              <View key={b.id} style={ls.convRow}>
                <Avatar name={b.blocked_user_name || '?'} size={52} imageUrl={b.blocked_user_profile_picture} />
                <View style={ls.convBody}>
                  <Text style={ls.convName}>{b.blocked_user_name || 'Unknown user'}</Text>
                  {b.blocked_user_email && <Text style={ls.convPrev}>{b.blocked_user_email}</Text>}
                </View>
                <TouchableOpacity style={ls.unblockBtn} onPress={() => Alert.alert('Unblock', `Unblock ${b.blocked_user_name || 'this user'}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unblock', onPress: () => unblockUser(b.blocked_user_id) },
                ])}>
                  <Text style={ls.unblockTxt}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
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

      {/* Full-screen image viewer */}
      <Modal visible={!!viewerImage} transparent animationType="fade" onRequestClose={() => setViewerImage(null)}>
        <View style={iv.backdrop}>
          <TouchableOpacity style={iv.close} onPress={() => setViewerImage(null)} activeOpacity={0.8}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {viewerImage && (
            <Image source={{ uri: viewerImage }} style={iv.img} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const iv = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 60, right: 20, zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '80%' },
});

// ── Thread styles ──────────────────────────────────────────────────────────────

const th = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 4 },
  backBtn: { padding: 8, marginRight: 2 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvt: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(249,115,22,0.2)', alignItems: 'center', justifyContent: 'center' },
  nameCol: { flex: 1 },
  name: { fontSize: FontSize.md, fontFamily: Font.bold, color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8 },
  listContent: { paddingVertical: 10, paddingBottom: 12 },
  divider: { alignItems: 'center', marginVertical: 10 },
  dividerTxt: { fontSize: 11, fontFamily: Font.semibold, color: Colors.textSecondary, backgroundColor: CHAT.divBg, paddingHorizontal: 14, paddingVertical: 5, borderRadius: Radius.full, overflow: 'hidden' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.07)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full },
  emptyPillTxt: { fontSize: 12, color: CHAT.muted },
  emptyTxt: { fontSize: FontSize.sm, color: CHAT.muted },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.sm, paddingTop: 8, backgroundColor: CHAT.inputBg, gap: 8 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 4, paddingVertical: 4, minHeight: 44, ...Shadow.xs },
  emojiBtn: { padding: 8 },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text, maxHeight: 120, paddingVertical: 6, paddingHorizontal: 4, lineHeight: 20 },
  attachBtn: { padding: 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: CHAT.muted, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive: { backgroundColor: Colors.primary, ...Shadow.orange },
  sendBtnRecording: { backgroundColor: Colors.error, shadowColor: Colors.error },
  recBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight, gap: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error },
  recTimer: { fontSize: 16, fontFamily: Font.semibold, color: Colors.text, minWidth: 48 },
  recHint: { flex: 1, fontSize: 13, color: Colors.textMuted, textAlign: 'right' },
  recHintCancel: { color: Colors.error, fontFamily: Font.semibold },
  imgPreviewBar: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: CHAT.inputBg, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  imgPreviewThumb: { width: 70, height: 70, borderRadius: 10, backgroundColor: Colors.surface },
  imgRemoveBtn: { marginLeft: -10, marginTop: -6 },
});

// ── List styles ────────────────────────────────────────────────────────────────

const ls = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 8 },
  title: { fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  hBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: Radius.full, gap: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  tabActive: { backgroundColor: '#fff' },
  tabTxt: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: 'rgba(255,255,255,0.75)' },
  tabTxtActive: { color: Palette.dark900 },
  tabBadge: { backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeTxt: { color: '#fff', fontSize: 9, fontFamily: Font.bold },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 0 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  groupAvt: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  convBody: { flex: 1, minWidth: 0 },
  convTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  convName: { fontSize: FontSize.md, fontFamily: Font.medium, color: Colors.text, flex: 1, marginRight: 4 },
  convNameBold: { fontFamily: Font.bold },
  convTime: { fontSize: 11, color: Colors.textMuted },
  convTimeUnread: { color: Colors.primary, fontFamily: Font.semibold },
  convBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convPrev: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, marginRight: 4 },
  convPrevBold: { fontFamily: Font.semibold, color: Colors.text },
  unreadBadge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadTxt: { color: '#fff', fontSize: 11, fontFamily: Font.bold },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusOnline: { backgroundColor: Colors.successLight },
  statusOffline: { backgroundColor: Colors.backgroundAlt },
  statusTxt: { fontSize: 10, fontFamily: Font.semibold },
  statusOnlineTxt: { color: Colors.success },
  statusOfflineTxt: { color: Colors.textMuted },
  msgBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

  sectionLbl: { fontSize: 10, fontFamily: Font.bold, color: Colors.textMuted, letterSpacing: 0.8, paddingHorizontal: Spacing.lg, paddingVertical: 8, backgroundColor: Colors.backgroundAlt, textTransform: 'uppercase' },

  reqBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full },
  cancelBtnTxt: { fontSize: 11, color: Colors.warning, fontFamily: Font.semibold },

  unblockBtn: { backgroundColor: Colors.backgroundAlt, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full },
  unblockTxt: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.text },
});

// ── Emoji picker ───────────────────────────────────────────────────────────────

interface EmojiCat { key: string; icon: string; label: string; emojis: string[] }

const EMOJI_DATA: EmojiCat[] = [
  {
    key: 'smileys', icon: '😊', label: 'Smileys & Emotion',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝',
      '🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🥴','😑','😐','😶','😏','😒',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧',
      '🥵','🥶','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁',
      '☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭',
      '😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿',
      '💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
      '😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊',
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❣️',
      '💕','💞','💓','💗','💖','💘','💝','💟',
      '💋','💌','💤','💢','💥','✨','💫','💦','💨','💬','💭','🗯️',
    ],
  },
  {
    key: 'people', icon: '👋', label: 'People & Body',
    emojis: [
      '👋','🤚','🖐️','✋','🤙','👌','🤌','🤏','✌️','🤞','🤟','🤘',
      '👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜',
      '👏','🙌','🫶','🤲','🤝','🙏','✍️','💅','🤳',
      '💪','🦾','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄','🫂',
      '👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵',
      '🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷',
      '👮','🕵️','💂','👷','💆','💇','🚶','🧍','🧎','🏃','💃','🕺',
      '🧗','🏋️','🤸','⛹️','🏄','🚣','🧘','🛀','🛌',
      '👫','👬','👭','💑','💏','👨‍👩‍👦','👪',
      '🧙','🧛','🧟','🧞','🧜','🧚','👼','🎅','🤶','🦸','🦹',
    ],
  },
  {
    key: 'animals', icon: '🐶', label: 'Animals & Nature',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
      '🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺',
      '🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂',
      '🐢','🐍','🦎','🦖','🦕','🐊','🦭','🐳','🐋','🐬','🦈','🐙',
      '🦑','🦐','🦀','🐡','🐠','🐟','🐆','🐅','🦓','🦍','🦧','🐘',
      '🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖',
      '🐏','🐑','🦙','🐐','🦌','🐕','🦮','🐈','🦔','🐾',
      '🌸','💐','🌺','🌻','🌹','🌷','🌼','🌱','🌿','☘️','🍀','🎋',
      '🌾','🌵','🎄','🌲','🌳','🌴','🍃','🍂','🍁','🍄','🌰',
      '⭐','🌟','🌠','☀️','🌤️','⛅','🌥️','☁️','🌧️','⛈️','🌩️','🌨️',
      '❄️','☃️','⛄','🌬️','💨','💧','💦','🌊','🌈','🌀','🌫️','🌪️',
      '🌙','🌛','🌜','🌝','🌞','🪐','🔥','⚡','🌡️',
    ],
  },
  {
    key: 'food', icon: '🍔', label: 'Food & Drink',
    emojis: [
      '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒',
      '🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑',
      '🥒','🥬','🥦','🧄','🧅','🍄','🥜','🫘','🌰',
      '🍞','🥐','🥖','🫓','🥨','🥯','🧀','🍖','🍗','🥩','🥓',
      '🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍳','🥘',
      '🍲','🫕','🥣','🥗','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠',
      '🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡',
      '🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍯',
      '☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷',
      '🥃','🍸','🍹','🧉','🍾','🧊','🥛','🍼','🍽️','🍴','🥄','🔪',
    ],
  },
  {
    key: 'activity', icon: '⚽', label: 'Activities',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸',
      '🏒','🥍','🏑','🏏','⛳','🎣','🤿','🥊','🥋','🎽',
      '🛹','🛼','🛷','⛸️','🤺','🏇','⛷️','🏂','🪂',
      '🏋️','🤸','⛹️','🤾','🏌️','🏄','🚣','🧘','🤼',
      '🏆','🥇','🥈','🥉','🏅','🎖️','🎯','🎳','🎰','🎲','🧩',
      '♟️','🃏','🎴','🀄','🎭','🎨','🖼️','🎪','🎬',
      '🎤','🎧','🎼','🎵','🎶','🎷','🪗','🎸','🎹','🎺','🎻','🪕','🥁','🪘',
      '🎊','🎉','🎈','🎀','🎁','🎗️','🎟️','🎫','🎠','🎡','🎢',
    ],
  },
  {
    key: 'travel', icon: '✈️', label: 'Travel & Places',
    emojis: [
      '🌍','🌎','🌏','🗺️','🧭','🌐',
      '🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️',
      '🏟️','🏛️','🏗️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨',
      '🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','⛩️','🕋',
      '🚂','🚃','🚄','🚅','🚇','🚌','🚑','🚒','🚓','🚗','🚙','🛻',
      '🚚','🚛','🚜','🏎️','🏍️','🛵','🚲','🛴','🛹',
      '✈️','🛩️','🛫','🛬','💺','🚁','🛸','🚀','🛷',
      '⛵','🚤','🛥️','🛳️','🚢','⛽','🚦','🚧','⚓',
      '🌅','🌄','🌆','🌇','🌃','🌉','🌌','🎇','🎆',
    ],
  },
  {
    key: 'objects', icon: '💡', label: 'Objects',
    emojis: [
      '👓','🕶️','🥽','👔','👕','👖','🧣','🧤','🧥','🧦','👗','👘',
      '👙','👚','👛','👜','👝','🎒','🩴','👞','👟','🥾','👠','👡','🩰','👢',
      '👑','👒','🎩','🧢','⛑️','💄','💍','💎',
      '📱','📲','💻','🖥️','⌨️','🖱️','📷','📸','📹','📺','📻','🎧','🎙️',
      '📚','📖','📕','📗','📘','📙','📔','📃','📄','📑','📊','📈','📉',
      '✏️','🖊️','📝','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗂️',
      '🔑','🗝️','🔒','🔓','🔨','🪓','⛏️','🛠️','🔧','🪛','🔩','⚙️',
      '🧲','💡','🔦','🕯️','🧯','💰','💳','💎','🔮','🧪','🧬','🩺',
      '🪄','🎁','📦','🛒','🚪','🪞','🪟','🛋️','🪑','🚿','🛁','🧸','🪆',
    ],
  },
  {
    key: 'symbols', icon: '💟', label: 'Symbols',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
      '💓','💗','💖','💘','💝','💯','✅','☑️','✔️','❌','❎','➕','➖',
      '➗','✖️','🟰','♾️','❓','❔','❗','❕','🔥','⚡','⭐','🌟','✨','💫',
      '🎉','🎊','🎈','🎀','🏆','👑','⚜️','🔱','📛','🔰','⭕','🚫','⛔',
      '🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪',
      '🟥','🟧','🟨','🟩','🟦','🟪','🟫','⬛','⬜','◼️','◻️','◾','◽','▪️','▫️',
      '🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳',
      '♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎',
      '☮️','✝️','☪️','🕉️','✡️','☯️','♻️','🆕','🆓','🆙','🆒','🆗','🆖',
      '🅰️','🅱️','🆎','🅾️','🆑','🆘','🔞','🚳','🚭','🚯','🚱','🚷','📵',
    ],
  },
];

const EMOJI_KEYWORDS: Record<string, string[]> = {
  smile:['😀','😃','😄','😁','😊','☺️','😺'], laugh:['😆','😅','🤣','😂','😸','😹'],
  love:['❤️','🥰','😍','😘','💕','💞','💓','💖','💘','💝','😻'], heart:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝'],
  cry:['😢','😭','😿','🥺'], angry:['😡','😠','🤬','😤','😈','👿','😾'],
  happy:['😀','😃','😄','😁','😆','🥳','😊','🥰','😸'], sad:['😢','😭','😔','😞','😓','☹️','🙁','😿'],
  fire:['🔥'], star:['⭐','🌟','✨','💫','🌠'], sun:['☀️','🌞','🌅','🌄'],
  moon:['🌙','🌛','🌜','🌝'], snow:['❄️','☃️','⛄','🌨️'], rain:['🌧️','💧'],
  rainbow:['🌈'], pizza:['🍕'], burger:['🍔'], taco:['🌮'],
  coffee:['☕','🫖','🍵'], beer:['🍺','🍻'], wine:['🍷','🥂','🍾'],
  cake:['🎂','🍰','🧁'], sushi:['🍣'], ramen:['🍜'], fruit:['🍎','🍊','🍋','🍇','🍓','🍒'],
  dog:['🐶','🐕','🦮'], cat:['🐱','🐈','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  bear:['🐻','🐼','🐨'], lion:['🦁'], tiger:['🐯'], monkey:['🐵','🙈','🙉','🙊'],
  bird:['🐦','🦆','🦅','🦉','🐧'], fish:['🐟','🐠','🐡'], shark:['🦈'],
  flower:['🌸','💐','🌺','🌻','🌹','🌷','🌼'], tree:['🌲','🌳','🌴','🎄'],
  soccer:['⚽'], basketball:['🏀'], tennis:['🎾'], trophy:['🏆','🥇','🏅'],
  party:['🎉','🎊','🎈','🎀','🥳'], gift:['🎁','🎀'], music:['🎵','🎶','🎸','🎹','🎤','🎧'],
  car:['🚗','🚙','🏎️','🚕'], plane:['✈️','🛩️','🛫','🛬'], rocket:['🚀'],
  house:['🏠','🏡'], phone:['📱','☎️','📞'], computer:['💻','🖥️'],
  camera:['📷','📸','🎥'], book:['📚','📖','📕'], money:['💰','💵','💳','💸'],
  key:['🔑','🗝️'], lock:['🔒','🔓'], ok:['👌','✅','👍'], yes:['✅','👍','☑️'],
  no:['❌','👎','🚫'], clap:['👏','🙌'], pray:['🙏'], muscle:['💪'],
  eyes:['👀','👁️'], skull:['💀','☠️'], poop:['💩'], ghost:['👻'],
  alien:['👽','👾'], robot:['🤖'], clown:['🤡'], santa:['🎅'],
  kiss:['😘','💋','💏'], hug:['🤗','🫂'], think:['🤔','💭'],
  cool:['😎'], nerd:['🤓','🧐'], sick:['🤒','🤕','🤢','🤮','🤧','😷'],
  sleep:['😴','💤','🛌'], run:['🏃'], dance:['💃','🕺'],
  water:['💧','💦','🌊','🏊'], earth:['🌍','🌎','🌏'],
  check:['✅','✔️','☑️'], cross:['❌'], question:['❓'], warning:['⚠️'],
  thumbup:['👍'], thumbdown:['👎'], wave:['👋','🌊'],
};

const ALL_EMOJIS = EMOJI_DATA.flatMap(c => c.emojis);

function searchEmojis(q: string): string[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return [];
  const results = new Set<string>();
  Object.entries(EMOJI_KEYWORDS).forEach(([kw, emojis]) => {
    if (kw.includes(lower)) emojis.forEach(e => results.add(e));
  });
  // also surface emojis whose category label matches
  EMOJI_DATA.forEach(cat => {
    if (cat.label.toLowerCase().includes(lower)) cat.emojis.forEach(e => results.add(e));
  });
  return [...results];
}

const PAGES = [
  { key: 'recents', icon: '🕐', label: 'Recently Used', emojis: [] as string[] },
  ...EMOJI_DATA,
];

const EmojiPanel: React.FC<{ onSelect: (e: string) => void }> = ({ onSelect }) => {
  const { width: screenWidth } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const [activePage, setActivePage] = useState(0);
  const pagerRef = useRef<FlatList>(null);
  const tabStripRef = useRef<ScrollView>(null);

  const handleSelect = (e: string) => {
    onSelect(e);
    setRecents(prev => [e, ...prev.filter(r => r !== e)].slice(0, 32));
  };

  const goToPage = (idx: number) => {
    setSearch('');
    setActivePage(idx);
    pagerRef.current?.scrollToIndex({ index: idx, animated: true });
    // keep active tab visible in the strip
    tabStripRef.current?.scrollTo({ x: Math.max(0, idx * 44 - screenWidth / 2 + 22), animated: true });
  };

  const onPageChange = (e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setActivePage(page);
    tabStripRef.current?.scrollTo({ x: Math.max(0, page * 44 - screenWidth / 2 + 22), animated: true });
  };

  const searchResults = search.trim() ? searchEmojis(search) : null;

  const renderGrid = (emojis: string[], emptyMsg: string) => (
    emojis.length > 0 ? (
      <View style={ep.grid}>
        {emojis.map(e => (
          <TouchableOpacity key={e} style={ep.cell} onPress={() => handleSelect(e)} activeOpacity={0.6}>
            <Text style={ep.emojiTxt}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ) : (
      <Text style={ep.noResults}>{emptyMsg}</Text>
    )
  );

  const renderPage = ({ item, index }: { item: typeof PAGES[0]; index: number }) => {
    const emojis = index === 0 ? recents : item.emojis;
    const emptyMsg = index === 0 ? 'Tap any emoji to save it here' : 'No emojis';
    return (
      <ScrollView
        style={{ width: screenWidth }}
        contentContainerStyle={ep.pageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        <Text style={ep.sectionLabel}>{item.label}</Text>
        {renderGrid(emojis, emptyMsg)}
      </ScrollView>
    );
  };

  return (
    <View style={ep.container}>
      {/* Search bar */}
      <View style={ep.searchRow}>
        <Ionicons name="search-outline" size={15} color={Colors.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={ep.searchInput}
          placeholder="Search emoji…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category tab strip */}
      <ScrollView
        ref={tabStripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ep.tabBar}
        contentContainerStyle={ep.tabContent}
      >
        {PAGES.map((p, i) => (
          <TouchableOpacity
            key={p.key}
            style={[ep.tab, activePage === i && ep.tabActive]}
            onPress={() => goToPage(i)}
          >
            <Text style={ep.tabIcon}>{p.icon}</Text>
            {activePage === i && <View style={ep.tabDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search results overlay */}
      {searchResults !== null ? (
        <ScrollView
          style={ep.searchPage}
          contentContainerStyle={ep.pageContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {renderGrid(
            searchResults,
            `No results for "${search}" — try heart, smile, dog, pizza…`,
          )}
        </ScrollView>
      ) : (
        /* Horizontal pager */
        <FlatList
          ref={pagerRef}
          data={PAGES}
          renderItem={renderPage}
          keyExtractor={item => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          onMomentumScrollEnd={onPageChange}
          initialNumToRender={2}
          windowSize={3}
          keyboardShouldPersistTaps="always"
          style={ep.pager}
        />
      )}
    </View>
  );
};

const ep = StyleSheet.create({
  container:   { height: 330, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight },
  searchRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 6, backgroundColor: Colors.backgroundAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, padding: 0 },
  tabBar:      { maxHeight: 42, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  tabContent:  { paddingHorizontal: 4, alignItems: 'center' },
  tab:         { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  tabActive:   {},
  tabIcon:     { fontSize: 22 },
  tabDot:      { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary },
  pager:       { flex: 1 },
  searchPage:  { flex: 1 },
  pageContent: { paddingHorizontal: 4, paddingBottom: 12 },
  sectionLabel:{ fontSize: 11, fontFamily: Font.bold, color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emojiTxt:    { fontSize: 26 },
  noResults:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 16 },
});
