import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  accent:      '#F97316',
  accentLight: '#FFF7ED',
  bg:          '#F8F9FB',
  white:       '#FFFFFF',
  border:      '#EAECF0',
  text:        '#111827',
  muted:       '#6B7280',
  mutedLight:  '#9CA3AF',
  bubbleOwn:   '#111827',
  online:      '#22C55E',
  unread:      '#EF4444',
  hover:       '#F9FAFB',
};

const QUICK_EMOJIS = ['👍','❤️','😂','🎾','🔥','👏','😮','😢'];

// ── Responsive helper ────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}
const EMOJI_TRAY   = ['😀','😂','🔥','🎾','👍','❤️','😮','🏆','💪','🎯','⚡','🤝','🙌','👊','😎'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getConvName(conv: Conversation, uid: string) {
  if (conv.is_group) return conv.name || 'Group Chat';
  const other = conv.members.find(m => m.user_id !== uid);
  if (!other?.profile) return 'Direct Message';
  return `${other.profile.first_name || ''} ${other.profile.last_name || ''}`.trim() || other.profile.email;
}
function getConvAvatar(conv: Conversation, uid: string) {
  if (conv.is_group) return conv.avatar_url ?? undefined;
  return conv.members.find(m => m.user_id !== uid)?.profile?.profile_picture_url ?? undefined;
}
function getConvOtherUserId(conv: Conversation, uid: string) {
  return conv.members.find(m => m.user_id !== uid)?.user_id;
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}
function fmtTime(d: string) {
  const date = new Date(d);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}
function fmtDivider(d: string) {
  const date = new Date(d);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
}

// ── Inline Avatar ─────────────────────────────────────────────────────────────
interface AvProps { src?: string; name: string; color?: string; size?: number; online?: boolean; }
const Av: React.FC<AvProps> = ({ src, name, color, size = 36, online = false }) => {
  const bg = color || C.accent;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, letterSpacing: '-0.5px' }}>
          {initials(name)}
        </div>
      )}
      {online && (
        <div style={{ position: 'absolute', bottom: 1, right: 1, width: size * 0.28, height: size * 0.28, borderRadius: '50%', background: C.online, border: '2px solid white' }} />
      )}
    </div>
  );
};

const GroupAv = ({ size = 36 }: { size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: 10, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0, fontWeight: 700 }}>#</div>
);

