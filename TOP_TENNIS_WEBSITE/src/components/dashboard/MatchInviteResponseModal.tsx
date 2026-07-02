import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, MapPin, User, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type MatchInvite = Tables<'match_invites'> & {
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } & Partial<Tables<'players'>>;
  receiver?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } & Partial<Tables<'players'>>;
};

interface MatchInviteResponseModalProps {
  open: boolean;
  onClose: () => void;
  invite: MatchInvite | null;
  onAccept: () => void;
  onDecline: () => void;
  onProposeNewTime: (newDate: string, newStartTime: string, newEndTime: string) => void;
}

export const MatchInviteResponseModal = ({ 
  open, 
  onClose, 
  invite, 
  onAccept, 
  onDecline, 
  onProposeNewTime 
}: MatchInviteResponseModalProps) => {
  const [action, setAction] = useState<'accept' | 'decline' | 'propose' | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedStartTime, setProposedStartTime] = useState('09:00');
  const [proposedEndTime, setProposedEndTime] = useState('10:30');

  if (!invite) return null;

  const getSenderName = () => {
    return `${invite.sender?.first_name || ''} ${invite.sender?.last_name || ''}`.trim() || 'Opponent';
  };

  const getSkillBadgeColor = (skillLevel?: number | null) => {
    if (!skillLevel) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (skillLevel >= 8) return 'bg-red-100 text-red-800 border-red-200';
    if (skillLevel >= 6) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (skillLevel >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getSkillLabel = (skillLevel?: number | null) => {
    if (!skillLevel) return 'Not rated';
    if (skillLevel >= 7) return 'Advanced';
    if (skillLevel >= 4) return 'Intermediate';
    return 'Beginner';
  };

  const getCompetitivenessLabel = (competitiveness?: string | null) => {
    switch (competitiveness) {
      case 'fun': return '🎾 Just for fun';
      case 'casual': return '😎 Casual but competitive';
      case 'competitive': return '🏆 Very competitive';
      default: return 'Not specified';
    }
  };

  const getAgeRangeLabel = (ageRange?: string | null) => {
    switch (ageRange) {
      case 'under-18': return 'Under 18';
      case '18-29': return '18-29';
      case '30-39': return '30-39';
      case '40-49': return '40-49';
      case '50-59': return '50-59';
      case '60-plus': return '60+';
      default: return 'Not specified';
    }
  };

  const totalMatches = (invite.sender?.wins || 0) + (invite.sender?.losses || 0);
  const winRate = totalMatches > 0 ? Math.round(((invite.sender?.wins || 0) / totalMatches) * 100) : 0;

  const hasProposedTime = invite.proposed_date && invite.proposed_start_time && invite.proposed_end_time;

  const handleSubmit = () => {
    if (action === 'accept') {
      onAccept();
    } else if (action === 'decline') {
      onDecline();
    } else if (action === 'propose') {
      if (!proposedDate) {
        return;
      }
      onProposeNewTime(proposedDate, proposedStartTime, proposedEndTime);
    }
    
    // Reset form
    setAction(null);
    setProposedDate('');
    setProposedStartTime('09:00');
    setProposedEndTime('10:30');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match Invitation</DialogTitle>
          <DialogDescription>
            You have been invited to play a match
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Player Profile */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">vs {getSenderName()}</span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={`${getSkillBadgeColor(invite.sender?.skill_level)} text-xs`}
              >
                {getSkillLabel(invite.sender?.skill_level)} • {invite.sender?.skill_level || '?'}/10
              </Badge>
              {invite.sender?.usta_rating && (
                <Badge variant="secondary" className="text-xs">
                  USTA {invite.sender.usta_rating}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {totalMatches} matches • {winRate}% win rate
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Style:</span> {getCompetitivenessLabel(invite.sender?.competitiveness)}
              </div>
              <div>
                <span className="font-medium">Age:</span> {getAgeRangeLabel(invite.sender?.age_range)}
              </div>
              {invite.sender?.city && (
                <div className="sm:col-span-2">
                  <span className="font-medium">Location:</span> {invite.sender.city}
                </div>
              )}
            </div>
          </div>

          {/* Match Details */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(new Date(invite.date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{invite.start_time} - {invite.end_time}</span>
            </div>
            
            {invite.court_location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{invite.court_location}</span>
              </div>
            )}

            {invite.message && (
              <div className="mt-2 p-2 bg-background rounded border">
                <p className="text-sm text-muted-foreground italic">"{invite.message}"</p>
              </div>
            )}
          </div>

          {/* Proposed Time Alert */}
          {hasProposedTime && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
                New Time Proposed
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{format(new Date(invite.proposed_date!), 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>{invite.proposed_start_time} - {invite.proposed_end_time}</span>
                </div>
              </div>
            </div>
          )}

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
            </div>
          )}

          {/* Propose New Time Form */}
          {action === 'propose' && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="proposed-date">Select New Date</Label>
                <Input
                  id="proposed-date"
                  type="date"
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
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

          {/* Action Buttons */}
          {action && (
            <div className="flex gap-2 justify-end border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null);
                  setProposedDate('');
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
  );
};
