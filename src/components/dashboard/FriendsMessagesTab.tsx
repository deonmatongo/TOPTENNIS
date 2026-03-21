import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import type { Conversation, ConversationMessage } from '@/hooks/useConversations';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { SearchResult } from '@/hooks/usePlayerSearch';
import PlayerProfileModal from './PlayerProfileModal';
import { PlayerScheduleModal } from './PlayerScheduleModal';

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

const GroupAv = ({ size = 36, emoji, name }: { size?: number; emoji?: string; name?: string }) => (
  <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), background: name ? avatarColorForName(name) : C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0, fontWeight: 700, color: emoji ? undefined : '#fff' }}>
    {emoji || '#'}
  </div>
);

const UnreadBadge = ({ count }: { count: number }) => {
  if (!count) return null;
  return (
    <div style={{ background: C.unread, color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
      {count > 99 ? '99+' : count}
    </div>
  );
};

// ── GroupMatchRequestSheet ────────────────────────────────────────────────────
interface GroupMatchRequestSheetProps {
  open: boolean;
  onClose: () => void;
  conv: Conversation;
  currentUserId: string;
  onConfirm: (players: SearchResult[]) => void;
  onViewProfile: (player: SearchResult) => void;
}
const GroupMatchRequestSheet: React.FC<GroupMatchRequestSheetProps> = ({
  open, onClose, conv, currentUserId, onConfirm, onViewProfile,
}) => {
  const otherMembers = conv.members.filter(m => m.user_id !== currentUserId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset selection whenever the sheet opens
  useEffect(() => { if (open) setSelected(new Set()); }, [open]);

  const memberName = (m: Conversation['members'][0]) =>
    m.profile
      ? `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() || m.profile.email
      : 'Unknown';

  const toggle = (uid: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const allSelected = otherMembers.length > 0 && selected.size === otherMembers.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(otherMembers.map(m => m.user_id)));

  const handleConfirm = () => {
    const players: SearchResult[] = otherMembers
      .filter(m => selected.has(m.user_id))
      .map(m => ({
        id: m.user_id,
        user_id: m.user_id,
        name: memberName(m),
        email: m.profile?.email || '',
        skill_level: 0,
        wins: 0,
        losses: 0,
        first_name: m.profile?.first_name ?? undefined,
        last_name: m.profile?.last_name ?? undefined,
      }));
    onClose();
    onConfirm(players);
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" style={{ width: 380, padding: 0, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
        <SheetHeader style={{ padding: '20px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
          <SheetTitle style={{ fontSize: 16, fontWeight: 700 }}>Request Match</SheetTitle>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Select the members you want to challenge. You'll pick a time slot for each one.
          </p>
        </SheetHeader>

        {/* Select All row */}
        {otherMembers.length > 1 && (
          <div
            onClick={toggleAll}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: allSelected ? C.accentLight : 'transparent' }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, border: `2px solid ${allSelected ? C.accent : C.border}`,
              background: allSelected ? C.accent : C.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s',
            }}>
              {allSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Select all ({otherMembers.length})</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {otherMembers.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
              <div style={{ fontWeight: 600, color: C.text }}>No other members</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Add members to the group first</div>
            </div>
          ) : (
            otherMembers.map(m => {
              const name = memberName(m);
              const isChecked = selected.has(m.user_id);
              return (
                <div
                  key={m.user_id}
                  onClick={() => toggle(m.user_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 20px', borderBottom: `1px solid ${C.border}`,
                    cursor: 'pointer', transition: 'background 0.1s',
                    background: isChecked ? C.accentLight : 'transparent',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${isChecked ? C.accent : C.border}`,
                    background: isChecked ? C.accent : C.white,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {isChecked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>

                  <Av name={name} src={m.profile?.profile_picture_url ?? undefined} size={40} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginTop: 2 }}>
                      {m.role === 'admin' ? '⭐ Admin' : 'Member'}
                    </div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onViewProfile({
                        id: m.user_id,
                        user_id: m.user_id,
                        name,
                        email: m.profile?.email || '',
                        skill_level: 0,
                        wins: 0,
                        losses: 0,
                        first_name: m.profile?.first_name ?? undefined,
                        last_name: m.profile?.last_name ?? undefined,
                      });
                    }}
                    style={{
                      background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      color: C.accent, cursor: 'pointer', flexShrink: 0,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Profile
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, background: C.white, flexShrink: 0 }}>
          {otherMembers.length > 0 && (
            <>
              {selected.size > 0 ? (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 500 }}>
                  {selected.size} player{selected.size !== 1 ? 's' : ''} selected — you'll set a time slot for each one.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Tap members above to select them.</div>
              )}
              <button
                disabled={selected.size === 0}
                onClick={handleConfirm}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 10,
                  background: selected.size > 0 ? C.accent : C.border,
                  color: selected.size > 0 ? '#fff' : C.muted,
                  border: 'none', fontSize: 14, fontWeight: 700,
                  cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                }}
              >
                {selected.size === 0 ? 'Select players to continue' : `Continue with ${selected.size} player${selected.size !== 1 ? 's' : ''} →`}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10,
              border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: 600, color: C.muted,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              marginTop: otherMembers.length > 0 ? 8 : 0,
            }}
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
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

