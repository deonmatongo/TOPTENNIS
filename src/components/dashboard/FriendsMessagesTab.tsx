import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Users, MessageCircle, Send, Search, Check, X, Clock,
  Plus, AlertCircle, ChevronLeft, Settings, UserMinus,
  Trash2, Pencil, UserCheck, Pin, PinOff, BellOff,
  MoreHorizontal, LogOut, Hash, AtSign, ChevronDown,
  ChevronUp, Reply, Smile, UserX, Shield,
} from 'lucide-react';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations, type Conversation, type ConversationMessage } from '@/hooks/useConversations';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import PlayerSearch from './PlayerSearch';
import { SearchResult } from '@/hooks/usePlayerSearch';
import PlayerProfileModal from './PlayerProfileModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎾', '🔥', '👏', '😮', '😢'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

function formatDivider(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
}

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

// ── Online dot ────────────────────────────────────────────────────────────────

const OnlineDot = ({ online }: { online: boolean }) => (
  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${online ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
);

// ── Typing indicator ──────────────────────────────────────────────────────────

const TypingIndicator = ({ names }: { names: string[] }) => {
  if (names.length === 0) return null;
  const label = names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(', ')} are typing`;
  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
      <span>{label}…</span>
    </div>
  );
};

// ── Group create dialog ───────────────────────────────────────────────────────

interface GroupCreateDialogProps {
  open: boolean;
  onClose: () => void;
  friends: { userId: string; name: string; avatar?: string }[];
  onSubmit: (name: string, memberIds: string[]) => Promise<void>;
}

const GroupCreateDialog: React.FC<GroupCreateDialogProps> = ({ open, onClose, friends, onSubmit }) => {
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
      setName('');
      setSelected(new Set());
      onClose();
    } catch {
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Group name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tennis Squad" />
          </div>
          <div className="space-y-1">
            <Label>Add members</Label>
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-1">
                {friends.map(f => (
                  <div
                    key={f.userId}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selected.has(f.userId) ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'}`}
                    onClick={() => toggle(f.userId)}
                  >
                    <Avatar className="h-7 w-7">
                      {f.avatar && <AvatarImage src={f.avatar} />}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{f.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">{f.name}</span>
                    {selected.has(f.userId) && <Check className="w-4 h-4 text-primary" />}
                  </div>
                ))}
                {friends.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Add friends first to create a group</p>}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || selected.size === 0 || creating}>
            {creating ? 'Creating...' : `Create (${selected.size} members)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Group Info Sheet ──────────────────────────────────────────────────────────

interface GroupInfoSheetProps {
  open: boolean;
  onClose: () => void;
  conv: Conversation;
  currentUserId: string;
  isAdmin: boolean;
  friends: { userId: string; name: string; avatar?: string }[];
  onRemoveMember: (uid: string) => Promise<void>;
  onAddMember: (uid: string) => Promise<void>;
  onRenameGroup: (name: string) => Promise<void>;
  onViewProfile: (profile: NonNullable<Conversation['members'][0]['profile']>, uid: string) => void;
}

const GroupInfoSheet: React.FC<GroupInfoSheetProps> = ({
  open, onClose, conv, currentUserId, isAdmin, friends,
  onRemoveMember, onAddMember, onRenameGroup, onViewProfile,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(conv.name || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const existingIds = new Set(conv.members.map(m => m.user_id));
  const addableFriends = friends.filter(f => !existingIds.has(f.userId));

  const getMemberName = (m: Conversation['members'][0]) => {
    if (!m.profile) return 'Unknown';
    return `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email;
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      await onRenameGroup(newName.trim());
      setRenaming(false);
      toast.success('Group renamed');
    } catch {
      toast.error('Failed to rename group');
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Group Info
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Group name */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Group Name</p>
              {renaming ? (
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                    maxLength={50}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
                  />
                  <Button size="sm" onClick={handleRename}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRenaming(false); setNewName(conv.name || ''); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <span className="flex-1 text-sm font-medium">{conv.name || 'Group Chat'}</span>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setRenaming(true)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Members ({conv.members.length})
              </p>
              <div className="space-y-1">
                {conv.members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => m.profile && onViewProfile(m.profile, m.user_id)}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        {m.profile?.profile_picture_url && <AvatarImage src={m.profile.profile_picture_url} />}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getMemberName(m).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {getMemberName(m)}{m.user_id === currentUserId ? ' (you)' : ''}
                        </p>
                        {m.role === 'admin' && (
                          <p className="text-xs text-primary font-medium">Admin</p>
                        )}
                      </div>
                    </button>
                    {isAdmin && m.user_id !== currentUserId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        disabled={busy === m.user_id}
                        onClick={async () => {
                          setBusy(m.user_id);
                          try { await onRemoveMember(m.user_id); toast.success('Member removed'); }
                          catch { toast.error('Failed to remove member'); }
                          finally { setBusy(null); }
                        }}
                        title="Remove member"
                      >
                        {busy === m.user_id
                          ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <UserMinus className="w-3.5 h-3.5" />
                        }
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add members (admin only) */}
            {isAdmin && addableFriends.length > 0 && (
              <div className="space-y-2">
                <button
                  className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-primary transition-colors"
                  onClick={() => setShowAddMembers(v => !v)}
                >
                  <UserCheck className="w-4 h-4" />
                  Add Members
                  <span className="ml-auto">{showAddMembers ? '▲' : '▼'}</span>
                </button>
                {showAddMembers && (
                  <div className="space-y-1">
                    {addableFriends.map(f => (
                      <div key={f.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <Avatar className="h-8 w-8 shrink-0">
                          {f.avatar && <AvatarImage src={f.avatar} />}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{f.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm">{f.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          disabled={busy === f.userId}
                          onClick={async () => {
                            setBusy(f.userId);
                            try { await onAddMember(f.userId); toast.success(`${f.name} added`); }
                            catch { toast.error('Failed to add member'); }
                            finally { setBusy(null); }
                          }}
                        >
                          {busy === f.userId
                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <><Plus className="w-3 h-3 mr-1" />Add</>
                          }
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const FriendsMessagesTab = () => {
  const [activeView, setActiveView] = useState<'conversations' | 'friends' | 'requests'>('conversations');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState<any | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<ConversationMessage | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const { requests, loading: friendsLoading, updateRequestStatus, revokeFriendRequest, getPendingRequestsCount } = useFriendRequests();
  const { blockedUsers, blockUser, unfriendUser } = useBlockedUsers();
  const {
    conversations, loading: convLoading,
    sendMessage, getOrCreateDM, createGroupChat,
    addMember, removeMember, deleteMessage, toggleReaction,
    leaveGroup, deleteGroup, togglePin,
    updateGroup, markConversationRead, getTotalUnread, getMyRole,
  } = useConversations();
  const { invites } = useMatchInvites();
  const { isOnline } = useOnlinePresence();
  const { typingUsers, broadcastTyping } = useTypingIndicator(selectedConvId);

  const blockedIds = useMemo(() => new Set(blockedUsers.map(b => b.blocked_user_id)), [blockedUsers]);
  const pendingRequests = requests.filter(r => r.status === 'pending' && r.receiver_id === user?.id);
  const sentRequests    = requests.filter(r => r.status === 'pending' && r.sender_id === user?.id);
  const friends         = requests.filter(r => r.status === 'accepted');

  const visibleConversations = useMemo(() => conversations.filter(conv => {
    if (conv.is_group) return true;
    const other = conv.members.find(m => m.user_id !== user?.id);
    return other ? !blockedIds.has(other.user_id) : true;
  }), [conversations, user, blockedIds]);

  const dmConvs    = visibleConversations.filter(c => !c.is_group);
  const groupConvs = visibleConversations.filter(c => c.is_group);

  const filteredDMs     = dmConvs.filter(c => getConvName(c, user?.id || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredGroups  = groupConvs.filter(c => getConvName(c, user?.id || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFriends = friends.filter(f => {
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    const sl = searchTerm.toLowerCase();
    return fd?.name?.toLowerCase().includes(sl) || fd?.email?.toLowerCase().includes(sl);
  });

  const onlineFriends  = filteredFriends.filter(f => { const uid = f.sender_id === user?.id ? f.receiver_id : f.sender_id; return isOnline(uid); });
  const offlineFriends = filteredFriends.filter(f => { const uid = f.sender_id === user?.id ? f.receiver_id : f.sender_id; return !isOnline(uid); });

  const selectedConv = visibleConversations.find(c => c.id === selectedConvId) ?? null;
  const convName   = selectedConv ? getConvName(selectedConv, user?.id || '') : '';
  const convAvatar = selectedConv ? getConvAvatar(selectedConv, user?.id || '') : undefined;
  const myRole     = selectedConv ? getMyRole(selectedConv) : null;
  const dmOtherId  = selectedConv && !selectedConv.is_group ? selectedConv.members.find(m => m.user_id !== user?.id)?.user_id : undefined;

  // Scroll to bottom when messages arrive, only if already at bottom
  useEffect(() => {
    if (atBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages.length, atBottom]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (selectedConvId) { markConversationRead(selectedConvId); setAtBottom(true); }
  }, [selectedConvId, markConversationRead]);

  // Focus input when conversation opens
  useEffect(() => {
    if (selectedConvId) inputRef.current?.focus();
  }, [selectedConvId]);

  const handleConvSelect = (id: string) => { setSelectedConvId(id); setMsgInput(''); setReplyToMsg(null); };

  const handleSend = async () => {
    if (!selectedConvId || !msgInput.trim()) return;
    setSending(true);
    const content = msgInput;
    const replyId = replyToMsg?.id;
    setMsgInput('');
    setReplyToMsg(null);
    try {
      await sendMessage(selectedConvId, content, replyId);
    } catch {
      toast.error('Failed to send message');
      setMsgInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleStartDM = async (otherUserId: string, friendName?: string) => {
    try {
      const convId = await getOrCreateDM(otherUserId);
      setActiveView('conversations');
      setSelectedConvId(convId);
      if (friendName) toast.success(`Opened chat with ${friendName}`);
    } catch {
      toast.error('Failed to open conversation');
    }
  };

  const handleRequestResponse = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      const req = requests.find(r => r.id === requestId);
      await updateRequestStatus(requestId, status);
      if (status === 'accepted' && req) {
        const friendId = req.sender_id === user?.id ? req.receiver_id : req.sender_id;
        const friendName = req.sender_id === user?.id ? req.receiver?.name : req.sender?.name;
        toast.success(`You're now friends with ${friendName || 'them'}! Say hello 👋`);
        // Auto-open DM
        const convId = await getOrCreateDM(friendId);
        setActiveView('conversations');
        setSelectedConvId(convId);
      } else {
        toast.success('Friend request declined.');
      }
    } catch {
      toast.error('Failed to update friend request');
    }
  };

  const handleRevokeRequest = async (requestId: string) => {
    try { await revokeFriendRequest(requestId); toast.success('Request revoked.'); }
    catch { toast.error('Failed to revoke request'); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try { await deleteMessage(msgId); }
    catch { toast.error('Failed to delete message'); }
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    setEmojiPickerMsgId(null);
    try { await toggleReaction(msgId, emoji); }
    catch { toast.error('Failed to add reaction'); }
  };

  const handleLeaveGroup = async () => {
    if (!selectedConvId) return;
    try {
      await leaveGroup(selectedConvId);
      setSelectedConvId(null);
      toast.success('Left the group.');
    } catch { toast.error('Failed to leave group'); }
  };

  const handleDeleteGroup = async () => {
    if (!selectedConvId) return;
    try {
      await deleteGroup(selectedConvId);
      setSelectedConvId(null);
      toast.success('Group deleted.');
    } catch { toast.error('Failed to delete group'); }
  };

  const buildProfilePlayer = (profile: NonNullable<Conversation['members'][0]['profile']>, userId: string) => ({
    id: userId, user_id: userId,
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
    email: profile.email, skill_level: 0, wins: 0, losses: 0,
  });

  const friendsList = friends.map(f => {
    const friendUserId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    return { userId: friendUserId, name: fd?.name || 'Unknown', avatar: fd?.profile_picture_url };
  });

  // Build grouped message list with date dividers
  const buildMessageGroups = (messages: ConversationMessage[]) => {
    const visibleMsgs = messages.filter(m => !m.deleted_at || m.is_system);
    const result: Array<{ type: 'divider'; label: string } | { type: 'msg'; msg: ConversationMessage; showAvatar: boolean }> = [];
    let lastDate: Date | null = null;
    let lastSenderId: string | null = null;

    visibleMsgs.forEach((msg, i) => {
      const d = new Date(msg.created_at);
      if (!lastDate || !isSameDay(d, lastDate)) {
        result.push({ type: 'divider', label: formatDivider(msg.created_at) });
        lastDate = d;
        lastSenderId = null;
      }
      // Show avatar if first in cluster (different sender or after divider)
      const showAvatar = msg.sender_id !== lastSenderId;
      result.push({ type: 'msg', msg, showAvatar });
      lastSenderId = msg.sender_id;
    });
    return result;
  };

  const isLoading = friendsLoading || convLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  // ── Sidebar conversation row ────────────────────────────────────────────────
  const ConvRow = ({ conv }: { conv: Conversation }) => {
    const name   = getConvName(conv, user?.id || '');
    const avatar = getConvAvatar(conv, user?.id || '');
    const isActive = selectedConvId === conv.id;
    const otherId = !conv.is_group ? conv.members.find(m => m.user_id !== user?.id)?.user_id : undefined;
    const online  = otherId ? isOnline(otherId) : false;
    const lastMsg = conv.lastMessage;

    return (
      <div
        className={`group relative flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors
          ${isActive ? 'bg-orange-50 border-l-[3px] border-primary' : 'hover:bg-muted/60 border-l-[3px] border-transparent'}`}
        onClick={() => handleConvSelect(conv.id)}
      >
        {/* Pin indicator */}
        {conv.isPinned && <Pin className="absolute right-2 top-2 w-3 h-3 text-muted-foreground/50" />}

        <div className="relative shrink-0">
          {conv.is_group ? (
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Hash className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <Avatar className="h-8 w-8">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          {!conv.is_group && <OnlineDot online={online} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
              {conv.is_group ? `# ${name}` : name}
            </span>
            {lastMsg && <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{formatTime(lastMsg.created_at)}</span>}
          </div>
          {lastMsg && (
            <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-foreground/70 font-medium' : 'text-muted-foreground'}`}>
              {lastMsg.sender_id === user?.id ? 'You: ' : ''}{lastMsg.deleted_at ? 'Message deleted' : lastMsg.content}
            </p>
          )}
        </div>

        {conv.unreadCount > 0 && (
          <span className="shrink-0 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
          </span>
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity shrink-0">
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={e => { e.stopPropagation(); togglePin(conv.id, !conv.isPinned); }}>
              {conv.isPinned ? <><PinOff className="w-3.5 h-3.5 mr-2" />Unpin</> : <><Pin className="w-3.5 h-3.5 mr-2" />Pin</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={e => { e.stopPropagation(); markConversationRead(conv.id); }}>
              <Check className="w-3.5 h-3.5 mr-2" />Mark as read
            </DropdownMenuItem>
            {!conv.is_group && otherId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={e => { e.stopPropagation(); const m = conv.members.find(m => m.user_id === otherId); if (m?.profile) setProfilePlayer(buildProfilePlayer(m.profile, otherId)); }}>
                  <AtSign className="w-3.5 h-3.5 mr-2" />View Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); blockUser(otherId, ''); toast.success('User blocked.'); }}>
                  <UserX className="w-3.5 h-3.5 mr-2" />Block user
                </DropdownMenuItem>
              </>
            )}
            {conv.is_group && (
              <>
                <DropdownMenuSeparator />
                {myRole === 'admin' ? (
                  <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleDeleteGroup(); }}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" />Delete group
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleLeaveGroup(); }}>
                    <LogOut className="w-3.5 h-3.5 mr-2" />Leave group
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* ── Top header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold leading-tight">Network & Messages</h2>
            <p className="text-xs text-muted-foreground">{friends.length} friends · {getTotalUnread()} unread</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowGroupCreate(true)}>
            <Hash className="w-3.5 h-3.5 mr-1" />New Group
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowPlayerSearch(v => !v)}>
            <Search className="w-3.5 h-3.5 mr-1" />{showPlayerSearch ? 'Close' : 'Find Players'}
          </Button>
        </div>
      </div>

      {/* Find Players bar */}
      {showPlayerSearch && (
        <div className="px-4 py-3 border-b bg-card/50">
          <PlayerSearch
            onPlayerSelect={async (player: SearchResult) => {
              setShowPlayerSearch(false);
              if (player.user_id) await handleStartDM(player.user_id);
            }}
            placeholder="Search players by name or skill level…"
          />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ── SIDEBAR ── */}
        <div className={`w-full lg:w-72 border-r bg-card flex flex-col ${selectedConvId ? 'hidden lg:flex' : 'flex'}`}>
          {/* Tab bar */}
          <div className="px-3 pt-3 pb-2 border-b shrink-0">
            <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="conversations" className="text-xs h-7 relative">
                  Chat
                  {getTotalUnread() > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {getTotalUnread() > 9 ? '9+' : getTotalUnread()}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="friends" className="text-xs h-7">
                  Friends {friends.length > 0 && <span className="ml-1 text-muted-foreground">({friends.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="requests" className="text-xs h-7 relative">
                  Requests
                  {getPendingRequestsCount() > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {getPendingRequestsCount()}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search */}
          <div className="px-3 py-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs bg-muted/50 border-0"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="pb-4">

              {/* ── CHAT TAB ── */}
              {activeView === 'conversations' && (
                <div className="px-2">
                  {filteredDMs.length === 0 && filteredGroups.length === 0 ? (
                    <div className="text-center py-10">
                      <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No conversations yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Find players above to start chatting</p>
                    </div>
                  ) : (
                    <>
                      {filteredDMs.length > 0 && (
                        <div className="mt-2">
                          <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</p>
                          {filteredDMs.map(c => <ConvRow key={c.id} conv={c} />)}
                        </div>
                      )}
                      {filteredGroups.length > 0 && (
                        <div className="mt-3">
                          <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Groups</p>
                          {filteredGroups.map(c => <ConvRow key={c.id} conv={c} />)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── FRIENDS TAB ── */}
              {activeView === 'friends' && (
                <div className="px-2 mt-2">
                  {filteredFriends.length === 0 ? (
                    <div className="text-center py-10">
                      <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{friends.length === 0 ? 'No friends yet' : 'No matches'}</p>
                    </div>
                  ) : (
                    <>
                      {onlineFriends.length > 0 && (
                        <>
                          <p className="px-2 py-1 text-[10px] font-semibold text-green-600 uppercase tracking-wider">Online — {onlineFriends.length}</p>
                          {onlineFriends.map(friend => {
                            const friendUserId = friend.sender_id === user?.id ? friend.receiver_id : friend.sender_id;
                            const fd = friend.sender_id === user?.id ? friend.receiver : friend.sender;
                            if (blockedIds.has(friendUserId)) return null;
                            return (
                              <div key={friend.id} className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/60 group">
                                <div className="relative shrink-0">
                                  <button className="rounded-full focus:outline-none" onClick={() => { if (fd) setProfilePlayer({ id: friendUserId, user_id: friendUserId, name: fd.name || 'Unknown', email: fd.email || '', skill_level: 0, wins: 0, losses: 0 }); }}>
                                    <Avatar className="h-8 w-8">
                                      {fd?.profile_picture_url && <AvatarImage src={fd.profile_picture_url} alt={fd.name} />}
                                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{fd?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                                    </Avatar>
                                  </button>
                                  <OnlineDot online={true} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{fd?.name || 'Unknown'}</p>
                                  <p className="text-xs text-green-600">Online</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleStartDM(friendUserId, fd?.name)}>
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem onClick={() => { if (fd) setProfilePlayer({ id: friendUserId, user_id: friendUserId, name: fd.name || 'Unknown', email: fd.email || '', skill_level: 0, wins: 0, losses: 0 }); }}>
                                        <AtSign className="w-3.5 h-3.5 mr-2" />View Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive" onClick={() => { unfriendUser(friendUserId); toast.success('Removed friend.'); }}>
                                        <UserMinus className="w-3.5 h-3.5 mr-2" />Unfriend
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => { blockUser(friendUserId, ''); toast.success('User blocked.'); }}>
                                        <Shield className="w-3.5 h-3.5 mr-2" />Block
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                      {offlineFriends.length > 0 && (
                        <>
                          <p className="px-2 py-1 mt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Offline — {offlineFriends.length}</p>
                          {offlineFriends.map(friend => {
                            const friendUserId = friend.sender_id === user?.id ? friend.receiver_id : friend.sender_id;
                            const fd = friend.sender_id === user?.id ? friend.receiver : friend.sender;
                            if (blockedIds.has(friendUserId)) return null;
                            return (
                              <div key={friend.id} className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/60 group opacity-70 hover:opacity-100 transition-opacity">
                                <div className="relative shrink-0">
                                  <button className="rounded-full focus:outline-none" onClick={() => { if (fd) setProfilePlayer({ id: friendUserId, user_id: friendUserId, name: fd.name || 'Unknown', email: fd.email || '', skill_level: 0, wins: 0, losses: 0 }); }}>
                                    <Avatar className="h-8 w-8">
                                      {fd?.profile_picture_url && <AvatarImage src={fd.profile_picture_url} alt={fd.name} />}
                                      <AvatarFallback className="text-xs bg-muted text-muted-foreground font-semibold">{fd?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                                    </Avatar>
                                  </button>
                                  <OnlineDot online={false} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{fd?.name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">Offline</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleStartDM(friendUserId, fd?.name)}>
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem onClick={() => { if (fd) setProfilePlayer({ id: friendUserId, user_id: friendUserId, name: fd.name || 'Unknown', email: fd.email || '', skill_level: 0, wins: 0, losses: 0 }); }}>
                                        <AtSign className="w-3.5 h-3.5 mr-2" />View Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive" onClick={() => { unfriendUser(friendUserId); toast.success('Removed friend.'); }}>
                                        <UserMinus className="w-3.5 h-3.5 mr-2" />Unfriend
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => { blockUser(friendUserId, ''); toast.success('User blocked.'); }}>
                                        <Shield className="w-3.5 h-3.5 mr-2" />Block
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── REQUESTS TAB ── */}
              {activeView === 'requests' && (
                <div className="px-3 mt-2 space-y-4">
                  {pendingRequests.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Incoming</p>
                      <div className="space-y-2">
                        {pendingRequests.map(req => (
                          <div key={req.id} className="p-3 rounded-lg border bg-card">
                            <div className="flex items-center gap-2 mb-2">
                              <Avatar className="h-8 w-8">
                                {req.sender?.profile_picture_url && <AvatarImage src={req.sender.profile_picture_url} />}
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">{req.sender?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{req.sender?.name}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleRequestResponse(req.id, 'accepted')}>
                                <Check className="w-3 h-3 mr-1" />Accept
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => handleRequestResponse(req.id, 'declined')}>
                                <X className="w-3 h-3 mr-1" />Decline
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {sentRequests.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sent</p>
                      <div className="space-y-2">
                        {sentRequests.map(req => (
                          <div key={req.id} className="p-3 rounded-lg border bg-card flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {req.receiver?.profile_picture_url && <AvatarImage src={req.receiver.profile_picture_url} />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">{req.receiver?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{req.receiver?.name}</p>
                              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleRevokeRequest(req.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pendingRequests.length === 0 && sentRequests.length === 0 && (
                    <div className="text-center py-10">
                      <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No friend requests</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── THREAD PANEL ── */}
        <div className={`flex-1 flex flex-col bg-background ${selectedConvId ? 'flex' : 'hidden lg:flex'}`}>
          {selectedConv ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSelectedConvId(null)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <button
                  className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                  onClick={() => {
                    if (selectedConv.is_group) setShowGroupInfo(true);
                    else {
                      const other = selectedConv.members.find(m => m.user_id !== user?.id);
                      if (other?.profile) setProfilePlayer(buildProfilePlayer(other.profile, other.user_id));
                    }
                  }}
                >
                  <div className="relative shrink-0">
                    {selectedConv.is_group ? (
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-primary" />
                      </div>
                    ) : (
                      <Avatar className="h-9 w-9">
                        {convAvatar && <AvatarImage src={convAvatar} alt={convName} />}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{convName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )}
                    {!selectedConv.is_group && dmOtherId && <OnlineDot online={isOnline(dmOtherId)} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{selectedConv.is_group ? `# ${convName}` : convName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedConv.is_group
                        ? `${selectedConv.members.length} members`
                        : dmOtherId && isOnline(dmOtherId) ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </button>

                {/* Match invite badge */}
                {!selectedConv.is_group && dmOtherId && (() => {
                  const inv = invites.find(i => i.status === 'pending' && ((i.sender_id === user?.id && i.receiver_id === dmOtherId) || (i.sender_id === dmOtherId && i.receiver_id === user?.id)));
                  if (!inv) return null;
                  return <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 shrink-0">{inv.sender_id === user?.id ? '⏳ Invite pending' : '📬 Invite received'}</Badge>;
                })()}

                {selectedConv.is_group && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowGroupInfo(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto"
                ref={scrollAreaRef}
                onScroll={e => {
                  const el = e.currentTarget;
                  setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
                }}
              >
                <div className="px-4 py-4 space-y-0.5">
                  {buildMessageGroups(selectedConv.messages).map((item, i) => {
                    if (item.type === 'divider') {
                      return (
                        <div key={`div-${i}`} className="flex items-center gap-3 py-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground font-medium px-2">{item.label}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      );
                    }

                    const { msg, showAvatar } = item;
                    const isOwn    = msg.sender_id === user?.id;
                    const isSystem = msg.is_system;
                    const senderName = msg.sender
                      ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email
                      : 'Unknown';
                    const canDelete = isOwn || myRole === 'admin';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center py-1.5">
                          <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">{msg.content}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-0.5'} group relative`}
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => { setHoveredMsgId(null); if (emojiPickerMsgId === msg.id) setEmojiPickerMsgId(null); }}
                      >
                        {/* Left avatar (only for others, only when first in cluster) */}
                        {!isOwn && (
                          <div className="w-9 shrink-0 mr-2">
                            {showAvatar && (
                              <button className="rounded-full focus:outline-none" onClick={() => { const m = selectedConv.members.find(m => m.user_id === msg.sender_id); if (m?.profile) setProfilePlayer(buildProfilePlayer(m.profile, m.user_id)); }}>
                                <Avatar className="h-8 w-8">
                                  {msg.sender?.profile_picture_url && <AvatarImage src={msg.sender.profile_picture_url} />}
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              </button>
                            )}
                          </div>
                        )}

                        <div className={`max-w-[72%] ${isOwn ? 'mr-2' : ''}`}>
                          {/* Sender name (group, first in cluster, not own) */}
                          {!isOwn && selectedConv.is_group && showAvatar && (
                            <button className="text-xs font-semibold text-primary mb-0.5 ml-0.5 hover:underline" onClick={() => { const m = selectedConv.members.find(m => m.user_id === msg.sender_id); if (m?.profile) setProfilePlayer(buildProfilePlayer(m.profile, m.user_id)); }}>
                              {senderName}
                            </button>
                          )}

                          {/* Reply preview */}
                          {msg.replyTo && (
                            <div className={`text-xs border-l-2 border-primary/40 pl-2 mb-1 text-muted-foreground truncate ${isOwn ? 'text-right' : ''}`}>
                              <span className="font-medium">{msg.replyTo.sender?.first_name || 'Someone'}: </span>
                              {msg.replyTo.content}
                            </div>
                          )}

                          <div className="relative flex items-end gap-1">
                            {/* Hover action bar (own side) */}
                            {isOwn && hoveredMsgId === msg.id && (
                              <div className="flex items-center gap-1 mb-1">
                                <button className="p-1 rounded bg-background border shadow-sm hover:bg-muted transition-colors" onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)} title="React">
                                  <Smile className="w-3 h-3 text-muted-foreground" />
                                </button>
                                <button className="p-1 rounded bg-background border shadow-sm hover:bg-muted transition-colors" onClick={() => { setReplyToMsg(msg); inputRef.current?.focus(); }} title="Reply">
                                  <Reply className="w-3 h-3 text-muted-foreground" />
                                </button>
                                {canDelete && (
                                  <button className="p-1 rounded bg-background border shadow-sm hover:bg-destructive hover:text-white transition-colors" onClick={() => handleDeleteMessage(msg.id)} title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Bubble */}
                            <div className={`relative px-3.5 py-2 text-sm whitespace-pre-wrap break-words
                              ${isOwn
                                ? 'bg-[#111827] text-white rounded-[18px_18px_4px_18px]'
                                : 'bg-white border border-border text-foreground rounded-[18px_18px_18px_4px]'}
                            `}>
                              {msg.content}
                              <span className={`block text-[10px] mt-1 ${isOwn ? 'text-white/50 text-right' : 'text-muted-foreground/70'}`}>
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </span>
                            </div>

                            {/* Hover action bar (their side) */}
                            {!isOwn && hoveredMsgId === msg.id && (
                              <div className="flex items-center gap-1 mb-1">
                                <button className="p-1 rounded bg-background border shadow-sm hover:bg-muted transition-colors" onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)} title="React">
                                  <Smile className="w-3 h-3 text-muted-foreground" />
                                </button>
                                <button className="p-1 rounded bg-background border shadow-sm hover:bg-muted transition-colors" onClick={() => { setReplyToMsg(msg); inputRef.current?.focus(); }} title="Reply">
                                  <Reply className="w-3 h-3 text-muted-foreground" />
                                </button>
                                {canDelete && (
                                  <button className="p-1 rounded bg-background border shadow-sm hover:bg-destructive hover:text-white transition-colors" onClick={() => handleDeleteMessage(msg.id)} title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Emoji picker */}
                          {emojiPickerMsgId === msg.id && (
                            <div className={`flex gap-1 mt-1 p-1.5 bg-background border rounded-xl shadow-lg ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              {QUICK_EMOJIS.map(e => (
                                <button key={e} className="text-lg hover:scale-125 transition-transform" onClick={() => handleToggleReaction(msg.id, e)}>{e}</button>
                              ))}
                            </div>
                          )}

                          {/* Reactions */}
                          {(msg.reactions?.length ?? 0) > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              {msg.reactions!.map(r => (
                                <button
                                  key={r.emoji}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${r.reactedByMe ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/50 border-border hover:bg-muted'}`}
                                  onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="font-medium">{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Typing indicator */}
              <TypingIndicator names={typingUsers.map(t => t.displayName)} />

              {/* Scroll-to-bottom pill */}
              {!atBottom && (
                <div className="flex justify-center pb-1">
                  <button
                    className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs rounded-full shadow-md hover:bg-primary/90 transition-colors"
                    onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setAtBottom(true); }}
                  >
                    <ChevronDown className="w-3 h-3" />New messages
                  </button>
                </div>
              )}

              {/* Reply preview bar */}
              {replyToMsg && (
                <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
                  <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary">Replying to </span>
                    <span className="text-xs text-muted-foreground truncate">{replyToMsg.content}</span>
                  </div>
                  <button className="p-1 rounded hover:bg-muted transition-colors" onClick={() => setReplyToMsg(null)}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Composer */}
              <div className="px-4 py-3 border-t bg-background/95 backdrop-blur shrink-0">
                {/* Char count warning */}
                {msgInput.length > 500 && (
                  <p className={`text-xs mb-1 text-right ${msgInput.length > 900 ? 'text-destructive font-semibold' : 'text-orange-500'}`}>
                    {msgInput.length}/1000
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={inputRef}
                    value={msgInput}
                    onChange={e => {
                      const v = e.target.value;
                      if (v.length > 1000) return;
                      setMsgInput(v);
                      if (v.trim()) broadcastTyping(`${user?.email?.split('@')[0] || 'Someone'}`);
                    }}
                    placeholder={`Message ${selectedConv.is_group ? `# ${convName}` : convName}…`}
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-32 resize-none bg-muted/50 border-border focus-visible:ring-primary"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (msgInput.trim()) handleSend(); }
                    }}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!msgInput.trim() || sending}
                    size="sm"
                    className="h-10 px-3 shrink-0"
                  >
                    {sending
                      ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 px-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Select a conversation</p>
                  <p className="text-sm text-muted-foreground mt-1">Choose from your conversations or find a player to start chatting</p>
                </div>
                <Button variant="outline" onClick={() => setShowPlayerSearch(true)}>
                  <Search className="w-4 h-4 mr-2" />Find Players
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      <GroupCreateDialog
        open={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        friends={friendsList}
        onSubmit={async (name, memberIds) => {
          const convId = await createGroupChat(name, memberIds);
          setActiveView('conversations');
          setSelectedConvId(convId);
          toast.success(`# ${name} created!`);
        }}
      />

      {selectedConv?.is_group && (
        <GroupInfoSheet
          open={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          conv={selectedConv}
          currentUserId={user?.id || ''}
          isAdmin={myRole === 'admin'}
          friends={friendsList}
          onRemoveMember={uid => removeMember(selectedConv.id, uid)}
          onAddMember={uid => addMember(selectedConv.id, uid)}
          onRenameGroup={name => updateGroup(selectedConv.id, { name })}
          onViewProfile={(profile, uid) => { setShowGroupInfo(false); setProfilePlayer(buildProfilePlayer(profile, uid)); }}
        />
      )}

      <PlayerProfileModal
        player={profilePlayer}
        isOpen={!!profilePlayer}
        onClose={() => setProfilePlayer(null)}
      />
    </div>
  );
};

export default FriendsMessagesTab;