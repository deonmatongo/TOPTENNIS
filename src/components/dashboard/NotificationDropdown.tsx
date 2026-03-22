import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Trophy,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  X,
  Check,
  UserCheck,
  Loader2,
  Trash2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import type { Notification } from '@/hooks/useNotifications';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { InviteResponseDialog } from './InviteResponseDialog';
import PlayerProfileModal from './PlayerProfileModal';
import type { SearchResult } from '@/hooks/usePlayerSearch';

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'match_scheduled':
    case 'match_result':
      return Calendar;
    case 'achievement':
      return Trophy;
    case 'match_suggestion':
      return Users;
    case 'league_update':
      return TrendingUp;
    case 'message_received':
    case 'group_invite':
      return Bell;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'match_scheduled':
      return 'text-primary';
    case 'match_result':
      return 'text-accent';
    case 'achievement':
      return 'text-yellow-600';
    case 'match_suggestion':
      return 'text-purple-600';
    case 'league_update':
      return 'text-green-600';
    default:
      return 'text-muted-foreground';
  }
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

interface NotificationDropdownProps {
  children: React.ReactNode;
}

const NotificationDropdown = ({ children }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAllNotifications, isLoading } = useNotificationsContext();
  const { invites, respondToInvite } = useMatchInvitesContext();
  const { requests, updateRequestStatus } = useFriendRequests();
  const [isOpen, setIsOpen] = React.useState(false);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [selectedInvite, setSelectedInvite] = React.useState<any>(null);
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);
  // Per-notification action state: 'idle' | 'loading' | 'accepted' | 'declined'
  const [actionState, setActionState] = React.useState<Record<string, 'loading' | 'accepted' | 'declined'>>({});
  // Profile view state
  const [profilePlayer, setProfilePlayer] = React.useState<SearchResult | null>(null);
  const [profileInvite, setProfileInvite] = React.useState<any>(null);
  const [showProfileModal, setShowProfileModal] = React.useState(false);

  const handleViewProfile = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    const isMatchInviteType = ['match_invite', 'match_rescheduled'].includes(notification.type);
    const isFriendReqType = notification.type === 'friend_request';

    if (isMatchInviteType && notification.metadata?.match_id) {
      const invite = invites.find(i => i.id === notification.metadata.match_id);
      if (!invite?.sender) return;
      const s = invite.sender;
      setProfilePlayer({
        id: s.user_id || invite.sender_id,
        user_id: s.user_id || invite.sender_id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown Player',
        email: s.email || '',
        skill_level: s.skill_level ?? 0,
        wins: s.wins ?? 0,
        losses: s.losses ?? 0,
        usta_rating: s.usta_rating,
        competitiveness: s.competitiveness,
        age_range: s.age_range,
        gender: s.gender,
        first_name: s.first_name,
        last_name: s.last_name,
      });
      setProfileInvite(invite.status === 'pending' ? invite : null);
      setIsOpen(false);
      setShowProfileModal(true);
    } else if (isFriendReqType && notification.metadata?.sender_id) {
      const req = requests.find(r => r.sender_id === notification.metadata.sender_id);
      const senderInfo = req?.sender;
      const senderId = notification.metadata.sender_id;
      setProfilePlayer({
        id: senderId,
        user_id: senderId,
        name: senderInfo?.name || 'Player',
        email: senderInfo?.email || '',
        skill_level: 0,
        wins: 0,
        losses: 0,
      });
      setProfileInvite(null);
      setIsOpen(false);
      setShowProfileModal(true);
    }
  };

  const handleInlineMatchResponse = async (e: React.MouseEvent, notification: Notification, response: 'accepted' | 'declined') => {
    e.stopPropagation();
    const inviteId = notification.metadata?.match_id;
    if (!inviteId) return;
    setActionState(prev => ({ ...prev, [notification.id]: 'loading' }));
    try {
      await respondToInvite(inviteId, response);
      markAsRead(notification.id);
      setActionState(prev => ({ ...prev, [notification.id]: response }));
    } catch {
      setActionState(prev => { const s = { ...prev }; delete s[notification.id]; return s; });
    }
  };

  const handleInlineFriendResponse = async (e: React.MouseEvent, notification: Notification, status: 'accepted' | 'declined') => {
    e.stopPropagation();
    const senderId = notification.metadata?.sender_id;
    if (!senderId) return;
    const req = requests.find(r => r.sender_id === senderId && r.status === 'pending');
    if (!req) return;
    setActionState(prev => ({ ...prev, [notification.id]: 'loading' }));
    try {
      await updateRequestStatus(req.id, status);
      markAsRead(notification.id);
      setActionState(prev => ({ ...prev, [notification.id]: status }));
    } catch {
      setActionState(prev => { const s = { ...prev }; delete s[notification.id]; return s; });
    }
  };

  // Notifications are only marked as read when the user clicks on them individually.
  // This keeps the counter accurate — it only decreases when a notification is actually opened.

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Check if this is a match invite notification — open the invite response dialog
    const inviteTypes = ['match_invite', 'match_rescheduled'];
    if (inviteTypes.includes(notification.type) && notification.metadata?.match_id) {
      const invite = invites.find(i => i.id === notification.metadata.match_id);
      if (invite && invite.status === 'pending') {
        setSelectedInvite(invite);
        setShowInviteDialog(true);
        setIsOpen(false);
        return;
      }
    }
    
    // Navigate based on type
    const dest = notification.actionUrl
      ?? (notification.type === 'group_invite' || notification.type === 'message_received'
        ? '/dashboard?tab=social'
        : notification.type === 'friend_request' || notification.type === 'friend_accepted'
        ? '/dashboard?tab=social'
        : null);

    if (dest) {
      navigate(dest);
      setIsOpen(false);
    }
  };

  const recentNotifications = notifications.slice(0, 12);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DropdownMenuLabel className="text-base font-semibold p-0">
              Notifications
            </DropdownMenuLabel>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-auto p-1 text-primary hover:text-primary/80"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <ScrollArea className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Loading notifications...</p>
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No notifications yet</p>
              <p className="text-muted-foreground/70 text-xs mt-1">
                You'll see updates about matches, achievements, and more here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);
                
                const nState = actionState[notification.id];
                const isMatchInvite = ['match_invite', 'match_rescheduled'].includes(notification.type);
                const isFriendReq = notification.type === 'friend_request';

                // Determine if inline actions should be shown
                const showMatchActions = isMatchInvite &&
                  notification.metadata?.match_id &&
                  !nState &&
                  (() => { const inv = invites.find(i => i.id === notification.metadata?.match_id); return inv?.status === 'pending' && inv?.receiver_id !== undefined; })();

                const showFriendActions = isFriendReq &&
                  notification.metadata?.sender_id &&
                  !nState &&
                  requests.some(r => r.sender_id === notification.metadata?.sender_id && r.status === 'pending');

                return (
                  <div 
                    key={notification.id}
                    className={`group flex items-start space-x-3 p-4 transition-colors ${
                      !notification.read 
                        ? 'bg-primary/5 hover:bg-primary/10' 
                        : 'hover:bg-muted/50'
                    } ${showMatchActions || showFriendActions || nState ? 'cursor-default' : 'cursor-pointer'}`}
                    onClick={() => !(showMatchActions || showFriendActions || nState) && handleNotificationClick(notification)}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0 ${
                      !notification.read ? 'bg-primary/10' : ''
                    }`}>
                      {nState === 'accepted' ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                       nState === 'declined' ? <X className="w-4 h-4 text-muted-foreground" /> :
                       <Icon className={`w-4 h-4 ${iconColor}`} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-2">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-1 ml-2">
                          {!notification.read && !nState && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                          )}
                          {!showMatchActions && !showFriendActions && !nState && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline action buttons for match invites */}
                      {showMatchActions && (
                        <div className="flex flex-wrap gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={e => handleInlineMatchResponse(e, notification, 'accepted')}
                          >
                            <Check className="w-3 h-3 mr-1" />Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs"
                            onClick={e => handleInlineMatchResponse(e, notification, 'declined')}
                          >
                            <X className="w-3 h-3 mr-1" />Decline
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-xs text-muted-foreground"
                            onClick={e => handleViewProfile(e, notification)}
                          >
                            <Users className="w-3 h-3 mr-1" />View Profile
                          </Button>
                        </div>
                      )}

                      {/* Inline action buttons for friend requests */}
                      {showFriendActions && (
                        <div className="flex flex-wrap gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={e => handleInlineFriendResponse(e, notification, 'accepted')}
                          >
                            <UserCheck className="w-3 h-3 mr-1" />Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs"
                            onClick={e => handleInlineFriendResponse(e, notification, 'declined')}
                          >
                            <X className="w-3 h-3 mr-1" />Decline
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-xs text-muted-foreground"
                            onClick={e => handleViewProfile(e, notification)}
                          >
                            <Users className="w-3 h-3 mr-1" />View Profile
                          </Button>
                        </div>
                      )}

                      {/* Loading state */}
                      {nState === 'loading' && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />Processing...
                        </div>
                      )}

                      {/* Post-action confirmation */}
                      {(nState === 'accepted' || nState === 'declined') && (
                        <p className={`text-xs font-medium mt-2 ${
                          nState === 'accepted' ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {nState === 'accepted' ? '✓ Accepted' : '✗ Declined'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 5 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-center text-sm"
                onClick={() => navigate('/dashboard?tab=notifications')}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-center text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setIsOpen(false);
                  setShowClearConfirm(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all {notifications.length} notification{notifications.length !== 1 ? 's' : ''}. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => clearAllNotifications()}
          >
            Clear all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <InviteResponseDialog
      open={showInviteDialog}
      onClose={() => {
        setShowInviteDialog(false);
        setSelectedInvite(null);
      }}
      invite={selectedInvite}
    />

    <PlayerProfileModal
      player={profilePlayer}
      isOpen={showProfileModal}
      onClose={() => {
        setShowProfileModal(false);
        setProfilePlayer(null);
        setProfileInvite(null);
      }}
      pendingInvite={profileInvite}
      onInviteResponded={() =>
        setActionState(prev => {
          // Mark the notification that opened this profile as actioned
          const entry = Object.entries(prev).find(([, v]) => v === 'loading');
          return entry ? { ...prev, [entry[0]]: 'accepted' } : prev;
        })
      }
    />
    </>
  );
};

export default NotificationDropdown;