// ── Preset group emoji avatars ────────────────────────────────────────────────
const PRESET_EMOJIS = ['🎾', '⚽', '🏀', '🎯', '🏆', '⚡', '🔥', '🤝'];
const AVATAR_COLORS = ['#F97316','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#EC4899','#6366F1'];
function avatarColorForName(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Step indicator ─────────────────────────────────────────────────────────────
const StepDots: React.FC<{ step: number; labels: string[] }> = ({ step, labels }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 24 }}>
    {labels.map((label, i) => (
      <React.Fragment key={i}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: i <= step ? C.accent : C.border, color: i <= step ? '#fff' : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'all 0.2s' }}>{i + 1}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: i <= step ? C.accent : C.muted, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        </div>
        {i < labels.length - 1 && (
          <div style={{ width: 40, height: 2, background: i < step ? C.accent : C.border, margin: '0 4px', marginBottom: 16, transition: 'all 0.2s', flexShrink: 0 }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── NewGroupModal ─────────────────────────────────────────────────────────────
interface NewGroupModalProps {
  open: boolean;
  onClose: () => void;
  friends: { userId: string; name: string; avatar?: string; skill?: string }[];
  existingGroupNames: string[];
  isOnlineFn: (id: string) => boolean;
  isMobile: boolean;
  onSuccess: (convId: string, groupName: string) => void;
  createGroupChat: (name: string, members: string[], opts?: { description?: string; group_type?: 'private' | 'open'; avatar_emoji?: string }) => Promise<string>;
}
const NewGroupModal: React.FC<NewGroupModalProps> = ({
  open, onClose, friends, existingGroupNames, isOnlineFn, isMobile, onSuccess, createGroupChat,
}) => {
  const [step, setStep]                   = useState(0);
  const [name, setName]                   = useState('');
  const [description, setDescription]    = useState('');
  const [groupType, setGroupType]         = useState<'private' | 'open'>('private');
  const [avatarEmoji, setAvatarEmoji]     = useState('🎾');
  const [memberSearch, setMemberSearch]   = useState('');
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [creating, setCreating]           = useState(false);
  const [showDiscard, setShowDiscard]     = useState(false);

  const MAX_MEMBERS = 50;
  const nameLen       = name.trim().length;
  const nameTaken     = existingGroupNames.some(n => n.toLowerCase() === name.trim().toLowerCase());
  const nameValid     = nameLen >= 2 && nameLen <= 40;
  const memberCount   = selected.size + 1; // +1 for creator
  const memberOverLimit = memberCount > MAX_MEMBERS;

  const resetAndClose = () => {
    setStep(0); setName(''); setDescription(''); setGroupType('private');
    setAvatarEmoji('🎾'); setSelected(new Set()); setMemberSearch(''); setCreating(false);
    setShowDiscard(false); onClose();
  };

  const tryClose = () => {
    if (name.trim() || selected.size > 0 || description.trim()) { setShowDiscard(true); } else { resetAndClose(); }
  };

  // Memoized online status for friends to prevent repeated calls
  const friendsOnlineStatus = useMemo(() => {
    const statusMap = new Map<string, boolean>();
    friends.forEach(f => {
      statusMap.set(f.userId, isOnlineFn(f.userId));
    });
    return statusMap;
  }, [friends, isOnlineFn]);

  const onlineFriends  = friends.filter(f => friendsOnlineStatus.get(f.userId));
  const offlineFriends = friends.filter(f => !friendsOnlineStatus.get(f.userId));
  const filterFriends  = (arr: typeof friends) => arr.filter(f => f.name.toLowerCase().includes(memberSearch.toLowerCase()));

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createGroupChat(name.trim(), Array.from(selected), {
        description: description.trim() || undefined,
        group_type: groupType,
        avatar_emoji: avatarEmoji,
      });
      resetAndClose();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#F97316', '#ffffff', '#111827'] });
      onSuccess(id, name.trim());
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create group');
      setCreating(false);
    }
  };

  if (!open) return null;

  const modalStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, background: C.white, zIndex: 200, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", overflowY: 'auto' }
    : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 };
  const cardStyle: React.CSSProperties = isMobile
    ? { flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }
    : { background: C.white, borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', fontFamily: "'DM Sans', sans-serif", maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' };

  return (
    <div style={modalStyle} onClick={isMobile ? undefined : tryClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 20 : 18, color: C.text }}>Create a Group</div>
          <button onClick={tryClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted, padding: '2px 6px', lineHeight: 1, borderRadius: 8 }}>✕</button>
        </div>

        <StepDots step={step} labels={['Details', 'Members', 'Review']} />

        {/* ── Step 0: Details ── */}
        {step === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Avatar picker */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: avatarColorForName(name || 'G'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', transition: 'background 0.2s' }}>
                {avatarEmoji}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {PRESET_EMOJIS.map(e => (
                  <button key={e} onClick={() => setAvatarEmoji(e)}
                    style={{ width: 36, height: 36, borderRadius: 10, background: avatarEmoji === e ? C.accentLight : C.bg, border: `2px solid ${avatarEmoji === e ? C.accent : C.border}`, fontSize: 18, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Group Name <span style={{ color: C.accent }}>*</span></label>
                <span style={{ fontSize: 12, color: nameLen > 35 ? C.accent : C.muted }}>{nameLen}/40</span>
              </div>
              <input value={name} onChange={e => setName(e.target.value.slice(0, 40))} autoFocus placeholder='e.g. "Friday Night Squad"'
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${nameTaken ? '#ef4444' : nameValid ? C.accent : C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", color: C.text }} />
              {nameTaken && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>⚠ You already have a group with this name</div>}
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.text, display: 'block', marginBottom: 6 }}>Description <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
              <input value={description} onChange={e => setDescription(e.target.value.slice(0, 120))} placeholder="What's this group for?"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", color: C.text }} />
            </div>

            {/* Group type */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.text, display: 'block', marginBottom: 8 }}>Group Type</label>
              {(['private', 'open'] as const).map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${groupType === t ? C.accent : C.border}`, background: groupType === t ? C.accentLight : C.white, cursor: 'pointer', marginBottom: 8, transition: 'all 0.15s' }}>
                  <input type="radio" checked={groupType === t} onChange={() => setGroupType(t)} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text, textTransform: 'capitalize' }}>{t === 'private' ? '🔒 Private' : '🌐 Open'}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{t === 'private' ? 'Only invited members can join' : 'Any friend can join'}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
              <button onClick={tryClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button disabled={!nameValid || nameTaken} onClick={() => setStep(1)}
                style={{ flex: 2, padding: 12, borderRadius: 12, background: nameValid && !nameTaken ? C.accent : C.border, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: nameValid && !nameTaken ? 'pointer' : 'default', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Members ── */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, borderRadius: 10, padding: '9px 12px', border: `1.5px solid ${C.border}` }}>
              <span style={{ color: C.muted }}>🔍</span>
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} autoFocus placeholder="Search friends…"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.text, flex: 1, fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            {/* Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
                {selected.size === 0 && <span style={{ color: C.muted }}>You can always add members later</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: memberCount >= 40 ? C.accent : C.muted }}>
                {memberCount} / {MAX_MEMBERS} members
              </span>
            </div>

            {/* Friends list */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: isMobile ? '45vh' : 280, borderRadius: 10, border: `1px solid ${C.border}` }}>
              {friends.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 13 }}>Add friends first to invite to the group</div>
              ) : (
                <>
                  {filterFriends(onlineFriends).length > 0 && (
                    <>
                      <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 700, color: C.online, textTransform: 'uppercase', letterSpacing: 1, background: C.white }}>Online — {filterFriends(onlineFriends).length}</div>
                      {filterFriends(onlineFriends).map(f => <MemberPickRow key={f.userId} f={f} selected={selected.has(f.userId)} disabled={memberOverLimit && !selected.has(f.userId)} online onToggle={() => setSelected(prev => { const n = new Set(prev); n.has(f.userId) ? n.delete(f.userId) : n.add(f.userId); return n; })} />)}
                    </>
                  )}
                  {filterFriends(offlineFriends).length > 0 && (
                    <>
                      <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, background: C.white }}>Offline — {filterFriends(offlineFriends).length}</div>
                      {filterFriends(offlineFriends).map(f => <MemberPickRow key={f.userId} f={f} selected={selected.has(f.userId)} disabled={memberOverLimit && !selected.has(f.userId)} online={false} onToggle={() => setSelected(prev => { const n = new Set(prev); n.has(f.userId) ? n.delete(f.userId) : n.add(f.userId); return n; })} />)}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Pill chips */}
            {selected.size > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
                {Array.from(selected).map(uid => {
                  const f = friends.find(x => x.userId === uid);
                  if (!f) return null;
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.accentLight, border: `1px solid ${C.accent}`, borderRadius: 999, padding: '4px 10px 4px 6px', fontSize: 12, fontWeight: 600, color: C.text }}>
                      <Av name={f.name} src={f.avatar} size={18} />
                      {f.name.split(' ')[0]}
                      <button onClick={() => setSelected(prev => { const n = new Set(prev); n.delete(uid); return n; })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
              <button onClick={() => setStep(2)} style={{ flex: 2, padding: 12, borderRadius: 12, background: C.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Next →</button>
            </div>
            <button onClick={tryClose} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Cancel &amp; discard</button>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Summary card */}
            <div style={{ background: C.accentLight, borderRadius: 14, padding: '16px 18px', border: `1.5px solid ${C.border}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: avatarColorForName(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{avatarEmoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 2 }}>{name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: description ? 6 : 0 }}>
                  {groupType === 'private' ? '🔒 Private' : '🌐 Open'} · {memberCount} member{memberCount !== 1 ? 's' : ''}
                </div>
                {description && <div style={{ fontSize: 13, color: C.text, fontStyle: 'italic' }}>"{description}"</div>}
              </div>
            </div>

            {/* Members list */}
            {selected.size > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Members being added ({selected.size})</div>
                <div style={{ maxHeight: isMobile ? '30vh' : 180, overflowY: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
                  {Array.from(selected).map(uid => {
                    const f = friends.find(x => x.userId === uid);
                    if (!f) return null;
                    return (
                      <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${C.border}` }}>
                        <Av name={f.name} src={f.avatar} size={32} online={isOnlineFn(f.userId)} />
                        <div style={{ flex: 1, fontWeight: 500, fontSize: 13, color: C.text }}>{f.name}</div>
                        {isOnlineFn(f.userId) && <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.online, display: 'inline-block' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notification note */}
            <div style={{ fontSize: 12, color: C.muted, background: C.bg, borderRadius: 10, padding: '10px 14px', border: `1px solid ${C.border}` }}>
              ⚠ They'll each receive an in-app notification when the group is created.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
              <button disabled={creating} onClick={handleCreate}
                style={{ flex: 2, padding: 12, borderRadius: 12, background: creating ? C.border : C.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: creating ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {creating
                  ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Creating…</>
                  : `Create Group ${avatarEmoji}`}
              </button>
            </div>
            {!creating && (
              <button onClick={tryClose} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Cancel &amp; discard</button>
            )}
          </div>
        )}
      </div>

      {/* Discard confirm */}
      {showDiscard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 28, width: 300, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: C.text }}>Discard group?</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>Your progress will be lost.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDiscard(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Keep editing</button>
              <button onClick={resetAndClose} style={{ flex: 1, padding: 10, borderRadius: 10, background: '#ef4444', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── MemberPickRow (used inside NewGroupModal) ─────────────────────────────────
interface MemberPickRowProps {
  f: { userId: string; name: string; avatar?: string; skill?: string };
  selected: boolean; disabled: boolean; online: boolean;
  onToggle: () => void;
}
const MemberPickRow: React.FC<MemberPickRowProps> = ({ f, selected, disabled, online, onToggle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${C.border}`, background: selected ? C.accentLight : C.white, transition: 'background 0.12s' }}>
    <Av name={f.name} src={f.avatar} size={36} online={online} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{f.name}</div>
      {f.skill && <div style={{ fontSize: 11, color: C.muted }}>{f.skill}</div>}
    </div>
    <button onClick={onToggle} disabled={disabled && !selected}
      style={{ width: 32, height: 32, borderRadius: 10, background: selected ? C.accent : disabled ? C.border : C.bg, border: `1.5px solid ${selected ? C.accent : C.border}`, color: selected ? '#fff' : C.muted, fontSize: 16, cursor: disabled && !selected ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
      {selected ? '✓' : '+'}
    </button>
  </div>
);

// ── GroupOnboardingBanner ─────────────────────────────────────────────────────
interface GroupOnboardingBannerProps {
  convId: string; convName: string; avatarEmoji?: string; isCreator: boolean;
  inviterName?: string; memberCount: number;
  onViewMembers: () => void;
}
const GroupOnboardingBanner: React.FC<GroupOnboardingBannerProps> = ({
  convId, convName, avatarEmoji, isCreator, inviterName, memberCount, onViewMembers,
}) => {
  const key = `dismissed_onboarding_${convId}`;
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(key));
  const [collapsing, setCollapsing] = useState(false);

  const dismiss = () => {
    setCollapsing(true);
    setTimeout(() => { localStorage.setItem(key, '1'); setDismissed(true); }, 300);
  };

  if (dismissed) return null;

  return (
    <div style={{ overflow: 'hidden', transition: 'max-height 0.3s ease, opacity 0.3s', maxHeight: collapsing ? 0 : 200, opacity: collapsing ? 0 : 1, flexShrink: 0 }}>
      <div style={{ margin: '12px 20px', background: C.accentLight, borderLeft: `4px solid ${C.accent}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{avatarEmoji || '🎾'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isCreator ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>You created {convName}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>You're the admin · {memberCount} member{memberCount !== 1 ? 's' : ''}</div>
              <div style={{ fontSize: 12, color: C.text, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>✓ Invite more friends via <span style={{ color: C.accent, fontWeight: 600 }}>⚙ Settings</span></div>
                <div>✓ Set a group description</div>
                <div>✓ Send your first message below 👋</div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2 }}>👋 {inviterName || 'Someone'} added you to {convName}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </div>
              <button onClick={onViewMembers} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: 'none', border: `1px solid ${C.accent}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>View Members</button>
            </>
          )}
        </div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: 2, flexShrink: 0, lineHeight: 1 }} title="Got it">✕</button>
      </div>
    </div>
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
        {conv.is_group ? <GroupAv size={44} emoji={(conv as any).avatar_emoji} name={name} /> : <Av name={name} src={avatar} size={44} online={online} />}
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
  // ── All hooks must be called unconditionally at the top ──────────────────
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
  const [showGroupCreate, setShowGroupCreate]   = useState(false);
  const [showGroupInfo, setShowGroupInfo]       = useState(false);
  const [showGroupMatchRequest, setShowGroupMatchRequest] = useState(false);
  const [matchRequestQueue, setMatchRequestQueue] = useState<SearchResult[]>([]);
  const [matchRequestTarget, setMatchRequestTarget] = useState<SearchResult | null>(null);
  const [profilePlayer, setProfilePlayer]       = useState<any | null>(null);
  const [sending, setSending]             = useState(false);
  const [newGroupConvId, setNewGroupConvId] = useState<string | null>(null);
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
  } = useConversationsContext();

  const { invites: _invites } = useMatchInvitesContext();
  const { isOnline } = useOnlinePresence();
  const { typingUsers, broadcastTyping } = useTypingIndicator(selectedConvId);

  const blockedIds = useMemo(() => new Set((blockedUsers || []).map(b => b.blocked_user_id)), [blockedUsers]);

  const pendingIn   = (requests || []).filter(r => r.status === 'pending' && r.receiver_id === user?.id);
  const pendingSent = (requests || []).filter(r => r.status === 'pending' && r.sender_id === user?.id);
  const friends     = (requests || []).filter(r => r.status === 'accepted');

  const visConvs = useMemo(() => (conversations || []).filter(c => {
    if (c.is_group) return true;
    const other = c.members?.find(m => m.user_id !== user?.id);
    return other ? !blockedIds.has(other.user_id) : true;
  }), [conversations, user?.id, blockedIds]);

  const dmConvs    = visConvs.filter(c => !c.is_group);
  const groupConvs = visConvs.filter(c => c.is_group);

  const sortPinned = (arr: Conversation[]) => [...arr].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  const filteredDMs    = sortPinned(dmConvs.filter(c => getConvName(c, user?.id || '').toLowerCase().includes(search.toLowerCase())));
  const filteredGroups = sortPinned(groupConvs.filter(c => getConvName(c, user?.id || '').toLowerCase().includes(search.toLowerCase())));

  // Memoized online status map — depends on stableOnlineUserIds via isOnline
  const onlineStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (friends || []).forEach(f => {
      const friendId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
      if (friendId) map.set(friendId, isOnline(friendId));
    });
    return map;
  }, [friends, user?.id, isOnline]);

  const filteredFriends = (friends || []).filter(f => {
    const fd = f.sender_id === user?.id ? f.receiver : f.sender;
    const s  = friendSearch.toLowerCase();
    return (fd?.name || '').toLowerCase().includes(s) || (fd?.email || '').toLowerCase().includes(s);
  });

  const onlineFriends  = filteredFriends.filter(f => {
    const friendId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    return friendId ? onlineStatusMap.get(friendId) : false;
  });
  const offlineFriends = filteredFriends.filter(f => {
    const friendId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    return friendId ? !onlineStatusMap.get(friendId) : true;
  });

  const selectedConv = visConvs.find(c => c.id === selectedConvId) ?? null;
  const convName     = selectedConv ? getConvName(selectedConv, user?.id || '') : '';
  const convAvatar   = selectedConv ? getConvAvatar(selectedConv, user?.id || '') : undefined;
  const myRole       = selectedConv ? getMyRole(selectedConv) : null;
  const dmOtherId    = selectedConv && !selectedConv.is_group ? getConvOtherUserId(selectedConv, user?.id || '') : undefined;

  const friendsList = (friends || []).map(f => {
    const fid = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    const fd  = f.sender_id === user?.id ? f.receiver : f.sender;
    return { userId: fid, name: fd?.name || 'Unknown', avatar: fd?.profile_picture_url };
  });

  const totalUnread = getTotalUnread();
  const onlineCount = (friends || []).filter(f => {
    const friendId = f.sender_id === user?.id ? f.receiver_id : f.sender_id;
    return friendId ? onlineStatusMap.get(friendId) : false;
  }).length;

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

  // Loading guard — all hooks are already called above, safe to return early here
  if (!user) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>👤</div>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Loading user data...</div>
      </div>
    );
  }

  if (convLoading && !conversations) {
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
            Create New Group
          </button>
        </div>
      </div>

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
                    <div style={{ fontSize: 13, color: C.muted }}>Start a new conversation with a friend</div>
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
                        <button onClick={() => setShowGroupCreate(true)} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: C.muted, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                          onMouseEnter={e => { e.currentTarget.style.color = C.accent; }} onMouseLeave={e => { e.currentTarget.style.color = C.muted; }}>
                          + Create a group
                        </button>
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
                    {friends.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Send a friend request to start connecting</div>}
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
                      ? <GroupAv size={40} emoji={(selectedConv as any).avatar_emoji} name={convName} />
                      : <Av name={convName} src={convAvatar} size={40} online={dmOtherId ? onlineStatusMap.get(dmOtherId) || false : false} />}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{selectedConv.is_group ? `# ${convName}` : convName}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: typingUsers.length > 0 ? C.accent : (dmOtherId && onlineStatusMap.get(dmOtherId)) ? C.online : C.muted }}>
                        {typingUsers.length > 0 ? 'typing…'
                          : selectedConv.is_group ? `${selectedConv.members.length} members`
                          : (dmOtherId && onlineStatusMap.get(dmOtherId)) ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button title={selectedConv.isPinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(selectedConv.id, !selectedConv.isPinned)}
                    style={{ width: 36, height: 36, borderRadius: 9, background: selectedConv.isPinned ? C.accentLight : C.bg, border: `1px solid ${selectedConv.isPinned ? C.accent : C.border}`, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📌</button>
                  {selectedConv.is_group && (
                    <>
                      <button title="Request Match" onClick={() => setShowGroupMatchRequest(true)}
                        style={{ height: 36, padding: '0 12px', borderRadius: 9, background: C.accent, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>Request Match</button>
                      <button title="Group settings" onClick={() => setShowGroupInfo(true)}
                        style={{ width: 36, height: 36, borderRadius: 9, background: C.bg, border: `1px solid ${C.border}`, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
                    </>
                  )}
                </div>
              </div>

              {/* Onboarding banner for new/joined groups */}
              {selectedConv.is_group && (
                <GroupOnboardingBanner
                  convId={selectedConv.id}
                  convName={convName}
                  avatarEmoji={(selectedConv as any).avatar_emoji || '🎾'}
                  isCreator={selectedConv.created_by === user?.id}
                  inviterName={(() => {
                    const creator = selectedConv.members.find(m => m.user_id === selectedConv.created_by);
                    return creator?.profile ? `${creator.profile.first_name || ''} ${creator.profile.last_name || ''}`.trim() || creator.profile.email : undefined;
                  })()}
                  memberCount={selectedConv.members.length}
                  onViewMembers={() => setShowGroupInfo(true)}
                />
              )}

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
                    placeholder={newGroupConvId === selectedConvId ? 'Say hello to the group! 👋' : `Message ${selectedConv.is_group ? `# ${convName}` : convName}… (Enter to send)`}
                    rows={1}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', resize: 'none', fontSize: 14, color: C.text, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
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
              <div style={{ fontSize: 14, color: C.muted }}>Choose a conversation from the sidebar</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Group Match Request sheet ── */}
      {selectedConv?.is_group && (
        <GroupMatchRequestSheet
          open={showGroupMatchRequest}
          onClose={() => setShowGroupMatchRequest(false)}
          conv={selectedConv}
          currentUserId={user?.id || ''}
          onConfirm={players => {
            if (players.length === 0) return;
            const [first, ...rest] = players;
            setMatchRequestQueue(rest);
            setMatchRequestTarget(first);
          }}
          onViewProfile={player => setProfilePlayer(player)}
        />
      )}

      {/* ── PlayerScheduleModal triggered from group match request ── */}
      <PlayerScheduleModal
        open={!!matchRequestTarget}
        onClose={() => {
          // Advance to next queued player, if any
          const [next, ...rest] = matchRequestQueue;
          setMatchRequestQueue(rest ?? []);
          setMatchRequestTarget(next ?? null);
        }}
        player={matchRequestTarget}
        onInviteSent={() => {
          toast.success(`Match invite sent to ${matchRequestTarget?.name}!`);
          // Advance queue
          const [next, ...rest] = matchRequestQueue;
          setMatchRequestQueue(rest ?? []);
          setMatchRequestTarget(next ?? null);
        }}
      />

      {/* ── New Group wizard ── */}
      <NewGroupModal
        open={showGroupCreate}
        onClose={() => setShowGroupCreate(false)}
        friends={friendsList}
        existingGroupNames={(groupConvs || []).map(c => c.name || '')}
        isOnlineFn={isOnline}
        isMobile={isMobile}
        createGroupChat={createGroupChat}
        onSuccess={(convId, gName) => {
          setActiveTab('chat');
          setSelectedConvId(convId);
          setNewGroupConvId(convId);
          setTimeout(() => inputRef.current?.focus(), 300);
          toast.success(`# ${gName} created!`, { duration: 4000 });
        }}
      />

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
      `}</style>
    </div>
  );
};

export default FriendsMessagesTab;