const UnreadBadge = ({ count }: { count: number }) => {
  if (!count) return null;
  return (
    <div style={{ background: C.unread, color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
      {count > 99 ? '99+' : count}
    </div>
  );
};

// ── GroupInfoSheet ────────────────────────────────────────────────────────────
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
  onSetAvatar: (file: File) => Promise<void>;
  onSetMemberRole: (uid: string, role: 'admin' | 'member') => Promise<void>;
  onViewProfile: (profile: NonNullable<Conversation['members'][0]['profile']>, uid: string) => void;
}
const GroupInfoSheet: React.FC<GroupInfoSheetProps> = ({
  open, onClose, conv, currentUserId, isAdmin, friends,
  onRemoveMember, onAddMember, onRenameGroup, onSetAvatar, onSetMemberRole, onViewProfile,
}) => {
  const [renaming, setRenaming]       = useState(false);
  const [newName, setNewName]         = useState(conv.name || '');
  const [busy, setBusy]               = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [confirmRemove, setConfirmRemove]     = useState<string | null>(null);
  const [memberMenu, setMemberMenu]   = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const existingIds    = new Set(conv.members.map(m => m.user_id));
  const addableFriends = friends.filter(f => !existingIds.has(f.userId));

  const memberName = (m: Conversation['members'][0]) => {
    if (!m.profile) return 'Unknown';
    return `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await onSetAvatar(file);
      toast.success('Group photo updated');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const doRemove = async (uid: string) => {
    setConfirmRemove(null);
    setBusy(uid);
    try { await onRemoveMember(uid); toast.success('Member removed'); }
    catch { toast.error('Failed to remove'); }
    finally { setBusy(null); }
  };

  const doSetRole = async (uid: string, role: 'admin' | 'member') => {
    setMemberMenu(null);
    setBusy(uid);
    try {
      await onSetMemberRole(uid, role);
      toast.success(role === 'admin' ? 'Promoted to admin' : 'Demoted to member');
    } catch { toast.error('Failed'); }
    finally { setBusy(null); }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" style={{ width: 380, padding: 0, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
        <SheetHeader style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
          <SheetTitle style={{ fontSize: 16, fontWeight: 700 }}>Group Settings</SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── Group Avatar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              {conv.avatar_url ? (
                <img src={conv.avatar_url} alt="group" style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: `3px solid ${C.border}` }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 20, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, border: `3px solid ${C.border}` }}>#</div>
              )}
              {isAdmin && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  style={{ position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, borderRadius: '50%', background: C.accent, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                  title="Change group photo"
                >
                  {avatarUploading ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : '📷'}
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{conv.name || 'Group Chat'}</div>
            <div style={{ fontSize: 13, color: C.muted }}>{conv.members.length} members</div>
          </div>

          {/* ── Group Name ── */}
          <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Group Name</p>
          {renaming ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={50} autoFocus
                style={{ flex: 1, border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                onKeyDown={async e => {
                  if (e.key === 'Enter') { await onRenameGroup(newName); setRenaming(false); toast.success('Group renamed'); }
                  if (e.key === 'Escape') { setRenaming(false); setNewName(conv.name || ''); }
                }}
              />
              <button onClick={async () => { await onRenameGroup(newName); setRenaming(false); toast.success('Group renamed'); }}
                style={{ padding: '8px 14px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setRenaming(false); setNewName(conv.name || ''); }}
                style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.bg, borderRadius: 10, marginBottom: 24 }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{conv.name || 'Group Chat'}</span>
              {isAdmin && <button onClick={() => setRenaming(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14 }}>✏️</button>}
            </div>
          )}

          {/* ── Members ── */}
          <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Members ({conv.members.length})</p>
          {conv.members.map(m => {
            const name = memberName(m);
            const isMe = m.user_id === currentUserId;
            const isBusy = busy === m.user_id;
            return (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}`, position: 'relative' }}>
                {/* Avatar + name */}
                <button onClick={() => m.profile && onViewProfile(m.profile, m.user_id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left' }}>
                  <Av name={name} src={m.profile?.profile_picture_url} size={38} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{name}{isMe ? ' (you)' : ''}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: m.role === 'admin' ? C.accent : C.muted, marginTop: 1 }}>
                      {m.role === 'admin' ? '⭐ Admin' : 'Member'}
                    </div>
                  </div>
                </button>

                {/* Admin actions (not on self) */}
                {isAdmin && !isMe && (
                  <div style={{ position: 'relative' }}>
                    <button
                      disabled={isBusy}
                      onClick={() => setMemberMenu(memberMenu === m.user_id ? null : m.user_id)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}
                    >{isBusy ? '…' : '···'}</button>

                    {memberMenu === m.user_id && (
                      <div style={{ position: 'absolute', right: 0, top: '110%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 190, overflow: 'hidden' }}>
                        {/* Promote / demote */}
                        {m.role === 'member' ? (
                          <button onClick={() => doSetRole(m.user_id, 'admin')}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: C.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >⭐ Promote to admin</button>
                        ) : (
                          <button onClick={() => doSetRole(m.user_id, 'member')}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: C.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >↓ Demote to member</button>
                        )}
                        {/* View profile */}
                        <button onClick={() => { setMemberMenu(null); m.profile && onViewProfile(m.profile, m.user_id); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: C.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >👤 View profile</button>
                        {/* Remove */}
                        <button onClick={() => { setMemberMenu(null); setConfirmRemove(m.user_id); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: '#ef4444', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >🚫 Remove from group</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Add Members ── */}
          {isAdmin && addableFriends.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Add Members</p>
              {addableFriends.map(f => (
                <div key={f.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <Av name={f.name} src={f.avatar} size={32} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{f.name}</span>
                  <button disabled={busy === f.userId}
                    onClick={async () => { setBusy(f.userId); try { await onAddMember(f.userId); toast.success(`${f.name} added`); } catch { toast.error('Failed'); } finally { setBusy(null); } }}
                    style={{ padding: '5px 12px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                  >{busy === f.userId ? '…' : '+ Add'}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Confirm Remove dialog ── */}
        {confirmRemove && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
            onClick={() => setConfirmRemove(null)}>
            <div style={{ background: C.white, borderRadius: 16, padding: 28, width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', fontFamily: "'DM Sans', sans-serif" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Remove member?</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
                {memberName(conv.members.find(m => m.user_id === confirmRemove)!)} will be removed from the group.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmRemove(null)}
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                <button onClick={() => doRemove(confirmRemove)}
                  style={{ flex: 1, padding: 10, borderRadius: 10, background: '#ef4444', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ── ConvRow ───────────────────────────────────────────────────────────────────
interface ConvRowProps {
  conv: Conversation;
  selected: boolean;
  userId: string;
  isOnlineFn: (id: string) => boolean;
  onClick: () => void;
  onPin: (pinned: boolean) => void;
  onMarkRead: () => void;
  onLeave?: () => void;
  onDelete?: () => void;
}
const ConvRow: React.FC<ConvRowProps> = ({ conv, selected, userId, isOnlineFn, onClick, onPin, onMarkRead, onLeave, onDelete }) => {
  const [hov, setHov]       = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const name    = getConvName(conv, userId);
  const avatar  = getConvAvatar(conv, userId);
  const otherId = !conv.is_group ? getConvOtherUserId(conv, userId) : undefined;
  const online  = otherId ? isOnlineFn(otherId) : false;
  const lastMsg = conv.lastMessage;

  const menuItems = [
    { label: conv.isPinned ? '📌 Unpin' : '📌 Pin', action: () => onPin(!conv.isPinned) },
    { label: '✓ Mark as read', action: onMarkRead },
    ...(conv.is_group && onLeave  ? [{ label: '🚪 Leave group',  action: onLeave,  danger: false }] : []),
    ...(conv.is_group && onDelete ? [{ label: '🗑️ Delete group', action: onDelete, danger: true  }] : []),
  ];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setMenuOpen(false); }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', background: selected ? C.accentLight : hov ? C.hover : 'transparent', borderLeft: selected ? `3px solid ${C.accent}` : '3px solid transparent', transition: 'all 0.12s', position: 'relative' }}
    >
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        {conv.is_group ? <GroupAv size={44} /> : <Av name={name} src={avatar} size={44} online={online} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: conv.unreadCount ? 700 : 600, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conv.is_group ? `# ${name}` : name}
              {conv.isPinned && <span style={{ marginLeft: 6, fontSize: 12 }}>📌</span>}
            </div>
            <div style={{ fontSize: 11, color: C.muted, flexShrink: 0, marginLeft: 6 }}>{lastMsg ? fmtTime(lastMsg.created_at) : ''}</div>
          </div>
          {lastMsg && (
            <div style={{ fontSize: 12, color: conv.unreadCount ? C.text : C.muted, fontWeight: conv.unreadCount ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {lastMsg.deleted_at ? 'Message deleted' : lastMsg.content}
            </div>
          )}
        </div>
        {conv.unreadCount > 0 && !hov && <UnreadBadge count={conv.unreadCount} />}
      </div>

      {/* Context menu trigger — shown on hover */}
      {hov && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            style={{ width: 28, height: 28, borderRadius: 7, background: selected ? C.accentLight : C.bg, border: `1px solid ${C.border}`, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}
          >···</button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 170, overflow: 'hidden' }}>
              {menuItems.map(item => (
                <button key={item.label}
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); item.action(); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: (item as any).danger ? '#ef4444' : C.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >{item.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── FriendRow ─────────────────────────────────────────────────────────────────
interface FriendRowProps {
  fid: string;
  name: string;
  email: string;
  avatar?: string;
  online: boolean;
  faded?: boolean;
  onChat: () => void;
  onProfile: () => void;
  onUnfriend: () => void;
  onBlock: () => void;
}
const FriendRow: React.FC<FriendRowProps> = ({ fid, name, avatar, online, faded, onChat, onProfile, onUnfriend, onBlock }) => {
  const [hov, setHov] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setMenuOpen(false); }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: hov ? C.hover : 'transparent', opacity: faded ? 0.75 : 1, transition: 'all 0.1s', position: 'relative' }}>
      <button onClick={onProfile} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Av name={name} src={avatar} size={40} online={online} />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{name}</div>
        <div style={{ fontSize: 12, color: online ? C.online : C.muted }}>{online ? 'Online' : 'Offline'}</div>
      </div>
      {hov && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onChat} style={{ padding: '5px 12px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Chat</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(v => !v)} style={{ padding: '5px 10px', borderRadius: 8, background: C.bg, color: C.muted, border: `1px solid ${C.border}`, fontSize: 14, cursor: 'pointer' }}>···</button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
                {[
                  { label: '👤 View Profile', action: onProfile },
                  { label: '👋 Unfriend',     action: onUnfriend },
                  { label: '🚫 Block',        action: onBlock, danger: true },
                ].map(item => (
                  <button key={item.label} onClick={() => { setMenuOpen(false); item.action(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: item.danger ? '#ef4444' : C.text, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >{item.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const FriendsMessagesTab = () => {
  const [activeTab, setActiveTab]         = useState<'chat' | 'friends' | 'requests'>('chat');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [msgInput, setMsgInput]           = useState('');
  const [search, setSearch]               = useState('');
  const [friendSearch, setFriendSearch]   = useState('');
  const [hoveredMsg, setHoveredMsg]       = useState<string | null>(null);
  const [reactionPickerMsg, setReactionPickerMsg] = useState<string | null>(null);
  const [emojiTrayOpen, setEmojiTrayOpen] = useState(false);
  const [replyToMsg, setReplyToMsg]       = useState<ConversationMessage | null>(null);
  const [atBottom, setAtBottom]           = useState(true);
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  const [showGroupCreate, setShowGroupCreate]   = useState(false);
  const [showGroupInfo, setShowGroupInfo]       = useState(false);
  const [profilePlayer, setProfilePlayer]       = useState<any | null>(null);
  const [groupName, setGroupName]         = useState('');
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]             = useState(false);
  const isMobile = useWindowWidth() < 768;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const {
    requests, loading: friendsLoading,
    updateRequestStatus, revokeFriendRequest, getPendingRequestsCount,
  } = useFriendRequests();
  const { blockedUsers, blockUser, unfriendUser } = useBlockedUsers();
  const {
    conversations, loading: convLoading,
    sendMessage, getOrCreateDM, createGroupChat,
    addMember, removeMember, deleteMessage, toggleReaction,
    leaveGroup, deleteGroup, togglePin,
    updateGroup, markConversationRead, getTotalUnread, getMyRole, setMemberRole,
  } = useConversations();
  const { invites: _invites } = useMatchInvites();
  const { isOnline } = useOnlinePresence();
  const { typingUsers, broadcastTyping } = useTypingIndicator(selectedConvId);

  const blockedIds = useMemo(() => new Set(blockedUsers.map(b => b.blocked_user_id)), [blockedUsers]);

  const pendingIn   = requests.filter(r => r.status === 'pending' && r.receiver_id === user?.id);
  const pendingSent = requests.filter(r => r.status === 'pending' && r.sender_id === user?.id);
  const friends     = requests.filter(r => r.status === 'accepted');

  const visConvs = useMemo(() => conversations.filter(c => {
    if (c.is_group) return true;
    const other = c.members.find(m => m.user_id !== user?.id);
    return other ? !blockedIds.has(other.user_id) : true;
  }), [conversations, user, blockedIds]);

  const dmConvs    = visConvs.filter(c => !c.is_group);
  const groupConvs = visConvs.filter(c => c.is_group);

  const sortPinned = (arr: Conversation[]) => [...arr].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  const filteredDMs    = sortPinned(dmConvs.filter(c => getConvName(c, user?.id || '').toLowerCase().includes(search.toLowerCase())));
  const filteredGroups = sortPinned(groupConvs.filter(c => getConvName(c, user?.id || '').toLowerCase().includes(search.toLowerCase())));

  const filteredFriends = friends.filter(f => {
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    const s  = friendSearch.toLowerCase();
    return (fd?.name || '').toLowerCase().includes(s) || (fd?.email || '').toLowerCase().includes(s);
  });
  const onlineFriends  = filteredFriends.filter(f => isOnline(f.sender_id === user?.id ? f.receiver_id : f.sender_id));
  const offlineFriends = filteredFriends.filter(f => !isOnline(f.sender_id === user?.id ? f.receiver_id : f.sender_id));

  const selectedConv = visConvs.find(c => c.id === selectedConvId) ?? null;
  const convName     = selectedConv ? getConvName(selectedConv, user?.id || '') : '';
  const convAvatar   = selectedConv ? getConvAvatar(selectedConv, user?.id || '') : undefined;
  const myRole       = selectedConv ? getMyRole(selectedConv) : null;
  const dmOtherId    = selectedConv && !selectedConv.is_group ? getConvOtherUserId(selectedConv, user?.id || '') : undefined;

  const friendsList = friends.map(f => {
    const fid = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    const fd  = f.sender_id === user?.id ? f.receiver : f.sender;
    return { userId: fid, name: fd?.name || 'Unknown', avatar: fd?.profile_picture_url };
  });

  const totalUnread = getTotalUnread();
  const onlineCount = friends.filter(f => isOnline(f.sender_id === user?.id ? f.receiver_id : f.sender_id)).length;

  useEffect(() => {
    if (atBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages.length, atBottom]);

  useEffect(() => {
    if (selectedConvId) { markConversationRead(selectedConvId); setAtBottom(true); }
  }, [selectedConvId, markConversationRead]);

  useEffect(() => {
    if (selectedConvId) inputRef.current?.focus();
  }, [selectedConvId]);

  // Dismiss reaction picker on outside click
  useEffect(() => {
    if (!reactionPickerMsg) return;
    const handler = () => setReactionPickerMsg(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [reactionPickerMsg]);

  // Auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length > 1000) return;
    setMsgInput(e.target.value);
    if (e.target.value.trim()) broadcastTyping(user?.email?.split('@')[0] || 'Someone');
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const buildProfile = (profile: NonNullable<Conversation['members'][0]['profile']>, uid: string) => ({
    id: uid, user_id: uid,
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
    email: profile.email, skill_level: 0, wins: 0, losses: 0,
  });

  const handleStartDM = async (otherUserId: string, name?: string) => {
    try {
      const id = await getOrCreateDM(otherUserId);
      setActiveTab('chat'); setSelectedConvId(id);
      if (name) toast.success(`Chat with ${name} opened`);
    } catch { toast.error('Failed to open conversation'); }
  };

  const handleAccept = async (reqId: string) => {
    try {
      const req = requests.find(r => r.id === reqId);
      await updateRequestStatus(reqId, 'accepted');
      if (req) {
        const fid  = req.sender_id === user?.id ? req.receiver_id : req.sender_id;
        const name = req.sender_id === user?.id ? req.receiver?.name : req.sender?.name;
        toast.success(`You're now friends with ${name || 'them'}! Say hello 👋`);
        const id = await getOrCreateDM(fid);
        setActiveTab('chat'); setSelectedConvId(id);
      }
    } catch { toast.error('Failed'); }
  };

  const handleSend = async () => {
    if (!selectedConvId || !msgInput.trim()) return;
    setSending(true);
    const content = msgInput;
    const replyId = replyToMsg?.id;
    setMsgInput(''); setReplyToMsg(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try { await sendMessage(selectedConvId, content, replyId); }
    catch (err: any) { console.error('[sendMessage error]', err); toast.error(err?.message || 'Failed to send'); setMsgInput(content); }
    finally { setSending(false); }
  };

  const buildGroups = (msgs: ConversationMessage[]) => {
    const vis = msgs.filter(m => !m.deleted_at || m.is_system);
    type Item = { type: 'div'; label: string } | { type: 'msg'; msg: ConversationMessage; showAv: boolean };
    const result: Item[] = [];
    let lastDate: Date | null = null;
    let lastSender: string | null = null;
    vis.forEach(m => {
      const d = new Date(m.created_at);
      if (!lastDate || !isSameDay(d, lastDate)) {
        result.push({ type: 'div', label: fmtDivider(m.created_at) });
        lastDate = d; lastSender = null;
      }
      result.push({ type: 'msg', msg: m, showAv: m.sender_id !== lastSender });
      lastSender = m.sender_id;
    });
    return result;
  };

  const tabs = [
    { id: 'chat',     label: 'Chat',     count: totalUnread },
    { id: 'friends',  label: 'Friends',  count: friends.length },
    { id: 'requests', label: 'Requests', count: getPendingRequestsCount() },
  ];

  if (friendsLoading || convLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `4px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', background: C.bg, position: 'relative', overflow: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ padding: '14px 24px', background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎾</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Network & Messages</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              <span style={{ color: C.online, fontWeight: 600 }}>●</span>
              {' '}{onlineCount} online · {friends.length} friends · {totalUnread} unread
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowGroupCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            👥 New Group
          </button>
          <button onClick={() => setShowPlayerSearch(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: showPlayerSearch ? C.text : C.accent, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + Find Players
          </button>
        </div>
      </div>

      {/* ── Find Players bar ── */}
      {showPlayerSearch && (
        <div style={{ padding: '12px 24px', background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <PlayerSearch
            onPlayerSelect={async (p: SearchResult) => { setShowPlayerSearch(false); if (p.user_id) await handleStartDM(p.user_id); }}
            placeholder="Search players by name or skill level…"
          />
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: isMobile ? '100%' : 320,
          background: C.white,
          borderRight: isMobile ? 'none' : `1px solid ${C.border}`,
          display: isMobile && selectedConvId ? 'none' : 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          {/* Tabs */}
          <div style={{ padding: '12px 16px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '8px 6px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                  background: activeTab === tab.id ? C.bg : 'transparent',
                  color: activeTab === tab.id ? C.text : C.muted,
                  fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13,
                  borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{ background: activeTab === tab.id ? C.accent : C.border, color: activeTab === tab.id ? '#fff' : C.muted, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 6px' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, borderRadius: 10, padding: '8px 12px', border: `1.5px solid ${C.border}` }}>
              <span style={{ color: C.muted }}>🔍</span>
              <input
                value={activeTab === 'friends' ? friendSearch : search}
                onChange={e => activeTab === 'friends' ? setFriendSearch(e.target.value) : setSearch(e.target.value)}
                placeholder={`Search ${activeTab}…`}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.text, flex: 1, fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* CHAT */}
            {activeTab === 'chat' && (
              <>
                {filteredDMs.length === 0 && filteredGroups.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                    <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>No conversations yet</div>
                    <div style={{ fontSize: 13, color: C.muted }}>Find players above to start chatting</div>
                  </div>
                ) : (
                  <>
                    {filteredDMs.length > 0 && (
                      <>
                        <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Direct Messages</div>
                        {filteredDMs.map(conv => (
                          <ConvRow key={conv.id} conv={conv} selected={selectedConvId === conv.id} userId={user?.id || ''} isOnlineFn={isOnline}
                            onClick={() => { setSelectedConvId(conv.id); setMsgInput(''); setReplyToMsg(null); }}
                            onPin={pinned => { togglePin(conv.id, pinned); toast.success(pinned ? 'Pinned' : 'Unpinned'); }}
                            onMarkRead={() => markConversationRead(conv.id)}
                          />
                        ))}
                      </>
                    )}
                    {filteredGroups.length > 0 && (
                      <>
                        <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Groups</div>
                        {filteredGroups.map(conv => (
                          <ConvRow key={conv.id} conv={conv} selected={selectedConvId === conv.id} userId={user?.id || ''} isOnlineFn={isOnline}
                            onClick={() => { setSelectedConvId(conv.id); setMsgInput(''); setReplyToMsg(null); }}
                            onPin={pinned => { togglePin(conv.id, pinned); toast.success(pinned ? 'Pinned' : 'Unpinned'); }}
                            onMarkRead={() => markConversationRead(conv.id)}
                            onLeave={async () => { try { await leaveGroup(conv.id); if (selectedConvId === conv.id) setSelectedConvId(null); toast.success('Left group'); } catch { toast.error('Failed to leave'); } }}
                            onDelete={getMyRole(conv) === 'admin' ? async () => { try { await deleteGroup(conv.id); if (selectedConvId === conv.id) setSelectedConvId(null); toast.success('Group deleted'); } catch { toast.error('Failed to delete'); } } : undefined}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* FRIENDS */}
            {activeTab === 'friends' && (
              <>
                {onlineFriends.length > 0 && (
                  <>
                    <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: C.online, textTransform: 'uppercase', letterSpacing: 1 }}>Online — {onlineFriends.length}</div>
                    {onlineFriends.map(f => {
                      const fid  = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
                      const fd   = f.sender_id === user?.id ? f.receiver : f.sender;
                      return (
                        <FriendRow key={f.id} fid={fid} name={fd?.name || 'Unknown'} email={fd?.email || ''} avatar={fd?.profile_picture_url} online={true}
                          onChat={() => handleStartDM(fid, fd?.name)}
                          onProfile={() => setProfilePlayer({ id: fid, user_id: fid, name: fd?.name || 'Unknown', email: fd?.email || '', skill_level: 0, wins: 0, losses: 0 })}
                          onUnfriend={() => { unfriendUser(fid); toast.success('Friend removed'); }}
                          onBlock={() => { blockUser(fid, ''); toast.success('User blocked'); }}
                        />
                      );
                    })}
                  </>
                )}
                {offlineFriends.length > 0 && (
                  <>
                    <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Offline — {offlineFriends.length}</div>
                    {offlineFriends.map(f => {
                      const fid  = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
                      const fd   = f.sender_id === user?.id ? f.receiver : f.sender;
                      return (
                        <FriendRow key={f.id} fid={fid} name={fd?.name || 'Unknown'} email={fd?.email || ''} avatar={fd?.profile_picture_url} online={false} faded
                          onChat={() => handleStartDM(fid, fd?.name)}
                          onProfile={() => setProfilePlayer({ id: fid, user_id: fid, name: fd?.name || 'Unknown', email: fd?.email || '', skill_level: 0, wins: 0, losses: 0 })}
                          onUnfriend={() => { unfriendUser(fid); toast.success('Friend removed'); }}
                          onBlock={() => { blockUser(fid, ''); toast.success('User blocked'); }}
                        />
                      );
                    })}
                  </>
                )}
                {filteredFriends.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                    <div style={{ fontWeight: 600, color: C.text }}>{friends.length === 0 ? 'No friends yet' : 'No matches'}</div>
                    {friends.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Use Find Players to connect</div>}
                  </div>
                )}
              </>
            )}

            {/* REQUESTS */}
            {activeTab === 'requests' && (
              <div style={{ padding: '12px 16px' }}>
                {pendingIn.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Incoming — {pendingIn.length}</div>
                    {pendingIn.map(req => (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 8, background: C.white }}>
                        <Av name={req.sender?.name || 'U'} src={req.sender?.profile_picture_url} size={40} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{req.sender?.name}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleAccept(req.id)} style={{ padding: '6px 12px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                          <button onClick={async () => { await updateRequestStatus(req.id, 'declined'); toast.success('Declined'); }} style={{ padding: '6px 10px', borderRadius: 8, background: C.bg, color: C.muted, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {pendingSent.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 8px' }}>Sent — {pendingSent.length}</div>
                    {pendingSent.map(req => (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.border}`, marginBottom: 8, background: C.white }}>
                        <Av name={req.receiver?.name || 'U'} src={req.receiver?.profile_picture_url} size={40} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{req.receiver?.name}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, background: C.bg, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}` }}>Pending</span>
                        <button onClick={async () => { await revokeFriendRequest(req.id); toast.success('Request revoked'); }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </>
                )}
                {pendingIn.length === 0 && pendingSent.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                    <div style={{ fontWeight: 600, color: C.text }}>No friend requests</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Thread ── */}
        <div style={{ flex: 1, display: isMobile && !selectedConvId ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
          {selectedConv ? (
            <>
              {/* Thread header */}
              <div style={{ padding: '14px 20px', background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isMobile && <button onClick={() => setSelectedConvId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: '2px 6px', lineHeight: 1 }}>‹</button>}
                  <button onClick={() => { if (selectedConv.is_group) { setShowGroupInfo(true); } else { const other = selectedConv.members.find(m => m.user_id !== user?.id); if (other?.profile) setProfilePlayer(buildProfile(other.profile, other.user_id)); } }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selectedConv.is_group
                      ? <GroupAv size={40} />
                      : <Av name={convName} src={convAvatar} size={40} online={dmOtherId ? isOnline(dmOtherId) : false} />}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{selectedConv.is_group ? `# ${convName}` : convName}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: typingUsers.length > 0 ? C.accent : (dmOtherId && isOnline(dmOtherId)) ? C.online : C.muted }}>
                        {typingUsers.length > 0 ? 'typing…'
                          : selectedConv.is_group ? `${selectedConv.members.length} members`
                          : (dmOtherId && isOnline(dmOtherId)) ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button title={selectedConv.isPinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(selectedConv.id, !selectedConv.isPinned)}
                    style={{ width: 36, height: 36, borderRadius: 9, background: selectedConv.isPinned ? C.accentLight : C.bg, border: `1px solid ${selectedConv.isPinned ? C.accent : C.border}`, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📌</button>
                  {selectedConv.is_group && (
                    <button title="Group settings" onClick={() => setShowGroupInfo(true)}
                      style={{ width: 36, height: 36, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}
                onScroll={e => { const el = e.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); }}>

                {buildGroups(selectedConv.messages).map((item, i) => {
                  if (item.type === 'div') return (
                    <div key={`divider-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.label}</span>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                    </div>
                  );

                  const { msg, showAv } = item;
                  const isOwn    = msg.sender_id === user?.id;
                  const isSystem = msg.is_system;
                  const senderName = msg.sender
                    ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email
                    : 'Unknown';
                  const canDel = isOwn || myRole === 'admin';

                  if (isSystem) return (
                    <div key={msg.id} style={{ textAlign: 'center', padding: '6px 0' }}>
                      <span style={{ fontSize: 12, color: C.muted, background: C.border, padding: '3px 14px', borderRadius: 999 }}>{msg.content}</span>
                    </div>
                  );

                  return (
                    <div key={msg.id}
                      style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: (msg.reactions?.length || 0) > 0 ? 12 : 4, marginTop: showAv ? 10 : 2, position: 'relative' }}
                      onMouseEnter={() => setHoveredMsg(msg.id)}
                      onMouseLeave={() => { setHoveredMsg(null); setReactionPickerMsg(null); }}
                    >
                      {/* Avatar column */}
                      {!isOwn && (
                        <div style={{ width: 32, flexShrink: 0 }}>
                          {showAv && (
                            <button onClick={() => { const m = selectedConv.members.find(mb => mb.user_id === msg.sender_id); if (m?.profile) setProfilePlayer(buildProfile(m.profile, m.user_id)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              <Av name={senderName} src={msg.sender?.profile_picture_url} size={32} />
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        {!isOwn && showAv && selectedConv.is_group && (
                          <button onClick={() => { const m = selectedConv.members.find(mb => mb.user_id === msg.sender_id); if (m?.profile) setProfilePlayer(buildProfile(m.profile, m.user_id)); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 3, paddingLeft: 4 }}>{senderName}</button>
                        )}

                        {/* Reply preview */}
                        {msg.replyTo && (
                          <div style={{ fontSize: 12, borderLeft: `2px solid ${C.accent}`, paddingLeft: 8, marginBottom: 4, color: C.muted, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600 }}>{msg.replyTo.sender?.first_name || 'Someone'}: </span>
                            {msg.replyTo.content}
                          </div>
                        )}

                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          {/* Hover action bar */}
                          {hoveredMsg === msg.id && (
                            <div style={{ position: 'absolute', top: -38, ...(isOwn ? { left: 0 } : { right: 0 }), display: 'flex', gap: 4, background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '4px 6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
                              <button onClick={() => setReactionPickerMsg(reactionPickerMsg === msg.id ? null : msg.id)}
                                style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }} title="React">😊</button>
                              <button onClick={() => { setReplyToMsg(msg); inputRef.current?.focus(); }}
                                style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }} title="Reply">↩️</button>
                              {canDel && (
                                <button onClick={async () => { try { await deleteMessage(msg.id); } catch { toast.error('Failed to delete'); } }}
                                  style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }} title="Delete">🗑️</button>
                              )}
                            </div>
                          )}

                          {/* Bubble */}
                          <div style={{ padding: '10px 14px', background: isOwn ? C.bubbleOwn : C.white, color: isOwn ? '#fff' : C.text, borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: isOwn ? 'none' : `1px solid ${C.border}` }}>
                            {msg.content}
                          </div>

                          {/* Reaction picker */}
                          {reactionPickerMsg === msg.id && (
                            <div style={{ position: 'absolute', top: -78, ...(isOwn ? { left: 0 } : { right: 0 }), background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '8px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', gap: 4, zIndex: 20 }}>
                              {QUICK_EMOJIS.map(e => (
                                <button key={e} onClick={async () => { setReactionPickerMsg(null); try { await toggleReaction(msg.id, e); } catch { toast.error('Failed'); } }}
                                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 2, transition: 'transform 0.1s' }}
                                  onMouseEnter={ev => (ev.currentTarget.style.transform = 'scale(1.3)')}
                                  onMouseLeave={ev => (ev.currentTarget.style.transform = 'scale(1)')}
                                >{e}</button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reaction pills */}
                        {(msg.reactions?.length || 0) > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                            {msg.reactions!.map(r => (
                              <button key={r.emoji} onClick={async () => { try { await toggleReaction(msg.id, r.emoji); } catch { toast.error('Failed'); } }}
                                style={{ background: r.reactedByMe ? C.accentLight : C.white, border: `1.5px solid ${r.reactedByMe ? C.accent : C.border}`, borderRadius: 999, padding: '2px 8px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {r.emoji} <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Timestamp */}
                        <div style={{ fontSize: 11, color: C.mutedLight, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                          {isOwn && <span style={{ color: C.accent }}>✓✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <Av name={convName} src={convAvatar} size={28} />
                    <div style={{ background: C.white, borderRadius: '18px 18px 18px 4px', padding: '10px 16px', border: `1px solid ${C.border}`, display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.muted, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: C.muted }}>{typingUsers[0]?.displayName} is typing…</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Scroll-to-bottom pill */}
              {!atBottom && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4, flexShrink: 0 }}>
                  <button onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setAtBottom(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    ↓ New messages
                  </button>
                </div>
              )}

              {/* Reply bar */}
              {replyToMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', borderTop: `1px solid ${C.border}`, background: C.accentLight, flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>↩️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>Replying to </span>
                    <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 300 }}>{replyToMsg.content}</span>
                  </div>
                  <button onClick={() => setReplyToMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16 }}>✕</button>
                </div>
              )}

              {/* Input bar */}
              <div style={{ padding: '12px 20px', background: C.white, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {msgInput.length > 500 && (
                  <div style={{ textAlign: 'right', fontSize: 12, marginBottom: 4, color: msgInput.length > 900 ? '#ef4444' : C.accent, fontWeight: 600 }}>
                    {msgInput.length}/1000
                  </div>
                )}
                {emojiTrayOpen && (
                  <div style={{ marginBottom: 10, padding: '10px 12px', background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EMOJI_TRAY.map(e => (
                      <button key={e} onClick={() => setMsgInput(prev => prev + e)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>{e}</button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: C.bg, borderRadius: 14, border: `1.5px solid ${C.border}`, padding: '8px 12px' }}>
                  <button onClick={() => setEmojiTrayOpen(v => !v)} title="Emoji"
                    style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 8, color: emojiTrayOpen ? C.accent : C.muted }}>😊</button>
                  <textarea
                    ref={inputRef}
                    value={msgInput}
                    onChange={handleInputChange}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Message ${selectedConv.is_group ? `# ${convName}` : convName}… (Enter to send)`}
                    rows={1}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', resize: 'none', fontSize: 14, color: C.text, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                    <button title="Send match invite" onClick={() => toast.info('Match invite sent!')}
                      style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted, padding: 4 }}>🎾</button>
                    <button onClick={handleSend} disabled={!msgInput.trim() || sending}
                      style={{ width: 36, height: 36, borderRadius: 10, background: msgInput.trim() ? C.accent : C.border, border: 'none', cursor: msgInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.15s', flexShrink: 0 }}>
                      {sending
                        ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                        : <span style={{ color: '#fff' }}>↑</span>}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: C.bg }}>
              <div style={{ fontSize: 64 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: C.text }}>Select a conversation</div>
              <div style={{ fontSize: 14, color: C.muted }}>Choose from your conversations or find a player</div>
              <button onClick={() => setShowPlayerSearch(true)} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, background: C.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                + Find Players
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── New Group dialog ── */}
      {showGroupCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowGroupCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: "'DM Sans', sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Create New Group</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Group Name</div>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Friday Night Squad" autoFocus
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Add Friends</div>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 4 }}>
              {friendsList.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Add friends first to create a group</p>
              ) : friendsList.map(f => (
                <div key={f.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <Av name={f.name} src={f.avatar} size={36} />
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                  <input type="checkbox" checked={groupSelected.has(f.userId)}
                    onChange={() => setGroupSelected(prev => { const n = new Set(prev); n.has(f.userId) ? n.delete(f.userId) : n.add(f.userId); return n; })}
                    style={{ width: 18, height: 18, accentColor: C.accent, cursor: 'pointer' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowGroupCreate(false); setGroupName(''); setGroupSelected(new Set()); }}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button
                disabled={!groupName.trim() || groupSelected.size === 0}
                onClick={async () => {
                  try {
                    const id = await createGroupChat(groupName.trim(), Array.from(groupSelected));
                    setActiveTab('chat'); setSelectedConvId(id);
                    toast.success(`# ${groupName} created!`);
                    setShowGroupCreate(false); setGroupName(''); setGroupSelected(new Set());
                  } catch { toast.error('Failed to create group'); }
                }}
                style={{ flex: 1, padding: 10, borderRadius: 10, background: !groupName.trim() || groupSelected.size === 0 ? C.border : C.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: !groupName.trim() || groupSelected.size === 0 ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Create {groupSelected.size > 0 ? `(${groupSelected.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info Sheet */}
      {selectedConv?.is_group && (
        <GroupInfoSheet
          open={showGroupInfo} onClose={() => setShowGroupInfo(false)}
          conv={selectedConv} currentUserId={user?.id || ''} isAdmin={myRole === 'admin'}
          friends={friendsList}
          onRemoveMember={uid => removeMember(selectedConv.id, uid)}
          onAddMember={uid => addMember(selectedConv.id, uid)}
          onRenameGroup={name => updateGroup(selectedConv.id, { name })}
          onSetAvatar={async (file) => {
            const { supabase } = await import('@/integrations/supabase/client');
            const ext  = file.name.split('.').pop();
            const path = `${selectedConv.id}/${Date.now()}.${ext}`;
            const { error: upErr } = await (supabase as any).storage.from('group-avatars').upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            const { data: urlData } = (supabase as any).storage.from('group-avatars').getPublicUrl(path);
            await updateGroup(selectedConv.id, { avatar_url: urlData.publicUrl });
          }}
          onSetMemberRole={(uid, role) => setMemberRole(selectedConv.id, uid, role)}
          onViewProfile={(profile, uid) => { setShowGroupInfo(false); setProfilePlayer(buildProfile(profile, uid)); }}
        />
      )}

      <PlayerProfileModal player={profilePlayer} isOpen={!!profilePlayer} onClose={() => setProfilePlayer(null)} />

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px}
      `}</style>
    </div>
  );
};

export default FriendsMessagesTab;
