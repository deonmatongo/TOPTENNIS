import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Calendar, MapPin, Clock, User, Trophy, Info } from 'lucide-react';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { format, parseISO, isFuture, isPast } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScheduledMatchesPageProps {
  onBack: () => void;
}

export const ScheduledMatchesPage: React.FC<ScheduledMatchesPageProps> = ({ onBack }) => {
  const { invites, getConfirmedInvites } = useMatchInvites();
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const confirmedMatches = getConfirmedInvites().filter(invite => invite.status === 'accepted');

  const upcomingMatches = confirmedMatches
    .filter(match => match.proposed_date && isFuture(parseISO(match.proposed_date)))
    .sort((a, b) => new Date(a.proposed_date!).getTime() - new Date(b.proposed_date!).getTime());

  const pastMatches = confirmedMatches
    .filter(match => match.proposed_date && isPast(parseISO(match.proposed_date)))
    .sort((a, b) => new Date(b.proposed_date!).getTime() - new Date(a.proposed_date!).getTime());

  const getOpponentInfo = (match: any) => {
    const opponent = match.sender || match.receiver;
    return {
      name: `${opponent?.first_name || ''} ${opponent?.last_name || ''}`.trim() || 'Unknown Player',
      initials: `${opponent?.first_name?.[0] || ''}${opponent?.last_name?.[0] || ''}`.toUpperCase() || 'UP',
    };
  };

  const MatchCard = ({ match, isPast = false }: { match: any; isPast?: boolean }) => {
    const opponent = getOpponentInfo(match);
    const matchDate = match.proposed_date ? parseISO(match.proposed_date) : null;

    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary/50"
        onClick={() => setSelectedMatch(match)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Opponent Avatar */}
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={match.sender?.avatar_url || match.receiver?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {opponent.initials}
              </AvatarFallback>
            </Avatar>

            {/* Match Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-lg leading-tight">{opponent.name}</h3>
                  <Badge variant={isPast ? 'secondary' : 'default'} className="mt-1">
                    {isPast ? 'Completed' : 'Upcoming'}
                  </Badge>
                </div>
              </div>

              {/* Date & Time */}
              {matchDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{format(matchDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
              )}

              {match.proposed_start_time && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    {match.proposed_start_time}
                    {match.proposed_end_time && ` - ${match.proposed_end_time}`}
                  </span>
                </div>
              )}

              {/* Location */}
              {match.court_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{match.court_location}</span>
                </div>
              )}

              {/* Message Preview */}
              {match.message && (
                <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground italic truncate">
                  "{match.message}"
                </div>
              )}
            </div>

            {/* View Details Icon */}
            <Button variant="ghost" size="icon" className="shrink-0">
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Scheduled Matches</h1>
              <p className="text-sm text-muted-foreground">View your upcoming and past matches</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-6">
        {/* Upcoming Matches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Upcoming Matches</h2>
            <Badge variant="secondary">{upcomingMatches.length}</Badge>
          </div>

          {upcomingMatches.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No upcoming matches scheduled</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check the Matching tab to find opponents
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>

        {/* Past Matches */}
        {pastMatches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Past Matches</h2>
              <Badge variant="outline">{pastMatches.length}</Badge>
            </div>

            <div className="space-y-3">
              {pastMatches.map((match) => (
                <MatchCard key={match.id} match={match} isPast />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Match Details Modal */}
      <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Match Details</DialogTitle>
            <DialogDescription>Complete information about this match</DialogDescription>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-4">
              {/* Opponent Info */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src={selectedMatch.sender?.avatar_url || selectedMatch.receiver?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                    {getOpponentInfo(selectedMatch).initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{getOpponentInfo(selectedMatch).name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedMatch.sender?.email || selectedMatch.receiver?.email}
                  </p>
                </div>
              </div>

              {/* Match Information */}
              <div className="space-y-3">
                {selectedMatch.proposed_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Date</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(selectedMatch.proposed_date), 'EEEE, MMMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                )}

                {selectedMatch.proposed_start_time && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Time</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMatch.proposed_start_time}
                        {selectedMatch.proposed_end_time && ` - ${selectedMatch.proposed_end_time}`}
                      </div>
                    </div>
                  </div>
                )}

                {selectedMatch.court_location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Location</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMatch.court_location}
                      </div>
                    </div>
                  </div>
                )}

                {selectedMatch.message && (
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Message</div>
                      <div className="text-sm text-muted-foreground italic">
                        "{selectedMatch.message}"
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Trophy className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Status</div>
                    <Badge variant={selectedMatch.status === 'accepted' ? 'default' : 'secondary'}>
                      {selectedMatch.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedMatch(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
