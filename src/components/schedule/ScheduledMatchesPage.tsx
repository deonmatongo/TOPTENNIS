import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Calendar, MapPin, Clock, User, Trophy, Info, Trash2, XCircle } from 'lucide-react';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { format, parseISO, isFuture, isPast } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';

interface ScheduledMatchesPageProps {
  onBack: () => void;
}

export const ScheduledMatchesPage: React.FC<ScheduledMatchesPageProps> = ({ onBack }) => {
  const { invites, getConfirmedInvites, deleteInvite, cancelInvite } = useMatchInvites();
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null);
  const [cancellingMatch, setCancellingMatch] = useState<string | null>(null);

  const confirmedMatches = getConfirmedInvites().filter(invite => invite.status === 'accepted');

  const upcomingMatches = confirmedMatches
    .filter(match => match.proposed_date && isFuture(parseISO(match.proposed_date)))
    .sort((a, b) => new Date(a.proposed_date!).getTime() - new Date(b.proposed_date!).getTime());

  const pastMatches = confirmedMatches
    .filter(match => match.date && isPast(parseISO(match.date)))
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

  const handleDeleteMatch = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingMatch(matchId);
  };

  const handleCancelMatch = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCancellingMatch(matchId);
  };

  const confirmDelete = async () => {
    if (!deletingMatch) return;

    try {
      await deleteInvite(deletingMatch);
      setSelectedMatch(null);
    } catch (error) {
      // Error already handled in hook
    } finally {
      setDeletingMatch(null);
    }
  };

  const confirmCancel = async () => {
    if (!cancellingMatch) return;

    try {
      await cancelInvite(cancellingMatch, 'Match cancelled by user');
      setSelectedMatch(null);
      toast.success('Match cancelled successfully');
    } catch (error) {
      // Error already handled in hook
    } finally {
      setCancellingMatch(null);
    }
  };

  const getOpponentInfo = (match: any) => {
    const opponent = match.sender || match.receiver;
    return {
      name: `${opponent?.first_name || ''} ${opponent?.last_name || ''}`.trim() || 'Unknown Player',
      initials: `${opponent?.first_name?.[0] || ''}${opponent?.last_name?.[0] || ''}`.toUpperCase() || 'UP',
    };
  };

  const MatchCard = ({ match, isPast = false }: { match: any; isPast?: boolean }) => {
    const opponent = getOpponentInfo(match);
    const matchDate = match.date ? parseISO(match.date) : null;

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
                {isPast ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={(e) => handleDeleteMatch(match.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                    onClick={(e) => handleCancelMatch(match.id, e)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Date & Time */}
              {matchDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{format(matchDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
              )}

              {match.start_time && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    {match.start_time}
                    {match.end_time && ` - ${match.end_time}`}
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
                {selectedMatch.date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Date</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(selectedMatch.date), 'EEEE, MMMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                )}

                {selectedMatch.start_time && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Time</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMatch.start_time}
                        {selectedMatch.end_time && ` - ${selectedMatch.end_time}`}
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
                {selectedMatch.date && isPast(parseISO(selectedMatch.date)) ? (
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMatch(selectedMatch.id, e);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Old Match
                  </Button>
                ) : selectedMatch.proposed_date && isFuture(parseISO(selectedMatch.proposed_date)) && (
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelMatch(selectedMatch.id, e);
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Match
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setSelectedMatch(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMatch} onOpenChange={() => setDeletingMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Old Match?</AlertDialogTitle>
            <AlertDialogDescription>
              This match is from a past date and will be permanently deleted from your schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Match Confirmation Dialog */}
      <AlertDialog open={!!cancellingMatch} onOpenChange={() => setCancellingMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel This Match?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this upcoming match? Your opponent will be notified of the cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Match</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Cancel Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
