import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Trophy, Calendar, Users, TrendingUp, CheckCircle, X, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useMatchResponses } from '@/hooks/useMatchResponses';
import { MatchResponseModal } from './MatchResponseModal';
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
const NotificationsTab = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    addNotification
  } = useNotifications();
  const { pendingInvites, respondToMatch } = useMatchResponses();
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedMatch, setSelectedMatch] = React.useState<any>(null);
  const [matchModalOpen, setMatchModalOpen] = React.useState(false);

  // Filter notifications based on criteria
  const filteredNotifications = notifications.filter(notification => {
    const matchesReadFilter = filter === 'all' || filter === 'unread' && !notification.read || filter === 'read' && notification.read;
    const matchesTypeFilter = typeFilter === 'all' || notification.type === typeFilter;
    const matchesSearch = searchTerm === '' || notification.title.toLowerCase().includes(searchTerm.toLowerCase()) || notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesReadFilter && matchesTypeFilter && matchesSearch;
  });
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Check if this is a match invite/response notification
    const matchTypes = ['match_invite', 'match_rescheduled', 'match_accepted'];
    if (matchTypes.includes(notification.type) && notification.metadata?.match_id) {
      const match = pendingInvites.find(m => m.id === notification.metadata.match_id);
      if (match) {
        setSelectedMatch(match);
        setMatchModalOpen(true);
        return;
      }
    }
    
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMatchRespond = (
    action: 'accept' | 'decline' | 'propose',
    proposedStart?: Date,
    proposedEnd?: Date,
    comment?: string
  ) => {
    if (!selectedMatch) return;

    respondToMatch.mutate({
      matchId: selectedMatch.id,
      action,
      proposedStart,
      proposedEnd,
      comment
    });

    setMatchModalOpen(false);
    setSelectedMatch(null);
  };

  // Demo function to simulate new notifications
  const simulateNewNotification = () => {
    const types = ['match_scheduled', 'match_result', 'achievement', 'match_suggestion', 'league_update'] as const;
    const randomType = types[Math.floor(Math.random() * types.length)];
    const messages = {
      match_scheduled: 'Your match with Alex Rivera is scheduled for Friday at 3:00 PM',
      match_result: 'Match result: You won against Lisa Chen 6-3, 7-5',
      achievement: 'Achievement unlocked: 5-match winning streak!',
      match_suggestion: '2 new players found that match your skill level',
      league_update: 'You\'ve moved up to #3 in the Fall League standings!'
    };
    addNotification({
      type: randomType,
      title: randomType === 'match_scheduled' ? 'New Match Scheduled' : randomType === 'match_result' ? 'Match Result Updated' : randomType === 'achievement' ? 'Achievement Unlocked!' : randomType === 'match_suggestion' ? 'New Match Suggestions' : 'League Update',
      message: messages[randomType],
      read: false,
      actionUrl: '/dashboard?tab=' + (randomType === 'match_suggestion' ? 'matching' : 'matches')
    });
  };
  return (
    <>
      <MatchResponseModal
        open={matchModalOpen}
        onClose={() => {
          setMatchModalOpen(false);
          setSelectedMatch(null);
        }}
        match={selectedMatch}
        onRespond={handleMatchRespond}
      />
      
      <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center space-x-2 sm:space-x-3">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span>Notifications</span>
            {unreadCount > 0 && <Badge className="bg-primary text-primary-foreground text-xs sm:text-sm">
                {unreadCount} unread
              </Badge>}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Stay updated with matches, achievements, and league updates
          </p>
        </div>
        
        {unreadCount > 0 && <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={markAllAsRead} variant="outline" className="flex items-center space-x-2 w-full sm:w-auto touch-target" size="sm">
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Mark all as read</span>
              <span className="sm:hidden">Mark all read</span>
            </Button>
            
            {/* Demo button to simulate new notifications */}
            <Button onClick={simulateNewNotification} variant="outline" className="flex items-center space-x-2 w-full sm:w-auto touch-target bg-primary/10 border-primary/20 hover:bg-primary/20" size="sm">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Simulate New</span>
              <span className="sm:hidden">+ New</span>
            </Button>
          </div>}
        
        {/* Always show simulate button if no unread notifications */}
        {unreadCount === 0}
      </div>

      {/* Filters and Search */}
      <Card className="bg-card border-border shadow-tennis">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search notifications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11 touch-target" />
            </div>
            
            <div className="grid grid-cols-2 sm:flex gap-3">
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="h-11 touch-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-11 touch-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="match_scheduled">Matches</SelectItem>
                  <SelectItem value="match_result">Results</SelectItem>
                  <SelectItem value="achievement">Achievements</SelectItem>
                  <SelectItem value="match_suggestion">Suggestions</SelectItem>
                  <SelectItem value="league_update">League Updates</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card className="bg-card border-border shadow-tennis">
        <CardContent className="p-0">
          {filteredNotifications.length === 0 ? <div className="p-8 sm:p-12 text-center">
              <Bell className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                {searchTerm || filter !== 'all' || typeFilter !== 'all' ? 'No notifications match your filters' : 'No notifications yet'}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {searchTerm || filter !== 'all' || typeFilter !== 'all' ? 'Try adjusting your search or filter criteria' : 'You\'ll see updates about matches, achievements, and more here'}
              </p>
            </div> : <div className="divide-y divide-border">
              {filteredNotifications.map(notification => {
            const Icon = getNotificationIcon(notification.type);
            const iconColor = getNotificationColor(notification.type);
            return <div key={notification.id} className={`group flex items-start space-x-3 sm:space-x-4 p-4 sm:p-6 cursor-pointer transition-colors touch-manipulation ${!notification.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}`} onClick={() => handleNotificationClick(notification)}>
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${!notification.read ? 'bg-primary/10' : 'bg-muted/50'}`}>
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 sm:space-x-3 mb-1 sm:mb-2">
                            <h3 className={`text-sm sm:text-base font-semibold truncate ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {notification.title}
                            </h3>
                            {!notification.read && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2 sm:mb-3 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-4 text-xs text-muted-foreground/70">
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                            <Badge variant="outline" className="text-xs self-start xs:self-auto">
                              {notification.type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity touch-target flex-shrink-0" onClick={e => {
                    e.stopPropagation();
                    removeNotification(notification.id);
                  }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>;
          })}
            </div>}
        </CardContent>
      </Card>
      </div>
    </>
  );
};
export default NotificationsTab;