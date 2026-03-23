import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Bell, Trophy, Calendar, Users, TrendingUp, X,
  Filter, Search, ChevronRight, MessageCircle, UserPlus,
  CheckCircle2, Circle, Trash2, MailOpen, Mail, CheckSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import type { Notification } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import { InviteResponseDialog } from './InviteResponseDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'match_invite':
    case 'match_scheduled':
    case 'match_accepted':
    case 'match_confirmed':
    case 'match_declined':
    case 'match_cancelled':
    case 'match_rescheduled':
    case 'match_result':
      return Calendar;
    case 'achievement':
      return Trophy;
    case 'match_suggestion':
      return Users;
    case 'league_update':
      return TrendingUp;
    case 'friend_request':
    case 'friend_accepted':
      return UserPlus;
    case 'message_received':
    case 'group_invite':
      return MessageCircle;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'match_scheduled': return 'text-primary';
    case 'match_result':    return 'text-accent';
    case 'achievement':     return 'text-yellow-600';
    case 'match_suggestion':return 'text-purple-600';
    case 'league_update':   return 'text-green-600';
    default:                return 'text-muted-foreground';
  }
};

const getDestinationLabel = (type: Notification['type']): string | null => {
  switch (type) {
    case 'match_invite':
    case 'match_rescheduled':    return 'Respond to Invite';
    case 'match_accepted':
    case 'match_confirmed':
    case 'match_declined':
    case 'match_cancelled':
    case 'match_scheduled':
    case 'match_result':         return 'Go to Schedule';
    case 'match_suggestion':     return 'Find Opponents';
    case 'friend_request':
    case 'friend_accepted':      return 'Go to Friends';
    case 'message_received':
    case 'group_invite':         return 'Open Messages';
    case 'league_update':        return 'View Competition';
    case 'achievement':          return 'View Overview';
    default:                     return null;
  }
};

const formatTimeAgo = (date: Date): string => {
  const diff = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diff < 1)  return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ── Component ─────────────────────────────────────────────────────────────────

