import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Mail, ChevronRight, CalendarCheck, Users } from 'lucide-react';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import type { Match } from '@/hooks/useMatches';
import { format, isFuture, parseISO } from 'date-fns';

interface ScheduleDashboardProps {
  matches?: Match[];
  onNavigate: (view: 'slots' | 'matches' | 'invites') => void;
}

export const ScheduleDashboard: React.FC<ScheduleDashboardProps> = ({ matches = [], onNavigate }) => {
  const { availability } = useUserAvailability();
  const { invites, getPendingInvites, getConfirmedInvites } = useMatchInvites();

  const availableSlots = availability?.filter(slot => slot.is_available && !slot.is_blocked) || [];
  const pendingInvites = getPendingInvites();
  const confirmedMatches = getConfirmedInvites().filter(invite => 
    invite.status === 'accepted' && invite.proposed_date && isFuture(parseISO(invite.proposed_date))
  );

  const getNextSlot = () => {
    if (availableSlots.length === 0) return null;
    const sorted = [...availableSlots].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted[0];
  };

  const getNextMatch = () => {
    if (confirmedMatches.length === 0) return null;
    const sorted = [...confirmedMatches].sort((a, b) => 
      new Date(a.proposed_date!).getTime() - new Date(b.proposed_date!).getTime()
    );
    return sorted[0];
  };

  const nextSlot = getNextSlot();
  const nextMatch = getNextMatch();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">My Schedule</h2>
        <p className="text-muted-foreground mt-1">Manage your availability, matches, and invitations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Available Slots Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
          onClick={() => onNavigate('slots')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">Available Slots</CardTitle>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{availableSlots.length}</span>
                <span className="text-muted-foreground">slots</span>
              </div>
              {nextSlot ? (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">Next available:</span>
                  </div>
                  <div className="ml-5">
                    {format(new Date(nextSlot.date), 'EEE, MMM d')} • {nextSlot.start_time} - {nextSlot.end_time}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming slots</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Matches Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
          onClick={() => onNavigate('matches')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CalendarCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">Scheduled Matches</CardTitle>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{confirmedMatches.length}</span>
                <span className="text-muted-foreground">upcoming</span>
              </div>
              {nextMatch ? (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">Next match:</span>
                  </div>
                  <div className="ml-5">
                    <div className="font-medium text-foreground">
                      vs {nextMatch.sender?.first_name} {nextMatch.sender?.last_name}
                    </div>
                    <div className="text-xs mt-0.5">
                      {format(parseISO(nextMatch.proposed_date!), 'EEE, MMM d')} • {nextMatch.proposed_start_time}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming matches</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invites Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
          onClick={() => onNavigate('invites')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-lg">Pending Invites</CardTitle>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{pendingInvites.length}</span>
                <span className="text-muted-foreground">pending</span>
              </div>
              {pendingInvites.length > 0 ? (
                <div className="space-y-2">
                  <Badge variant="destructive" className="w-full justify-center py-2">
                    Action Required
                  </Badge>
                  <p className="text-xs text-muted-foreground text-center">
                    {pendingInvites.length} {pendingInvites.length === 1 ? 'invite needs' : 'invites need'} your response
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pending invites</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Manage your schedule efficiently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => onNavigate('slots')}
            >
              <Calendar className="mr-2 h-4 w-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Add Availability</div>
                <div className="text-xs text-muted-foreground">Set when you're free to play</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => onNavigate('matches')}
            >
              <CalendarCheck className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">View Matches</div>
                <div className="text-xs text-muted-foreground">See your upcoming games</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-3"
              onClick={() => onNavigate('invites')}
            >
              <Mail className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Check Invites</div>
                <div className="text-xs text-muted-foreground">Respond to match requests</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
