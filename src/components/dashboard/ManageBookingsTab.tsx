import React, { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, X, Check, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManageBookingsFilters } from './ManageBookingsFilters';
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

export const ManageBookingsTab = () => {
  const { user } = useAuth();
  const { bookings, acceptBooking, declineBooking, cancelBooking, loading: bookingsLoading } = useMatchBookings();
  const { invites, respondToInvite, cancelInvite, loading: invitesLoading } = useMatchInvites();
  const [cancelTarget, setCancelTarget] = useState<{ type: 'booking' | 'invite', id: string } | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [locationFilter, setLocationFilter] = useState('');

  // Helper to get urgency badge
  const getUrgencyBadge = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const hoursUntilExpiry = differenceInHours(new Date(expiresAt), new Date());
    
    if (hoursUntilExpiry < 0) return <Badge variant="outline" className="text-xs">Expired</Badge>;
    if (hoursUntilExpiry < 24) {
      return (
        <Badge variant="destructive" className="text-xs animate-pulse">
          <Clock className="w-3 h-3 mr-1" />
          {hoursUntilExpiry}h
        </Badge>
      );
    }
    if (hoursUntilExpiry < 48) {
      return <Badge variant="secondary" className="text-xs">{hoursUntilExpiry}h left</Badge>;
    }
    return null;
  };

  const allFilteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const opponentName = booking.booker_id === user?.id
        ? `${booking.opponent?.first_name || ''} ${booking.opponent?.last_name || ''}`
        : `${booking.booker?.first_name || ''} ${booking.booker?.last_name || ''}`;
      
      if (searchQuery && !opponentName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
      if (dateFilter && format(new Date(booking.date), 'yyyy-MM-dd') !== format(dateFilter, 'yyyy-MM-dd')) return false;
      if (locationFilter && !booking.court_location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      return true;
    });
  }, [bookings, searchQuery, statusFilter, dateFilter, locationFilter, user]);

  const allFilteredInvites = useMemo(() => {
    return invites.filter((invite) => {
      // Get opponent name from profiles
      const opponentId = invite.sender_id === user?.id ? invite.receiver_id : invite.sender_id;
      // For now, skip name filtering since profiles aren't joined
      // This would need to be enhanced in useMatchInvites hook
      
      if (statusFilter !== 'all' && invite.status !== statusFilter) return false;
      if (dateFilter && format(new Date(invite.date), 'yyyy-MM-dd') !== format(dateFilter, 'yyyy-MM-dd')) return false;
      if (locationFilter && !invite.court_location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      return true;
    });
  }, [invites, searchQuery, statusFilter, dateFilter, locationFilter, user]);

  const {
    paginatedItems: paginatedBookings,
    currentPage: bookingsPage,
    totalPages: bookingsTotalPages,
    nextPage: bookingsNextPage,
    previousPage: bookingsPreviousPage,
    hasNextPage: bookingsHasNextPage,
    hasPreviousPage: bookingsHasPreviousPage,
  } = usePagination(allFilteredBookings, 10);

  const {
    paginatedItems: paginatedInvites,
    currentPage: invitesPage,
    totalPages: invitesTotalPages,
    nextPage: invitesNextPage,
    previousPage: invitesPreviousPage,
    hasNextPage: invitesHasNextPage,
    hasPreviousPage: invitesHasPreviousPage,
  } = usePagination(allFilteredInvites, 10);

  const confirmedBookings = paginatedBookings.filter(b => b.status === 'confirmed');
  const pendingBookingsSent = paginatedBookings.filter(b => b.status === 'pending' && b.booker_id === user?.id);
  const pendingBookingsReceived = paginatedBookings.filter(b => b.status === 'pending' && b.opponent_id === user?.id);
  const pendingInvitesSent = paginatedInvites.filter(i => i.status === 'pending' && i.sender_id === user?.id);
  const pendingInvitesReceived = paginatedInvites.filter(i => i.status === 'pending' && i.receiver_id === user?.id);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    
    try {
      if (cancelTarget.type === 'booking') {
        await cancelBooking(cancelTarget.id);
      } else {
        await cancelInvite(cancelTarget.id);
      }
    } finally {
      setCancelTarget(null);
    }
  };

  const BookingCard = ({ booking, showActions = false }: { booking: any, showActions?: boolean }) => {
    const isBooker = booking.booker_id === user?.id;
    const otherPerson = isBooker ? booking.opponent : booking.booker;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {otherPerson ? `${otherPerson.first_name} ${otherPerson.last_name}` : 'Unknown'}
                </span>
                <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                  {booking.status}
                </Badge>
                {getUrgencyBadge(booking.expires_at)}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{booking.start_time} - {booking.end_time}</span>
              </div>
              
              {booking.court_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{booking.court_location}</span>
                </div>
              )}
              
              {booking.message && (
                <p className="text-sm text-muted-foreground italic">"{booking.message}"</p>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {showActions && booking.status === 'pending' && !isBooker && (
                <>
                  <Button
                    size="sm"
                    onClick={() => acceptBooking(booking.id)}
                    className="w-full"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declineBooking(booking.id)}
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelTarget({ type: 'booking', id: booking.id })}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const InviteCard = ({ invite, showActions = false }: { invite: any, showActions?: boolean }) => {
    const isSender = invite.sender_id === user?.id;
    // Note: invite object structure doesn't include joined profiles in the current hook
    const opponentId = isSender ? invite.receiver_id : invite.sender_id;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {isSender ? 'Sent Invite' : 'Received Invite'}
                </span>
                <Badge variant="secondary">{invite.status}</Badge>
                {getUrgencyBadge(invite.expires_at)}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(invite.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{invite.start_time} - {invite.end_time}</span>
              </div>
              
              {invite.court_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{invite.court_location}</span>
                </div>
              )}
              
              {invite.message && (
                <p className="text-sm text-muted-foreground italic">"{invite.message}"</p>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {showActions && !isSender && (
                <>
                  <Button
                    size="sm"
                    onClick={() => respondToInvite(invite.id, 'accepted')}
                    className="w-full"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respondToInvite(invite.id, 'declined')}
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelTarget({ type: 'invite', id: invite.id })}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (bookingsLoading || invitesLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <>
      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelTarget?.type === 'booking' ? 'Booking' : 'Invite'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this {cancelTarget?.type === 'booking' ? 'match booking' : 'match invite'}? 
              The other player will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>Yes, cancel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manage Bookings & Invites</h1>
            <p className="text-muted-foreground mt-1">View and manage all your match bookings and invites</p>
          </div>
        </div>

        <ManageBookingsFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          locationFilter={locationFilter}
          onLocationFilterChange={setLocationFilter}
        />

        <Tabs defaultValue="confirmed" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="confirmed">
              Confirmed ({confirmedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({pendingBookingsSent.length + pendingInvitesSent.length})
            </TabsTrigger>
            <TabsTrigger value="received">
              Received ({pendingBookingsReceived.length + pendingInvitesReceived.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed" className="space-y-4 mt-4">
            {confirmedBookings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No confirmed bookings yet
                </CardContent>
              </Card>
            ) : (
              confirmedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            )}
            {bookingsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bookingsPreviousPage}
                  disabled={!bookingsHasPreviousPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {bookingsPage} of {bookingsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bookingsNextPage}
                  disabled={!bookingsHasNextPage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingBookingsSent.length === 0 && pendingInvitesSent.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pending bookings or invites sent
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingBookingsSent.map(booking => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
                {pendingInvitesSent.map(invite => (
                  <InviteCard key={invite.id} invite={invite} />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="received" className="space-y-4 mt-4">
            {pendingBookingsReceived.length === 0 && pendingInvitesReceived.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pending requests to respond to
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingBookingsReceived.map(booking => (
                  <BookingCard key={booking.id} booking={booking} showActions />
                ))}
                {pendingInvitesReceived.map(invite => (
                  <InviteCard key={invite.id} invite={invite} showActions />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};