import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Users,
  MessageCircle,
  Send,
  Search,
  Check,
  X,
  Clock,
  UserPlus,
  Plus,
  AlertCircle,
  CheckCheck,
  ChevronLeft,
  Settings,
  UserMinus,
  Trash2,
  Pencil,
  UserCheck,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import PlayerSearch from './PlayerSearch';
import { SearchResult } from '@/hooks/usePlayerSearch';
import PlayerProfileModal from './PlayerProfileModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { requests, loading: friendsLoading, updateRequestStatus, revokeFriendRequest, getPendingRequestsCount } = useFriendRequests();
  const { blockedUsers } = useBlockedUsers();
  const { conversations, loading: convLoading, sendMessage, getOrCreateDM, createGroupChat, addMember, removeMember, deleteMessage, updateGroup, markConversationRead, getTotalUnread, getMyRole } = useConversations();
  const { invites } = useMatchInvites();

  const blockedIds = useMemo(() => new Set(blockedUsers.map(b => b.blocked_user_id)), [blockedUsers]);

  const pendingRequests = requests.filter(r => r.status === 'pending' && r.receiver_id === user?.id);
  const sentRequests    = requests.filter(r => r.status === 'pending' && r.sender_id === user?.id);
  const friends         = requests.filter(r => r.status === 'accepted');

  // Filter out conversations with blocked users
  const visibleConversations = useMemo(() => {
    return conversations.filter(conv => {
      if (conv.is_group) return true;
      const other = conv.members.find(m => m.user_id !== user?.id);
      return other ? !blockedIds.has(other.user_id) : true;
    });
  }, [conversations, user, blockedIds]);

  const filteredConversations = visibleConversations.filter(conv => {
    const name = getConvName(conv, user?.id || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const filteredFriends = friends.filter(f => {
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    const sl = searchTerm.toLowerCase();
    return fd?.name?.toLowerCase().includes(sl) || fd?.email?.toLowerCase().includes(sl);
  });

  const selectedConv = visibleConversations.find(c => c.id === selectedConvId) ?? null;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages.length]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (selectedConvId) markConversationRead(selectedConvId);
  }, [selectedConvId, markConversationRead]);

  const handleConvSelect = (id: string) => {
    setSelectedConvId(id);
    setMsgInput('');
  };

  const handleSend = async () => {
    if (!selectedConvId || !msgInput.trim()) return;
    setSending(true);
    try {
      await sendMessage(selectedConvId, msgInput);
      setMsgInput('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStartDM = async (otherUserId: string) => {
    try {
      const convId = await getOrCreateDM(otherUserId);
      setActiveView('conversations');
      setSelectedConvId(convId);
    } catch {
      toast.error('Failed to open conversation');
    }
  };

  const handlePlayerSelect = async (player: SearchResult) => {
    setShowPlayerSearch(false);
    if (!player.user_id) return;
    await handleStartDM(player.user_id);
  };

  const handleRequestResponse = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      await updateRequestStatus(requestId, status);
      toast.success(status === 'accepted' ? 'Friend request accepted!' : 'Friend request declined.');
    } catch {
      toast.error('Failed to update friend request');
    }
  };

  const handleRevokeRequest = async (requestId: string) => {
    try {
      await revokeFriendRequest(requestId);
      toast.success('Friend request revoked.');
    } catch {
      toast.error('Failed to revoke friend request');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteMessage(msgId);
    } catch {
      toast.error('Failed to delete message');
    }
  };

  // Build profile object for PlayerProfileModal from a conversation member profile
  const buildProfilePlayer = (profile: NonNullable<Conversation['members'][0]['profile']>, userId: string) => ({
    id: userId,
    user_id: userId,
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
    email: profile.email,
    skill_level: 0,
    wins: 0,
    losses: 0,
  });

  // Friends list for group create
  const friendsList = friends.map(f => {
    const friendUserId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    return { userId: friendUserId, name: fd?.name || 'Unknown', avatar: fd?.profile_picture_url };
  });

  const isLoading = friendsLoading || convLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const convName = selectedConv ? getConvName(selectedConv, user?.id || '') : '';
  const convAvatar = selectedConv ? getConvAvatar(selectedConv, user?.id || '') : undefined;

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Network & Messages</h2>
            <p className="text-sm text-muted-foreground">
              {friends.length} friends · {getTotalUnread()} unread
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowGroupCreate(true)}>
            <Users className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">New Group</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowPlayerSearch(!showPlayerSearch)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{showPlayerSearch ? 'Close' : 'Find Players'}</span>
          </Button>
        </div>
      </div>

      {/* Player Search */}
      {showPlayerSearch && (
        <div className="mx-4 mt-3 mb-0 p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Find players to message</span>
          </div>
          <PlayerSearch onPlayerSelect={handlePlayerSelect} placeholder="Search for players..." />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`w-full lg:w-80 border-r bg-muted/30 flex flex-col ${selectedConvId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 border-b">
            <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="conversations" className="text-xs">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  Chat
                  {getTotalUnread() > 0 && <Badge className="ml-1 text-xs h-4 px-1">{getTotalUnread()}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="friends" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Friends
                  <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">{friends.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="requests" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Requests
                  {getPendingRequestsCount() > 0 && <Badge variant="destructive" className="ml-1 text-xs h-4 px-1">{getPendingRequestsCount()}</Badge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 bg-background h-8 text-sm" />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-2 pb-4">
              {/* ── Conversations ── */}
              {activeView === 'conversations' && (
                <div className="space-y-1">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <MessageCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No conversations yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Find players above to start chatting</p>
                    </div>
                  ) : (
                    filteredConversations.map(conv => {
                      const name = getConvName(conv, user?.id || '');
                      const avatar = getConvAvatar(conv, user?.id || '');
                      const isActive = selectedConvId === conv.id;
                      return (
                        <div
                          key={conv.id}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/30'}`}
                          onClick={() => handleConvSelect(conv.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <Avatar className="h-10 w-10">
                                {avatar && <AvatarImage src={avatar} alt={name} />}
                                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                                  {conv.is_group ? <Users className="w-4 h-4" /> : name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {conv.unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary-foreground">{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>{name}</p>
                                {conv.lastMessage && <span className="text-xs text-muted-foreground shrink-0 ml-1">{formatTime(conv.lastMessage.created_at)}</span>}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {conv.lastMessage.sender_id === user?.id ? 'You: ' : ''}
                                  {conv.lastMessage.content}
                                </p>
                              )}
                              {conv.is_group && <Badge variant="secondary" className="text-xs mt-0.5">Group · {conv.members.length}</Badge>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Friends ── */}
              {activeView === 'friends' && (
                <div className="space-y-1">
                  {filteredFriends.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{friends.length === 0 ? 'No friends yet' : 'No matches'}</p>
                    </div>
                  ) : (
                    filteredFriends.map(friend => {
                      const friendUserId = friend.sender_id === user?.id ? friend.receiver_id : friend.sender_id;
                      const fd = friend.sender_id === user?.id ? friend.receiver : friend.sender;
                      if (blockedIds.has(friendUserId)) return null;
                      return (
                        <div key={friend.id} className="p-3 rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                {fd?.profile_picture_url && <AvatarImage src={fd.profile_picture_url} alt={fd.name} />}
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{fd?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{fd?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{fd?.email}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStartDM(friendUserId)}>
                              <MessageCircle className="w-3 h-3 mr-1" />
                              Chat
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Requests ── */}
              {activeView === 'requests' && (
                <div className="space-y-3 p-1">
                  {pendingRequests.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">INCOMING</p>
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
                              <Button size="sm" className="flex-1 text-xs h-7" onClick={() => handleRequestResponse(req.id, 'accepted')}>
                                <Check className="w-3 h-3 mr-1" />Accept
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => handleRequestResponse(req.id, 'declined')}>
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
                      <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">SENT</p>
                      <div className="space-y-2">
                        {sentRequests.map(req => (
                          <div key={req.id} className="p-3 rounded-lg border bg-card">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  {req.receiver?.profile_picture_url && <AvatarImage src={req.receiver.profile_picture_url} />}
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{req.receiver?.name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{req.receiver?.name}</p>
                                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Pending</Badge>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRevokeRequest(req.id)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingRequests.length === 0 && sentRequests.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No friend requests</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Conversation view ── */}
        <div className={`flex-1 flex flex-col ${selectedConvId ? 'flex' : 'hidden lg:flex'}`}>
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-4 border-b bg-background/95 backdrop-blur flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSelectedConvId(null)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <button
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                  onClick={() => {
                    if (selectedConv.is_group) {
                      setShowGroupInfo(true);
                    } else {
                      const other = selectedConv.members.find(m => m.user_id !== user?.id);
                      if (other?.profile) setProfilePlayer(buildProfilePlayer(other.profile, other.user_id));
                    }
                  }}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {convAvatar && <AvatarImage src={convAvatar} alt={convName} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {selectedConv.is_group ? <Users className="w-4 h-4" /> : convName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{convName}</p>
                    {selectedConv.is_group && (
                      <p className="text-xs text-muted-foreground">{selectedConv.members.length} members · click to manage</p>
                    )}
                  </div>
                </button>
                {selectedConv.is_group && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowGroupInfo(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                )}

                {/* Match invite status badge for DMs */}
                {!selectedConv.is_group && (() => {
                  const otherId = selectedConv.members.find(m => m.user_id !== user?.id)?.user_id;
                  const pendingInvite = invites.find(i =>
                    i.status === 'pending' &&
                    ((i.sender_id === user?.id && i.receiver_id === otherId) ||
                     (i.sender_id === otherId && i.receiver_id === user?.id))
                  );
                  if (!pendingInvite) return null;
                  const isSender = pendingInvite.sender_id === user?.id;
                  return (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 shrink-0">
                      {isSender ? '⏳ Invite pending' : '📬 Invite received'}
                    </Badge>
                  );
                })()}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {selectedConv.messages.map(msg => {
                    const isOwn = msg.sender_id === user?.id;
                    const senderName = msg.sender
                      ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email
                      : 'Unknown';

                    const canDelete = isOwn || getMyRole(selectedConv) === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={`flex group ${isOwn ? 'justify-end' : 'justify-start'}`}
                        onMouseEnter={() => canDelete && setHoveredMsgId(msg.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        {!isOwn && (
                          <Avatar className="h-7 w-7 mr-2 mt-1 shrink-0">
                            {msg.sender?.profile_picture_url && <AvatarImage src={msg.sender.profile_picture_url} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{senderName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`max-w-[70%] ${isOwn ? 'ml-12' : 'mr-12'}`}>
                          {/* Clickable sender name in group chats */}
                          {!isOwn && selectedConv.is_group && (
                            <button
                              className="text-xs font-medium text-primary mb-0.5 hover:underline"
                              onClick={() => {
                                const member = selectedConv.members.find(m => m.user_id === msg.sender_id);
                                if (member?.profile) setProfilePlayer(buildProfilePlayer(member.profile, member.user_id));
                              }}
                            >
                              {senderName}
                            </button>
                          )}
                          <div className="relative">
                            <div className={`px-4 py-2 rounded-2xl ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </p>
                            </div>
                            {hoveredMsgId === msg.id && canDelete && (
                              <button
                                className={`absolute top-1 ${isOwn ? '-left-8' : '-right-8'} p-1 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-white transition-colors`}
                                onClick={() => handleDeleteMessage(msg.id)}
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t bg-background/95 backdrop-blur">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    placeholder={`Message ${convName}…`}
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-32 resize-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (msgInput.trim()) handleSend(); }
                    }}
                  />
                  <Button onClick={handleSend} disabled={!msgInput.trim() || sending} size="sm" className="h-10 px-3">
                    {sending
                      ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <MessageCircle className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
                  <p className="text-sm text-muted-foreground">Choose from your conversations or find a player</p>
                </div>
                <Button variant="outline" onClick={() => setShowPlayerSearch(true)}>
                  <Plus className="w-4 h-4 mr-2" />Find Players
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Group create dialog */}
      <GroupCreateDialog
        open={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        friends={friendsList}
        onSubmit={async (name, memberIds) => {
          const convId = await createGroupChat(name, memberIds);
          setActiveView('conversations');
          setSelectedConvId(convId);
          toast.success('Group chat created!');
        }}
      />

      {/* Group Info Sheet */}
      {selectedConv?.is_group && (
        <GroupInfoSheet
          open={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          conv={selectedConv}
          currentUserId={user?.id || ''}
          isAdmin={getMyRole(selectedConv) === 'admin'}
          friends={friendsList}
          onRemoveMember={uid => removeMember(selectedConv.id, uid)}
          onAddMember={uid => addMember(selectedConv.id, uid)}
          onRenameGroup={name => updateGroup(selectedConv.id, { name })}
          onViewProfile={(profile, uid) => { setShowGroupInfo(false); setProfilePlayer(buildProfilePlayer(profile, uid)); }}
        />
      )}

      {/* Player profile modal */}
      <PlayerProfileModal
        player={profilePlayer}
        isOpen={!!profilePlayer}
        onClose={() => setProfilePlayer(null)}
      />
    </div>
  );
};

export default FriendsMessagesTab;