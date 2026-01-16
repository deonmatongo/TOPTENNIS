import React, { useMemo } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { format, isToday, isTomorrow, isThisWeek, addDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, MapPin, Users, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ListViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, time: string) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  events,
  currentDate,
  onEventClick,
}) => {
  const groupedEvents = useMemo(() => {
    const now = new Date();
    const sortedEvents = [...events]
      .filter(e => e.startTime >= now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const groups: { [key: string]: CalendarEvent[] } = {
      'Today': [],
      'Tomorrow': [],
      'This Week': [],
      'Later': [],
    };

    sortedEvents.forEach((event) => {
      if (isToday(event.startTime)) {
        groups['Today'].push(event);
      } else if (isTomorrow(event.startTime)) {
        groups['Tomorrow'].push(event);
      } else if (isThisWeek(event.startTime, { weekStartsOn: 1 })) {
        groups['This Week'].push(event);
      } else {
        groups['Later'].push(event);
      }
    });

    return Object.entries(groups).filter(([_, evts]) => evts.length > 0);
  }, [events]);

  const getEventTypeConfig = (type: CalendarEvent['type']) => {
    const configs = {
      match: { color: 'bg-green-500', label: 'Match', icon: Users },
      lesson: { color: 'bg-blue-500', label: 'Lesson', icon: Users },
      tournament: { color: 'bg-orange-500', label: 'Tournament', icon: Calendar },
      practice: { color: 'bg-purple-500', label: 'Practice', icon: Clock },
    };
    return configs[type];
  };

  const getStatusBadge = (status: CalendarEvent['status']) => {
    const variants = {
      scheduled: { variant: 'secondary' as const, label: 'Scheduled' },
      confirmed: { variant: 'default' as const, label: 'Confirmed' },
      cancelled: { variant: 'destructive' as const, label: 'Cancelled' },
      completed: { variant: 'outline' as const, label: 'Completed' },
    };
    return variants[status];
  };

  if (groupedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Upcoming Events</h3>
        <p className="text-sm text-muted-foreground">
          Click "New Event" to schedule your first match or lesson
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-6">
        {groupedEvents.map(([groupName, groupEvents]) => (
          <div key={groupName}>
            <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-background py-2">
              {groupName} ({groupEvents.length})
            </h3>
            
            <div className="space-y-3">
              {groupEvents.map((event) => {
                const typeConfig = getEventTypeConfig(event.type);
                const statusBadge = getStatusBadge(event.status);
                const Icon = typeConfig.icon;

                return (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onEventClick(event)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Date Badge */}
                        <div className="flex flex-col items-center justify-center w-16 p-2 rounded-lg bg-muted">
                          <div className="text-xs text-muted-foreground">
                            {format(event.startTime, 'MMM')}
                          </div>
                          <div className="text-2xl font-bold">
                            {format(event.startTime, 'd')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(event.startTime, 'EEE')}
                          </div>
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={cn('w-3 h-3 rounded-full', typeConfig.color)} />
                              <h4 className="font-semibold text-lg">{event.title}</h4>
                            </div>
                            <Badge {...statusBadge}>{statusBadge.label}</Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>
                                {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                              </span>
                              <Badge variant="outline" className="ml-2">
                                <Icon className="w-3 h-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                            </div>

                            {event.location && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                <span>
                                  {event.location}
                                  {event.courtNumber && ` - ${event.courtNumber}`}
                                </span>
                              </div>
                            )}

                            {event.videoCallLink && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Video className="w-4 h-4" />
                                <a
                                  href={event.videoCallLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Join Video Call
                                </a>
                              </div>
                            )}

                            {event.participants.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <div className="flex items-center gap-2">
                                  {event.participants.slice(0, 3).map((participant) => (
                                    <div key={participant.userId} className="flex items-center gap-1">
                                      <Avatar className="w-6 h-6">
                                        <AvatarImage src={participant.profilePicture} />
                                        <AvatarFallback className="text-xs">
                                          {participant.userName.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm">{participant.userName}</span>
                                    </div>
                                  ))}
                                  {event.participants.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{event.participants.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {event.description && (
                              <p className="text-muted-foreground line-clamp-2 mt-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
