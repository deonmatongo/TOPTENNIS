import React from 'react';
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

interface AvailabilityConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  conflictingEvent?: string;
}

export const AvailabilityConfirmDialog: React.FC<AvailabilityConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  conflictingEvent,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Time Slot Appears Unavailable</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This time appears to be unavailable or overlaps with another event
              {conflictingEvent && ` (${conflictingEvent})`}.
            </p>
            <p className="font-medium">
              Would you still like to continue with the request booking?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Continue Booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
