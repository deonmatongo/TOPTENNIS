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
  MoreHorizontal
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import type { Notification } from '@/hooks/useNotifications';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { InviteResponseDialog } from './InviteResponseDialog';

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
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, isLoading } = useNotificationsContext();
  const { invites } = useMatchInvites();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedInvite, setSelectedInvite] = React.useState<any>(null);
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);

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
                
                return (
                  <div 
                    key={notification.id}
                    className={`group flex items-start space-x-3 p-4 cursor-pointer transition-colors ${
                      !notification.read 
                        ? 'bg-primary/5 hover:bg-primary/10' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0 ${
                      !notification.read ? 'bg-primary/10' : ''
                    }`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
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
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                          )}
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
                        </div>
                      </div>
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
      </DropdownMenuContent>
    </DropdownMenu>

    <InviteResponseDialog
      open={showInviteDialog}
      onClose={() => {
        setShowInviteDialog(false);
        setSelectedInvite(null);
      }}
      invite={selectedInvite}
    />
    </>
  );
};

export default NotificationDropdown;