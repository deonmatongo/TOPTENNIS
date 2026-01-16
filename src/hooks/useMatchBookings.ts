import { useMemo } from 'react';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { useAuth } from '@/contexts/AuthContext';

// Compatibility shim for legacy match_bookings-based code.
// Internally maps match_invites to a "bookings" shape expected by existing components.
export const useMatchBookings = () => {
  const { user } = useAuth();
  const {
    invites,
    loading,
    sendInvite,
    respondToInvite,
    cancelInvite,
    proposeNewTime,
    acceptProposedTime,
    isSlotBooked,
  } = useMatchInvites();

  // Map invites to legacy "booking" objects
  const bookings = useMemo(() => {
    return (invites || []).map((i: any) => ({
      id: i.id,
      date: i.date,
      start_time: i.start_time,
      end_time: i.end_time,
      court_location: i.court_location,
      message: i.message,
      status: i.status === 'accepted' ? 'confirmed' : i.status, // preserve legacy naming
      booker_id: i.sender_id,
      opponent_id: i.receiver_id,
      booker: i.sender,
      opponent: i.receiver,
      proposed_date: i.proposed_date,
      proposed_start_time: i.proposed_start_time,
      proposed_end_time: i.proposed_end_time,
    }));
  }, [invites]);

  const createBooking = async (payload: {
    opponent_id: string;
    availability_id?: string;
    date: string;
    start_time: string;
    end_time: string;
    court_location?: string;
    message?: string;
  }) => {
    return sendInvite({
      receiver_id: payload.opponent_id,
      availability_id: payload.availability_id,
      date: payload.date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      court_location: payload.court_location,
      message: payload.message,
    });
  };

  const acceptBooking = (bookingId: string) => respondToInvite(bookingId, 'accepted');
  const declineBooking = (bookingId: string) => respondToInvite(bookingId, 'declined');
  const cancelBooking = (bookingId: string) => cancelInvite(bookingId);

  const getBookingsForSlot = (date: string, startTime: string, endTime: string) => {
    return bookings.filter(
      (b: any) => b.date === date && b.start_time === startTime && b.end_time === endTime
    );
  };

  const getPendingBookings = () => {
    return bookings.filter(
      (b: any) => b.status === 'pending' && (b.booker_id === user?.id || b.opponent_id === user?.id)
    );
  };

  return {
    bookings: bookings as any[],
    loading,
    createBooking,
    acceptBooking,
    declineBooking,
    cancelBooking,
    proposeNewTime,
    acceptProposedTime,
    isSlotBooked,
    getBookingsForSlot,
    getPendingBookings,
  };
};
