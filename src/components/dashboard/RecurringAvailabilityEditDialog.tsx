import React, { useState } from 'react';
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
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { toast } from 'sonner';
import { Repeat, Calendar } from 'lucide-react';

interface RecurringAvailabilityEditDialogProps {
  open: boolean;
  onClose: () => void;
  availability: any;
  onEditSingle: () => void;
  onEditAll: () => void;
}

export const RecurringAvailabilityEditDialog = ({
  open,
  onClose,
  availability,
  onEditSingle,
  onEditAll,
}: RecurringAvailabilityEditDialogProps) => {
  const [loading, setLoading] = useState(false);

  const handleEditSingle = async () => {
    setLoading(true);
    try {
      onEditSingle();
      onClose();
    } catch (error) {
      toast.error('Failed to open edit dialog');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAll = async () => {
    setLoading(true);
    try {
      onEditAll();
      onClose();
    } catch (error) {
      toast.error('Failed to open edit dialog');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" />
            Edit Recurring Availability
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>This is a recurring availability slot. How would you like to edit it?</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <Calendar className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <p className="font-medium">Edit this occurrence</p>
                  <p className="text-xs text-muted-foreground">Only this specific date will be modified</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <Repeat className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <p className="font-medium">Edit all occurrences</p>
                  <p className="text-xs text-muted-foreground">All slots in this recurring series will be updated</p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleEditSingle();
            }}
            disabled={loading}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Edit This Only
          </AlertDialogAction>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleEditAll();
            }}
            disabled={loading}
          >
            Edit All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
