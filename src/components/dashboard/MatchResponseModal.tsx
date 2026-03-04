import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, Clock, MapPin, User, Calendar as CalendarIcon, Trophy, Target, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MatchWithResponse, OpponentProfile } from '@/hooks/useMatchResponses';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PlayerProfileModal from './PlayerProfileModal';

interface MatchResponseModalProps {
  open: boolean;
  onClose: () => void;
  match: MatchWithResponse | null;
  onRespond: (action: 'accept' | 'decline' | 'propose', proposedStart?: Date, proposedEnd?: Date, comment?: string) => void;
}

const getSkillBadgeColor = (skillLevel?: number) => {
  if (!skillLevel) return 'bg-gray-100 text-gray-800 border-gray-200';
  if (skillLevel >= 8) return 'bg-red-100 text-red-800 border-red-200';
  if (skillLevel >= 6) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (skillLevel >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-green-100 text-green-800 border-green-200';
};

const getSkillLabel = (skillLevel?: number) => {
  if (!skillLevel) return 'Not rated';
  if (skillLevel >= 7) return 'Advanced';
  if (skillLevel >= 4) return 'Intermediate';
  return 'Beginner';
};

const getCompetitivenessLabel = (competitiveness?: string) => {
  switch (competitiveness) {
    case 'fun': return '🎾 Just for fun';
    case 'casual': return '😎 Casual but competitive';
    case 'competitive': return '🏆 Very competitive';
    default: return null;
  }
};

const getAgeRangeLabel = (ageRange?: string) => {
  switch (ageRange) {
    case 'under-18': return 'Under 18';
    case '18-29': return '18–29';
    case '30-39': return '30–39';
    case '40-49': return '40–49';
    case '50-59': return '50–59';
    case '60-plus': return '60+';
    default: return null;
  }
};

const OpponentProfileCard = ({ opponent, onViewFull }: { opponent: OpponentProfile; onViewFull: () => void }) => {
  const totalMatches = (opponent.wins ?? 0) + (opponent.losses ?? 0);
  const winRate = totalMatches > 0 ? Math.round(((opponent.wins ?? 0) / totalMatches) * 100) : 0;
  const initials = `${opponent.first_name?.charAt(0) ?? ''}${opponent.last_name?.charAt(0) ?? ''}`.toUpperCase() || opponent.name.charAt(0).toUpperCase();
  const competitivenessLabel = getCompetitivenessLabel(opponent.competitiveness);
  const ageRangeLabel = getAgeRangeLabel(opponent.age_range);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      {/* Header row: avatar + name + skill badge */}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage src={opponent.profile_picture_url} alt={opponent.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{opponent.name}</p>
          {opponent.city && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {opponent.city}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onViewFull} className="flex-shrink-0 text-primary hover:text-primary/80 gap-1 text-xs">
          <ExternalLink className="h-3.5 w-3.5" />
          Full Profile
        </Button>
      </div>

      {/* Skill + USTA badges */}
      <div className="flex flex-wrap gap-2">
        {opponent.skill_level !== undefined && (
          <Badge variant="outline" className={`text-xs ${getSkillBadgeColor(opponent.skill_level)}`}>
            {getSkillLabel(opponent.skill_level)} • {opponent.skill_level}/10
          </Badge>
        )}
        {opponent.usta_rating && (
          <Badge variant="secondary" className="text-xs">
            USTA {opponent.usta_rating}
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-background rounded-md p-2">
          <Trophy className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground">{opponent.wins ?? 0}</p>
          <p className="text-xs text-muted-foreground">Wins</p>
        </div>
        <div className="bg-background rounded-md p-2">
          <Target className="h-3.5 w-3.5 text-accent mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground">{winRate}%</p>
          <p className="text-xs text-muted-foreground">Win Rate</p>
        </div>
        <div className="bg-background rounded-md p-2">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground">{totalMatches}</p>
          <p className="text-xs text-muted-foreground">Played</p>
        </div>
      </div>

      {/* Extra details */}
      {(competitivenessLabel || ageRangeLabel || opponent.gender) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {opponent.gender && <span className="capitalize">{opponent.gender}</span>}
          {competitivenessLabel && <span>{competitivenessLabel}</span>}
          {ageRangeLabel && <span>Age: {ageRangeLabel}</span>}
        </div>
      )}
    </div>
  );
};

export const MatchResponseModal = ({ open, onClose, match, onRespond }: MatchResponseModalProps) => {
  const [action, setAction] = useState<'accept' | 'decline' | 'propose' | null>(null);
  const [proposedDate, setProposedDate] = useState<Date | undefined>(undefined);
  const [proposedStartTime, setProposedStartTime] = useState('09:00');
  const [proposedEndTime, setProposedEndTime] = useState('10:30');
  const [comment, setComment] = useState('');
  const [showFullProfile, setShowFullProfile] = useState(false);

  if (!match) return null;

  const matchDate = match.proposed_start ? parseISO(match.proposed_start) : parseISO(match.match_date);
  const isProposedTime = !!match.proposed_start;
  const opponent = match.opponent_profile;
  
  const handleSubmit = () => {
    if (action === 'propose') {
      if (!proposedDate) {
        return;
      }
      
      const startDateTime = new Date(proposedDate);
      const [startHour, startMinute] = proposedStartTime.split(':');
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute));
      
      const endDateTime = new Date(proposedDate);
      const [endHour, endMinute] = proposedEndTime.split(':');
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute));
      
      onRespond(action, startDateTime, endDateTime, comment || undefined);
    } else if (action) {
      onRespond(action, undefined, undefined, comment || undefined);
    }
    
    // Reset form
    setAction(null);
    setComment('');
    setProposedDate(undefined);
    setProposedStartTime('09:00');
    setProposedEndTime('10:30');
    onClose();
  };

  // Build a SearchResult-compatible object for PlayerProfileModal
  const playerForModal = opponent ? {
    id: opponent.user_id,
    user_id: opponent.user_id,
    name: opponent.name,
    email: opponent.email ?? '',
    skill_level: opponent.skill_level ?? 0,
    wins: opponent.wins ?? 0,
    losses: opponent.losses ?? 0,
    usta_rating: opponent.usta_rating,
    competitiveness: opponent.competitiveness,
    age_range: opponent.age_range,
    networking_enabled: opponent.networking_enabled,
    first_name: opponent.first_name,
    last_name: opponent.last_name,
  } : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isProposedTime ? 'Reschedule Request' : 'Match Invitation'}
          </DialogTitle>
          <DialogDescription>
            {isProposedTime 
              ? 'Your opponent has proposed a new time for this match'
              : 'You have been invited to play a match'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Opponent Profile Card */}
          {opponent && (
            <OpponentProfileCard
              opponent={opponent}
              onViewFull={() => setShowFullProfile(true)}
            />
          )}

          {/* Match Details */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            {!opponent && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">vs {match.player1?.name || match.player2?.name}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(matchDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(matchDate, 'HH:mm')}</span>
            </div>
            
            {match.court_location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{match.court_location}</span>
              </div>
            )}

            {isProposedTime && (
              <Badge variant="secondary" className="mt-2">
                <Clock className="h-3 w-3 mr-1" />
                Reschedule Request #{match.reschedule_count}
              </Badge>
            )}
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="space-y-2">
              <Label>Choose your response:</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction('accept')}
                  className="flex-col h-auto py-4 gap-2"
                >
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-xs">Accept</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setAction('propose')}
                  className="flex-col h-auto py-4 gap-2"
                  disabled={match.reschedule_count >= 3}
                >
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="text-xs">Propose New Time</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setAction('decline')}
                  className="flex-col h-auto py-4 gap-2"
                >
                  <X className="h-5 w-5 text-red-600" />
                  <span className="text-xs">Decline</span>
                </Button>
              </div>
              {match.reschedule_count >= 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  Maximum reschedule attempts reached
                </p>
              )}
            </div>
          )}

          {/* Propose New Time Form */}
          {action === 'propose' && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label>Select New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {proposedDate ? format(proposedDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={proposedDate}
                      onSelect={setProposedDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={proposedStartTime}
                    onChange={(e) => setProposedStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={proposedEndTime}
                    onChange={(e) => setProposedEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Comment */}
          {action && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="comment">Add a message (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Add any additional notes..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Action Buttons */}
          {action && (
            <div className="flex gap-2 justify-end border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null);
                  setComment('');
                  setProposedDate(undefined);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={action === 'propose' && !proposedDate}
              >
                Confirm {action === 'accept' ? 'Accept' : action === 'decline' ? 'Decline' : 'Proposal'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {playerForModal && (
      <PlayerProfileModal
        player={playerForModal}
        isOpen={showFullProfile}
        onClose={() => setShowFullProfile(false)}
      />
    )}
    </>
  );
};