const NotificationsTab = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkRemove,
    removeNotification,
    isLoading,
  } = useNotificationsContext();
  const { invites } = useMatchInvitesContext();

  /** Resolve the actor's photo URL + initials for a notification. */
  const resolveActor = (n: Notification): { url: string | null; initials: string } => {
    const init = (name: string) =>
      name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    if (['match_invite', 'match_rescheduled', 'match_accepted', 'match_declined', 'match_cancelled'].includes(n.type)) {
      const invite = invites.find(i => i.id === n.metadata?.match_id);
      const actor = invite?.sender;
      if (actor) {
        const name = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'Player';
        return { url: (actor as any).profile_picture_url ?? null, initials: init(name) };
      }
    }
    return { url: null, initials: init(n.title) };
  };

  const [filter, setFilter]       = React.useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Multi-select state
  const [selectionMode, setSelectionMode]   = React.useState(false);
  const [selectedIds, setSelectedIds]       = React.useState<Set<string>>(new Set());

  // Invite dialog
  const [selectedInvite, setSelectedInvite]   = React.useState<any>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

  // ── Filtering ────────────────────────────────────────────────────────────

  const filteredNotifications = notifications.filter(n => {
    const matchesRead =
      filter === 'all' ||
      (filter === 'unread' && !n.read) ||
      (filter === 'read'   &&  n.read);
    const matchesType = typeFilter === 'all' || n.type === typeFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      term === '' ||
      n.title.toLowerCase().includes(term) ||
      n.message.toLowerCase().includes(term);
    return matchesRead && matchesType && matchesSearch;
  });

  // ── Selection helpers ────────────────────────────────────────────────────

  const allVisibleSelected =
    filteredNotifications.length > 0 &&
    filteredNotifications.every(n => selectedIds.has(n.id));

  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const handleBulkMarkRead = async () => {
    await bulkMarkAsRead(Array.from(selectedIds));
    exitSelectionMode();
  };

  const handleBulkMarkUnread = async () => {
    await bulkMarkAsUnread(Array.from(selectedIds));
    exitSelectionMode();
  };

  const handleBulkDelete = async () => {
    await bulkRemove(Array.from(selectedIds));
    exitSelectionMode();
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const getDestination = (notification: Notification): string | null => {
    if (notification.actionUrl) return notification.actionUrl;
    switch (notification.type) {
      case 'match_invite':
      case 'match_rescheduled':
      case 'match_accepted':
      case 'match_confirmed':
      case 'match_declined':
      case 'match_cancelled':
      case 'match_scheduled':
      case 'match_result':     return '/dashboard?tab=schedule';
      case 'match_suggestion': return '/dashboard?tab=matching';
      case 'friend_request':
      case 'friend_accepted':  return '/dashboard?tab=social';
      case 'message_received':
      case 'group_invite':     return '/dashboard?tab=social';
      case 'league_update':    return '/dashboard?tab=competition';
      case 'achievement':      return '/dashboard?tab=overview';
      default:                 return null;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (selectionMode) {
      toggleItem(notification.id);
      return;
    }

    if (!notification.read) markAsRead(notification.id);

    const inviteTypes = ['match_invite', 'match_rescheduled'];
    if (inviteTypes.includes(notification.type) && notification.metadata?.match_id) {
      const invite = invites.find(i => i.id === notification.metadata.match_id);
      if (invite && invite.status === 'pending') {
        setSelectedInvite(invite);
        setInviteDialogOpen(true);
        return;
      }
    }

    const dest = getDestination(notification);
    if (dest) navigate(dest);
  };

  // ── Selection mode toolbar ────────────────────────────────────────────────

  const selectedUnreadCount = Array.from(selectedIds).filter(id => {
    const n = notifications.find(x => x.id === id);
    return n && !n.read;
  }).length;
  const selectedReadCount = selectedIds.size - selectedUnreadCount;

  return (
    <>
      <InviteResponseDialog
        open={inviteDialogOpen}
        onClose={() => { setInviteDialogOpen(false); setSelectedInvite(null); }}
        invite={selectedInvite}
      />

      <div className="space-y-4 sm:space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs sm:text-sm">
                  {unreadCount} unread
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Stay updated with matches and league updates
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {unreadCount > 0 && !selectionMode && (
              <Button onClick={markAllAsRead} variant="outline" size="sm" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="hidden sm:inline">Mark all as read</span>
                <span className="sm:hidden">Mark all read</span>
              </Button>
            )}
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-2"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? 'Cancel' : 'Select'}
            </Button>
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <Card className="bg-card border-border shadow-tennis">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search notifications…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <div className="grid grid-cols-2 sm:flex gap-3">
                <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="match_scheduled">Matches</SelectItem>
                    <SelectItem value="match_result">Results</SelectItem>
                    <SelectItem value="match_invite">Invites</SelectItem>
                    <SelectItem value="friend_request">Friend Requests</SelectItem>
                    <SelectItem value="message_received">Messages</SelectItem>
                    <SelectItem value="achievement">Achievements</SelectItem>
                    <SelectItem value="league_update">League Updates</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Bulk action toolbar (visible only in selection mode) ───────── */}
        {selectionMode && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
            {/* Select-all checkbox */}
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAll}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-sm font-medium text-foreground mr-auto">
              {someSelected
                ? `${selectedIds.size} selected`
                : `${filteredNotifications.length} notification${filteredNotifications.length !== 1 ? 's' : ''}`}
            </span>

            {someSelected && (
              <>
                {selectedUnreadCount > 0 && (
                  <Button size="sm" variant="outline" onClick={handleBulkMarkRead} className="flex items-center gap-1.5">
                    <MailOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark read</span>
                    <span className="sm:hidden">Read</span>
                    {selectedUnreadCount > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selectedUnreadCount}</Badge>
                    )}
                  </Button>
                )}
                {selectedReadCount > 0 && (
                  <Button size="sm" variant="outline" onClick={handleBulkMarkUnread} className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark unread</span>
                    <span className="sm:hidden">Unread</span>
                    {selectedReadCount > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selectedReadCount}</Badge>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-destructive/20 text-destructive">
                    {selectedIds.size}
                  </Badge>
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Notifications list ─────────────────────────────────────────── */}
        <Card className="bg-card border-border shadow-tennis">
          <CardContent className="p-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <Bell className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                  {searchTerm || filter !== 'all' || typeFilter !== 'all'
                    ? 'No notifications match your filters'
                    : 'No notifications yet'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filter !== 'all' || typeFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : "You'll see updates about matches, achievements, and more here"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredNotifications.map(notification => {
                  const Icon      = getNotificationIcon(notification.type);
                  const iconColor  = getNotificationColor(notification.type);
                  const destLabel  = getDestinationLabel(notification.type);
                  const isClickable = !selectionMode && !!(destLabel || notification.actionUrl);
                  const isSelected  = selectedIds.has(notification.id);
                  const actor       = resolveActor(notification);

                  return (
                    <div
                      key={notification.id}
                      className={`group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 transition-colors touch-manipulation
                        ${isClickable ? 'cursor-pointer' : selectionMode ? 'cursor-pointer' : 'cursor-default'}
                        ${isSelected
                          ? 'bg-primary/10'
                          : !notification.read
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-muted/30'
                        }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Checkbox (selection mode) or icon */}
                      {selectionMode ? (
                        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(notification.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </div>
                      ) : (
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-10 h-10 sm:w-11 sm:h-11">
                            <AvatarImage src={actor.url ?? undefined} alt="" className="object-cover" />
                            <AvatarFallback className={`text-sm font-semibold ${!notification.read ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
                              {actor.initials}
                            </AvatarFallback>
                          </Avatar>
                          {/* Type icon badge */}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center ${!notification.read ? 'bg-primary/10' : 'bg-muted/60'}`}>
                            <Icon className={`w-2.5 h-2.5 ${iconColor}`} />
                          </span>
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-sm sm:text-base font-semibold truncate ${
                                !notification.read ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                              <span>{formatTimeAgo(notification.createdAt)}</span>
                              <Badge variant="outline" className="text-xs">
                                {notification.type.replace(/_/g, ' ')}
                              </Badge>
                              {isClickable && destLabel && (
                                <span className="flex items-center gap-0.5 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  {destLabel}
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Per-row actions (hidden in selection mode) */}
                          {!selectionMode && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isClickable && (
                                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                              )}
                              {/* Mark as read / unread toggle */}
                              <Button
                                variant="ghost"
                                size="icon"
                                title={notification.read ? 'Mark as unread' : 'Mark as read'}
                                className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => {
                                  e.stopPropagation();
                                  notification.read
                                    ? markAsUnread(notification.id)
                                    : markAsRead(notification.id);
                                }}
                              >
                                {notification.read
                                  ? <Circle className="w-4 h-4 text-primary" />
                                  : <MailOpen className="w-4 h-4" />
                                }
                              </Button>
                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                onClick={e => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
};

export default NotificationsTab;
