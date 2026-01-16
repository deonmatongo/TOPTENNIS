import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Clock } from 'lucide-react';
import { AvailableSlotsList } from './AvailableSlotsList';
import { BookingModal } from './BookingModal';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { format } from 'date-fns';
type MatchBooking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string | null;
  message?: string | null;
  status?: string;
  booker_id?: string;
  opponent_id?: string;
  booker?: any;
  opponent?: any;
  proposed_date?: string | null;
  proposed_start_time?: string | null;
  proposed_end_time?: string | null;
};

interface ProposeNewTimeModalProps {
  open: boolean;
  onClose: () => void;
  booking: MatchBooking;
}

export const ProposeNewTimeModal: React.FC<ProposeNewTimeModalProps> = ({
  open,
  onClose,
  booking
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  
  const { availability } = useUserAvailability();
  const { proposeNewTime, isSlotBooked } = useMatchBookings();

  const handleSelectSlots = (slots: any[]) => {
    if (slots.length === 0) return;

    // Sort slots by time to get the earliest and latest
    const sortedSlots = [...slots].sort((a, b) => 
      a.start_time.localeCompare(b.start_time)
    );
    
    setSelectedSlot({
      date: new Date(sortedSlots[0].date),
      startTime: sortedSlots[0].start_time,
      endTime: sortedSlots[sortedSlots.length - 1].end_time,
      availabilityId: sortedSlots[0].parentId,
      selectedHours: slots
    });
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    
    try {
      await proposeNewTime(
        booking.id,
        format(selectedSlot.date, 'yyyy-MM-dd'),
        selectedSlot.startTime,
        selectedSlot.endTime
      );
      
      setShowConfirmModal(false);
      setSelectedSlot(null);
      onClose();
    } catch (error) {
      console.error('Error proposing new time:', error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Clock className="w-6 h-6 text-primary" />
              Propose New Time
            </DialogTitle>
            <DialogDescription>
              Select your available time to propose to {booking.booker?.first_name} {booking.booker?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto px-6 py-4">
            {availability && availability.length > 0 ? (
              <AvailableSlotsList
                availability={availability}
                onSelectSlots={handleSelectSlots}
                isBooked={(date, startTime, endTime) => 
                  isSlotBooked(date, startTime, endTime)
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Calendar className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Available Times</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  You haven't added any available time slots yet. Add your availability to propose a new time.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSlot && (
        <BookingModal
          open={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedSlot(null);
          }}
          onConfirm={handleConfirm}
          slot={selectedSlot}
          opponent={{
            name: `${booking.booker?.first_name} ${booking.booker?.last_name}`,
            location: booking.booker?.location || undefined
          }}
        />
      )}
    </>
  );
};
