import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  User, Trophy, Calendar, MapPin, Mail,
  Target, Flame, MessageCircle, Ban, UserMinus,
  ShieldAlert, Clock, Check, X as XIcon,
  Users, UserPlus, Swords, TrendingUp,
} from 'lucide-react';
import { SearchResult } from '@/hooks/usePlayerSearch';
import { toast } from 'sonner';
import { PlayerScheduleModal } from './PlayerScheduleModal';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

interface PendingInvite {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string;
  message?: string;
}

interface PlayerProfileModalProps {
  player: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
  pendingInvite?: PendingInvite | null;
  onInviteResponded?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const skillColor = (level: number) => {
  if (level >= 8) return { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' };
  if (level >= 6) return { bg: 'bg-orange-500', text: 'text-white', dot: 'bg-white/80' };
  if (level >= 4) return { bg: 'bg-yellow-100 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' };
  return { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' };
};

const skillLabel = (level: number) => {
  if (level >= 7) return 'Advanced';
  if (level >= 4) return 'Intermediate';
  return 'Beginner';
};

const competitivenessLabel = (v?: string) => {
  switch (v) {
    case 'fun': return 'Just for fun';
    case 'casual': return 'Casual';
    case 'competitive': return 'Competitive';
    default: return 'Not specified';
  }
};

const competitivenessIcon = (v?: string) => {
  if (v === 'competitive') return '🏆';
  if (v === 'casual') return '😎';
  if (v === 'fun') return '🎾';
  return '—';
};

const ageRangeLabel = (v?: string) => {
  const map: Record<string, string> = {
    'under-18': 'Under 18', '18-29': '18–29', '30-39': '30–39',
    '40-49': '40–49', '50-59': '50–59', '60-plus': '60+',
  };
  return v ? (map[v] ?? v) : 'Not specified';
};

const genderLabel = (v?: string | null) => {
  if (!v) return 'Not specified';
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

const experienceLabel = (total: number) => {
  if (total === 0) return 'New Player';
  if (total < 5) return 'Getting Started';
  if (total < 15) return 'Regular';
  return 'Experienced';
};

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ── Main ──────────────────────────────────────────────────────────────────────

const PlayerProfileModal = ({
  player, isOpen, onClose, pendingInvite, onInviteResponded,
}: PlayerProfileModalProps) => {
  const [showScheduleMatch, setShowScheduleMatch] = useState(false);
  const [isOpeningDM, setIsOpeningDM] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnfriendDialog, setShowUnfriendDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [inviteResponse, setInviteResponse] = useState<'accepted' | 'declined' | null>(null);
  const [isRespondingToInvite, setIsRespondingToInvite] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { sendFriendRequest, updateRequestStatus, getRelationshipWith, requests, refetch: refetchFriends } = useFriendRequests();
  const { blockUser, unfriendUser } = useBlockedUsers();
  const { respondToInvite } = useMatchInvitesContext();
  const { getOrCreateDM } = useConversationsContext();

  if (!player) return null;

  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;
  const otherUserId = player.user_id;
  const relationship = getRelationshipWith(otherUserId);
  const incomingRequest = requests.find(
    r => r.status === 'pending' && r.sender_id === otherUserId && r.receiver_id === user?.id,
  );
  const sc = skillColor(player.skill_level);

  // ── Handlers (unchanged logic) ─────────────────────────────────────────────

  const handleBlockConfirm = async () => {
    if (!player?.user_id || player?.user_id === user?.id) return;
    setIsActioning(true);
    try {
      await blockUser(player.user_id, blockReason.trim() || undefined);
      setShowBlockDialog(false);
      setBlockReason('');
      onClose();
    } catch {
      toast.error('Failed to block user');
    } finally {
      setIsActioning(false);
    }
  };

  const handleUnfriendConfirm = async () => {
    if (!player?.user_id) return;
    setIsActioning(true);
    try {
      await unfriendUser(player.user_id);
      await refetchFriends();
      setShowUnfriendDialog(false);
      onClose();
    } catch {
      toast.error('Failed to remove friend');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!otherUserId) { toast.error('This player cannot receive friend requests'); return; }
    try {
      await sendFriendRequest(otherUserId);
      toast.success('Friend request sent');
    } catch {
      toast.error('Failed to send friend request');
    }
  };

  const handleRespondToRequest = async (status: 'accepted' | 'declined') => {
    if (!incomingRequest) return;
    try {
      await updateRequestStatus(incomingRequest.id, status);
      toast.success(status === 'accepted' ? 'Friend request accepted' : 'Friend request declined');
      setTimeout(() => onClose(), 1000);
    } catch {
      toast.error('Failed to update friend request');
    }
  };

  const handleRespondToInvite = async (response: 'accepted' | 'declined') => {
    if (!pendingInvite) return;
    setIsRespondingToInvite(true);
    try {
      await respondToInvite(pendingInvite.id, response);
      setInviteResponse(response);
      onInviteResponded?.();
      setTimeout(() => onClose(), 1000);
    } catch {
      toast.error('Failed to respond to invite');
    } finally {
      setIsRespondingToInvite(false);
    }
  };

  const handleOpenMessage = async () => {
    if (!otherUserId) return;
    setIsOpeningDM(true);
    try {
      await getOrCreateDM(otherUserId);
      onClose();
      navigate('/dashboard?tab=messages');
    } catch {
      toast.error('Failed to open conversation');
    } finally {
      setIsOpeningDM(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

          {/* ── Hero header ──────────────────────────────────────────────── */}
          <div className="relative pt-5 pb-5 px-4 sm:px-5 shrink-0" style={{ background: '#F97316' }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />

            {/* Relationship badge top-right */}
            {relationship === 'friends' && (
              <div className="absolute top-3 right-4 flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white font-medium">
                <Users className="w-3 h-3" />Friends
              </div>
            )}

            <DialogTitle className="sr-only">{player.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Player profile for {player.name}
            </DialogDescription>

            <div className="relative flex items-end gap-4">
              {/* Avatar */}
              <Avatar className="w-16 h-16 rounded-full border-2 border-white/40 shadow-lg shrink-0">
                <AvatarImage
                  src={player.profile_picture_url ?? undefined}
                  alt={player.name}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-full bg-white/20 backdrop-blur-sm text-white text-2xl font-bold">
                  {initials(player.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0 pb-0.5">
                <h2 className="text-xl font-bold text-white leading-tight truncate">{player.name}</h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {/* USTA / skill badge */}
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {player.usta_rating ? `USTA ${player.usta_rating}` : `Level ${player.skill_level}`}
                    &nbsp;·&nbsp;{skillLabel(player.skill_level)}
                  </span>
                  {/* Experience */}
                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                    {experienceLabel(totalMatches)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stat strip ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0 px-4 sm:px-5 py-3 sm:py-4 bg-muted/20 border-b border-border/50">
            {[
              { label: 'Wins',    value: player.wins,   accent: 'text-green-600 dark:text-green-400' },
              { label: 'Losses',  value: player.losses, accent: 'text-red-500 dark:text-red-400' },
              { label: 'Win %',   value: `${winRate}%`, accent: 'text-primary' },
              { label: 'Played',  value: totalMatches,  accent: 'text-foreground' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl py-2.5 text-center shadow-sm">
                <p className={`text-lg font-bold leading-none ${s.accent}`}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div className="overflow-y-auto flex-1 px-3 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 space-y-3 sm:space-y-4">

            {/* Pending invite banner */}
            {pendingInvite && (
              <div className="rounded-xl border border-orange-500 bg-orange-500 p-4 space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />Match Invitation
                </p>
                <div className="space-y-1.5 text-sm text-white/90">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{format(parseISO(pendingInvite.date), 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{pendingInvite.start_time?.slice(0, 5)} – {pendingInvite.end_time?.slice(0, 5)}</span>
                  </div>
                  {pendingInvite.court_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{pendingInvite.court_location}</span>
                    </div>
                  )}
                  {pendingInvite.message && (
                    <p className="italic text-xs mt-1 opacity-80">"{pendingInvite.message}"</p>
                  )}
                </div>
                {inviteResponse ? (
                  <p className={`text-sm font-semibold ${inviteResponse === 'accepted' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {inviteResponse === 'accepted' ? '✓ Invite accepted' : '✗ Invite declined'}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleRespondToInvite('accepted')} disabled={isRespondingToInvite}>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      {isRespondingToInvite ? 'Accepting…' : 'Accept'}
                    </Button>
                    <Button size="sm" variant="outline"
                      className="flex-1 border-white/40 text-white hover:bg-white/20"
                      onClick={() => handleRespondToInvite('declined')} disabled={isRespondingToInvite}>
                      <XIcon className="w-3.5 h-3.5 mr-1" />Decline
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Player info */}
            <div className="bg-muted/30 rounded-xl divide-y divide-border/50">
              {[
                { icon: Mail,     label: 'Email',         value: player.email },
                { icon: User,     label: 'Gender',        value: genderLabel(player.gender) },
                { icon: Calendar, label: 'Age Range',     value: ageRangeLabel(player.age_range) },
                { icon: Flame,    label: 'Playing Style', value: `${competitivenessIcon(player.competitiveness)} ${competitivenessLabel(player.competitiveness)}` },
                { icon: Trophy,   label: 'Record',        value: `${player.wins}W – ${player.losses}L` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                  <span className="text-sm font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            {/* Performance bars */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />Performance
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Win Rate',    pct: winRate,                        value: `${winRate}%`,           color: 'bg-green-500' },
                  { label: 'Skill Level', pct: (player.skill_level / 10) * 100, value: `${player.skill_level}/10`, color: 'bg-primary' },
                ].map(bar => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{bar.label}</span>
                      <span className="font-semibold text-foreground">{bar.value}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${bar.color} rounded-full transition-all`} style={{ width: `${bar.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setShowScheduleMatch(true)} className="h-10 text-xs sm:text-sm">
                  <Swords className="w-4 h-4 mr-1.5 sm:mr-2" />Match Request
                </Button>
                <Button onClick={handleOpenMessage} variant="outline" className="h-10 text-xs sm:text-sm" disabled={isOpeningDM}>
                  <MessageCircle className="w-4 h-4 mr-1.5 sm:mr-2" />
                  {isOpeningDM ? 'Opening…' : 'Message'}
                </Button>
              </div>

              {/* Relationship action */}
              {relationship === 'friends' ? (
                <Button variant="outline"
                  className="w-full h-9 text-sm bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                  onClick={() => setShowUnfriendDialog(true)}>
                  <UserMinus className="w-4 h-4 mr-2" />Remove Friend
                </Button>
              ) : relationship === 'pending_sent' ? (
                <Button variant="secondary" className="w-full h-9 text-sm" disabled>
                  Friend Request Sent
                </Button>
              ) : relationship === 'pending_received' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="bg-green-600 hover:bg-green-700 h-9 text-sm"
                    onClick={() => handleRespondToRequest('accepted')}>
                    <Check className="w-3.5 h-3.5 mr-1.5" />Accept
                  </Button>
                  <Button variant="outline" className="h-9 text-sm"
                    onClick={() => handleRespondToRequest('declined')}>
                    Decline
                  </Button>
                </div>
              ) : otherUserId && otherUserId !== user?.id ? (
                <Button variant="outline" className="w-full h-9 text-sm"
                  onClick={handleSendFriendRequest}>
                  <UserPlus className="w-4 h-4 mr-2" />Add Friend
                </Button>
              ) : null}

              {/* Destructive — visually separated */}
              {player?.user_id !== user?.id && (
                <div className="pt-1 border-t border-border/50">
                  <Button variant="ghost" size="sm"
                    className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => setShowBlockDialog(true)}>
                    <Ban className="w-3.5 h-3.5 mr-1.5" />Block User
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Modals */}
          <PlayerScheduleModal open={showScheduleMatch} onClose={() => setShowScheduleMatch(false)} player={player}
            onInviteSent={() => { setShowScheduleMatch(false); onClose(); }} />
        </DialogContent>
      </Dialog>

      {/* Block dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />Block {player?.name}?
            </DialogTitle>
            <DialogDescription>
              They won't be able to message you, send match requests, or see your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1 space-y-2">
            <Label htmlFor="block-reason" className="text-sm font-medium">Reason (optional)</Label>
            <Textarea id="block-reason" placeholder="Why are you blocking this player?"
              value={blockReason} onChange={e => setBlockReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowBlockDialog(false); setBlockReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleBlockConfirm} disabled={isActioning}>
              <Ban className="w-4 h-4 mr-2" />{isActioning ? 'Blocking…' : 'Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unfriend dialog */}
      <Dialog open={showUnfriendDialog} onOpenChange={setShowUnfriendDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <UserMinus className="w-5 h-5" />Remove {player?.name}?
            </DialogTitle>
            <DialogDescription>
              This removes your connection. They won't be notified and you can reconnect later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUnfriendDialog(false)}>Cancel</Button>
            <Button variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={handleUnfriendConfirm} disabled={isActioning}>
              <UserMinus className="w-4 h-4 mr-2" />{isActioning ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlayerProfileModal;
