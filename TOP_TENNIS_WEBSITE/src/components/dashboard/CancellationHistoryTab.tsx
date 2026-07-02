import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, XCircle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

interface CancelledInvite {
  id: string;
  sender_id: string;
  receiver_id: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location: string | null;
  message: string | null;
  cancelled_at: string;
  cancellation_reason: string | null;
  cancelled_by_user_id: string;
  sender?: {
    first_name: string;
    last_name: string;
  };
  receiver?: {
    first_name: string;
    last_name: string;
  };
}

export const CancellationHistoryTab = () => {
  const { user } = useAuth();
  const [cancelledInvites, setCancelledInvites] = useState<CancelledInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCancelledInvites();
  }, [user]);

  const fetchCancelledInvites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('match_invites')
        .select(`
          id,
          sender_id,
          receiver_id,
          date,
          start_time,
          end_time,
          court_location,
          message,
          cancelled_at,
          cancellation_reason,
          cancelled_by_user_id
        `)
        .eq('status', 'cancelled')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('cancelled_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data separately for sender and receiver
      const invitesWithProfiles = await Promise.all(
        (data || []).map(async (invite) => {
          const [senderProfile, receiverProfile] = await Promise.all([
            supabase.from('profiles').select('first_name, last_name').eq('id', invite.sender_id).single(),
            supabase.from('profiles').select('first_name, last_name').eq('id', invite.receiver_id).single()
          ]);

          return {
            ...invite,
            sender: senderProfile.data,
            receiver: receiverProfile.data
          };
        })
      );

      setCancelledInvites(invitesWithProfiles as CancelledInvite[]);
    } catch (error) {
      console.error('Error fetching cancelled invites:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cancelledInvites.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="text-muted-foreground">No cancelled invitations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Cancellation History</h2>
        <p className="text-muted-foreground mt-1">
          View all cancelled match invitations
        </p>
      </div>

      {cancelledInvites.map((invite) => {
        const isSender = invite.sender_id === user?.id;
        const wasCancelledByMe = invite.cancelled_by_user_id === user?.id;
        const otherPerson = isSender 
          ? `${invite.receiver?.first_name} ${invite.receiver?.last_name}`
          : `${invite.sender?.first_name} ${invite.sender?.last_name}`;

        return (
          <Card key={invite.id} className="border-l-4 border-l-destructive">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {isSender ? 'Sent to' : 'Received from'} {otherPerson}
                    </span>
                  </div>
                  <Badge variant="destructive" className="w-fit">
                    Cancelled
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  <p>Cancelled {format(new Date(invite.cancelled_at), 'MMM d, yyyy')}</p>
                  <p className="text-xs">{format(new Date(invite.cancelled_at), 'h:mm a')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(invite.date), 'EEEE, MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{invite.start_time} - {invite.end_time}</span>
                </div>
              </div>

              {invite.court_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{invite.court_location}</span>
                </div>
              )}

              {invite.cancellation_reason && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Cancellation Reason {wasCancelledByMe ? '(You)' : `(${otherPerson})`}
                      </p>
                      <p className="text-sm">{invite.cancellation_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {!invite.cancellation_reason && (
                <p className="text-xs text-muted-foreground italic">
                  No reason provided for cancellation
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
