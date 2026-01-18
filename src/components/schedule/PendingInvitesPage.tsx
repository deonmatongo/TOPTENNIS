import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Calendar, MapPin, Clock, Check, X, Mail, AlertCircle, Send, Trash2 } from 'lucide-react';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns';
import { toast } from 'sonner';
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

interface PendingInvitesPageProps {
  onBack: () => void;
}

export const PendingInvitesPage: React.FC<PendingInvitesPageProps> = ({ onBack }) => {
  const { invites, getPendingInvites, respondToInvite, deleteInvite, getOldInvites } = useMatchInvites();
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'decline' | 'delete' | null>(null);

  const pendingInvites = getPendingInvites();

  const handleRespond = (inviteId: string, action: 'accept' | 'decline') => {
    setRespondingTo(inviteId);
    setActionType(action);
  };

  const confirmResponse = async () => {
    if (!respondingTo || !actionType) return;

    try {
      if (actionType === 'delete') {
        await deleteInvite(respondingTo);
      } else {
        await respondToInvite(respondingTo, actionType === 'accept' ? 'accepted' : 'declined');
        toast.success(
          actionType === 'accept' 
            ? 'Match invitation accepted!' 
            : 'Match invitation declined'
        );
      }
    } catch (error) {
      toast.error(`Failed to ${actionType} invitation`);
    } finally {
      setRespondingTo(null);
      setActionType(null);
    }
  };

  const handleDelete = (inviteId: string) => {
    setRespondingTo(inviteId);
    setActionType('delete');
  };

  const isInviteExpired = (invite: any) => {
    if (!invite.date) return false;
    const inviteDate = new Date(invite.date);
    return isPast(inviteDate);
  };

  const getInviterInfo = (invite: any) => {
    const inviter = invite.sender || invite.proposed_by;
    return {
      name: `${inviter?.first_name || ''} ${inviter?.last_name || ''}`.trim() || 'Unknown Player',
      initials: `${inviter?.first_name?.[0] || ''}${inviter?.last_name?.[0] || ''}`.toUpperCase() || 'UP',
      email: inviter?.email || '',
    };
  };

  const InviteCard = ({ invite }: { invite: any }) => {
    const inviter = getInviterInfo(invite);
    const inviteDate = invite.date ? parseISO(invite.date) : null;
    const isExpired = isInviteExpired(invite);

    return (
      <Card className={`border-2 ${
        isExpired 
          ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10' 
          : 'border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Inviter Avatar */}
            <Avatar className="h-12 w-12 border-2 border-orange-500/30">
              <AvatarImage src={invite.sender?.avatar_url || invite.proposed_by?.avatar_url} />
              <AvatarFallback className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold">
                {inviter.initials}
              </AvatarFallback>
            </Avatar>

            {/* Invite Details */}
            <div className="flex-1 min-w-0">
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg leading-tight">{inviter.name}</h3>
                  {isExpired && (
                    <Badge variant="destructive" className="text-xs">
                      Expired
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{inviter.email}</p>
              </div>

              {/* Sent Timestamp */}
              {invite.created_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 pb-3 border-b">
                  <Send className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Sent {formatDistanceToNow(parseISO(invite.created_at), { addSuffix: true })} • {format(parseISO(invite.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                  </span>
                </div>
              )}

              {/* Match Date & Time */}
              {inviteDate && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{format(inviteDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
              )}

              {invite.proposed_start_time && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    {invite.proposed_start_time}
                    {invite.proposed_end_time && ` - ${invite.proposed_end_time}`}
                  </span>
                </div>
              )}

              {/* Location */}
              {invite.court_location && (
                <div className="flex items-center gap-2 text-sm mb-3">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{invite.court_location}</span>
                </div>
              )}

              {/* Message */}
              {invite.message && (
                <div className="mb-4 p-3 bg-background/80 rounded-lg border">
                  <p className="text-sm italic text-muted-foreground">"{invite.message}"</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                {isExpired ? (
                  <Button
                    onClick={() => handleDelete(invite.id)}
                    variant="destructive"
                    className="flex-1"
                    size="lg"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Old Invite
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleRespond(invite.id, 'accept')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      size="lg"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleRespond(invite.id, 'decline')}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                      size="lg"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
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
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">Pending Invites</h1>
              <p className="text-sm text-muted-foreground">Respond to match requests</p>
            </div>
            {pendingInvites.length > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {pendingInvites.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {pendingInvites.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground">You have no pending match invitations</p>
                <p className="text-sm text-muted-foreground mt-1">
                  New invites will appear here when players send you match requests
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Alert Banner */}
            <div className="flex items-start gap-3 p-4 bg-orange-100 dark:bg-orange-950/30 border-2 border-orange-300 dark:border-orange-900 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                  Action Required
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                  You have {pendingInvites.length} pending {pendingInvites.length === 1 ? 'invitation' : 'invitations'} waiting for your response
                </p>
              </div>
            </div>

            {/* Invites List */}
            <div className="space-y-4">
              {pendingInvites.map((invite) => (
                <InviteCard key={invite.id} invite={invite} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!respondingTo} onOpenChange={() => setRespondingTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'accept' && 'Accept Match Invitation?'}
              {actionType === 'decline' && 'Decline Match Invitation?'}
              {actionType === 'delete' && 'Delete Old Invitation?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'accept' && 'This match will be added to your schedule and the inviter will be notified.'}
              {actionType === 'decline' && 'The inviter will be notified that you declined this match request.'}
              {actionType === 'delete' && 'This invitation is for a past date and will be permanently deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResponse}
              className={
                actionType === 'accept' ? 'bg-green-600 hover:bg-green-700' : 
                actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              {actionType === 'accept' && 'Accept'}
              {actionType === 'decline' && 'Decline'}
              {actionType === 'delete' && 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
