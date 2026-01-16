import React, { useState, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { EnhancedAvailabilityModal } from '@/components/dashboard/EnhancedAvailabilityModal';
import { MatchInviteResponseModal } from '@/components/dashboard/MatchInviteResponseModal';
import { RecurringAvailabilityEditDialog } from '@/components/dashboard/RecurringAvailabilityEditDialog';
import { ConflictWarningBanner } from '@/components/dashboard/ConflictWarningBanner';
import { QuickActionPopover } from '@/components/dashboard/QuickActionPopover';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { useScheduleSettings } from '@/hooks/useScheduleSettings';
import { differenceInHours } from 'date-fns';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';

interface AvailabilityGridProps {
  currentDate: Date;
  view: 'week' | 'day';
  showWeekend?: boolean;
  showWeekday?: boolean;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM - will be dynamic later

interface QuarterInfo {
  type: 'available' | 'unavailable' | 'invite' | 'others';
  count?: number;
  status?: 'accepted' | 'pending';
  inviteId?: string;
}

// Helper function to convert time string to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Helper function to get which quarters (0-3) of an hour are covered by a time range
const getQuartersCovered = (startTime: string, endTime: string, hour: number): boolean[] => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const hourStartMinutes = hour * 60;
  const hourEndMinutes = (hour + 1) * 60;
  
  // Check if this hour is affected by the time range
  if (endMinutes <= hourStartMinutes || startMinutes >= hourEndMinutes) {
    return [false, false, false, false];
  }
  
  const quarters = [false, false, false, false];
  
  // For each 15-minute quarter (0, 15, 30, 45)
  for (let q = 0; q < 4; q++) {
    const quarterStart = hourStartMinutes + (q * 15);
    const quarterEnd = quarterStart + 15;
    
    // Check if this quarter overlaps with the availability range
    if (startMinutes < quarterEnd && endMinutes > quarterStart) {
      quarters[q] = true;
    }
  }
  
  return quarters;
};

export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({
  currentDate,
  view,
  showWeekend = true,
  showWeekday = true,
}) => {
  const { user } = useAuth();
  const { availability, createAvailability, deleteAvailability, updateAvailability, loading } = useUserAvailability();
  const { invites, respondToInvite, proposeNewTime } = useMatchInvites();
  const { settings: scheduleSettings } = useScheduleSettings();
  
  const [selecting, setSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ date: Date; hour: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<Set<string>>(new Set());
  const [hasMoved, setHasMoved] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<typeof invites[0] | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [availabilityToDelete, setAvailabilityToDelete] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [availabilityToEdit, setAvailabilityToEdit] = useState<any>(null);
  const [editingAvailability, setEditingAvailability] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  const [draggedAvailability, setDraggedAvailability] = useState<any>(null);
  const [dragStartPos, setDragStartPos] = useState<{ date: Date; hour: number } | null>(null);
  
  // Dynamic hours based on user settings
  const HOURS = useMemo(() => {
    const start = scheduleSettings.start_hour;
    const end = scheduleSettings.end_hour;
    const length = end - start;
    return Array.from({ length }, (_, i) => i + start);
  }, [scheduleSettings]);

  const days = useMemo(() => {
    if (view === 'day') {
      return [currentDate];
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    let allDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    
    // Filter days based on weekend/weekday preferences
    if (!showWeekend || !showWeekday) {
      allDays = allDays.filter(day => {
        const dayOfWeek = day.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekend && !showWeekend) return false;
        if (!isWeekend && !showWeekday) return false;
        return true;
      });
    }
    
    return allDays;
  }, [currentDate, view, showWeekend, showWeekday]);

  // Build availability map from user's availability - quarter level
  const availabilityQuartersMap = useMemo(() => {
    const map = new Map<string, QuarterInfo[]>(); // key: date-hour, value: array of 4 quarter infos
    
    availability.forEach((avail) => {
      if (!avail.is_available || avail.is_blocked) return;
      
      const date = new Date(avail.date);
      const startHour = parseInt(avail.start_time.split(':')[0]);
      const endHour = parseInt(avail.end_time.split(':')[0]);
      const endMinutes = parseInt(avail.end_time.split(':')[1] || '0');
      
      // Determine which hours are affected
      const lastHour = endMinutes > 0 ? endHour : endHour - 1;
      
      for (let hour = startHour; hour <= lastHour; hour++) {
        const key = `${format(date, 'yyyy-MM-dd')}-${hour}`;
        const quarters = getQuartersCovered(avail.start_time, avail.end_time, hour);
        
        if (!map.has(key)) {
          map.set(key, [
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
          ]);
        }
        
        const existing = map.get(key)!;
        quarters.forEach((covered, idx) => {
          if (covered) {
            existing[idx] = { type: 'available' };
          }
        });
      }
    });
    
    return map;
  }, [availability]);

  // Build invites map - quarter level
  const invitesQuartersMap = useMemo(() => {
    const map = new Map<string, QuarterInfo[]>();
    
    // Only show pending and accepted invites, exclude declined/cancelled
    invites.filter(invite => invite.status === 'pending' || invite.status === 'accepted').forEach((invite) => {
      const date = new Date(invite.date);
      const startHour = parseInt(invite.start_time.split(':')[0]);
      const endHour = parseInt(invite.end_time.split(':')[0]);
      const endMinutes = parseInt(invite.end_time.split(':')[1] || '0');
      
      const lastHour = endMinutes > 0 ? endHour : endHour - 1;
      
      for (let hour = startHour; hour <= lastHour; hour++) {
        const key = `${format(date, 'yyyy-MM-dd')}-${hour}`;
        const quarters = getQuartersCovered(invite.start_time, invite.end_time, hour);
        
        if (!map.has(key)) {
          map.set(key, [
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
          ]);
        }
        
        const existing = map.get(key)!;
        quarters.forEach((covered, idx) => {
          if (covered) {
            existing[idx] = { 
              type: 'invite', 
              status: invite.status as 'accepted' | 'pending',
              inviteId: invite.id 
            };
          }
        });
      }
    });
    
    return map;
  }, [invites]);

  const getBlockKey = (date: Date, hour: number) => {
    return `${format(date, 'yyyy-MM-dd')}-${hour}`;
  };

  const getQuartersForBlock = (date: Date, hour: number): QuarterInfo[] => {
    const key = getBlockKey(date, hour);
    const defaultQuarters: QuarterInfo[] = [
      { type: 'unavailable' },
      { type: 'unavailable' },
      { type: 'unavailable' },
      { type: 'unavailable' },
    ];
    
    // Priority: invites > availability > others > unavailable
    const inviteQuarters = invitesQuartersMap.get(key);
    const availQuarters = availabilityQuartersMap.get(key);
    
    const result = [...defaultQuarters];
    
    for (let q = 0; q < 4; q++) {
      if (inviteQuarters && inviteQuarters[q].type === 'invite') {
        result[q] = inviteQuarters[q];
      } else if (availQuarters && availQuarters[q].type === 'available') {
        result[q] = availQuarters[q];
      }
    }
    
    return result;
  };

  const isBlockAvailable = (date: Date, hour: number) => {
    const quarters = getQuartersForBlock(date, hour);
    return quarters.some(q => q.type === 'available');
  };

  const hasInvite = (date: Date, hour: number) => {
    const quarters = getQuartersForBlock(date, hour);
    return quarters.some(q => q.type === 'invite');
  };

  const handleMouseDown = (date: Date, hour: number) => {
    setSelecting(true);
    setSelectionStart({ date, hour });
    setCurrentSelection(new Set([getBlockKey(date, hour)]));
    setHasMoved(false);
  };

  const handleMouseEnter = (date: Date, hour: number) => {
    if (!selecting || !selectionStart) return;
    
    // Mark that mouse has moved
    setHasMoved(true);
    
    // Only allow selection on the same day
    if (!isSameDay(date, selectionStart.date)) return;
    
    const newSelection = new Set<string>();
    const minHour = Math.min(selectionStart.hour, hour);
    const maxHour = Math.max(selectionStart.hour, hour);
    
    for (let h = minHour; h <= maxHour; h++) {
      newSelection.add(getBlockKey(date, h));
    }
    
    setCurrentSelection(newSelection);
  };

  const handleMouseUp = async () => {
    if (!selecting || !selectionStart || currentSelection.size === 0) {
      setSelecting(false);
      setSelectionStart(null);
      setCurrentSelection(new Set());
      setHasMoved(false);
      return;
    }

    // If no movement, this was a click - open modal instead
    if (!hasMoved && currentSelection.size === 1) {
      const blockKey = Array.from(currentSelection)[0];
      const parts = blockKey.split('-');
      const hourStr = parts[parts.length - 1];
      const dateStr = parts.slice(0, -1).join('-');
      const hour = parseInt(hourStr);
      const date = new Date(dateStr);
      
      setSelecting(false);
      setSelectionStart(null);
      setCurrentSelection(new Set());
      setHasMoved(false);
      
      // Open modal for single click
      handleBlockClick(date, hour);
      return;
    }

    // Convert selection to time range
    const selectedBlocks = Array.from(currentSelection)
      .map((key) => {
        // Key format: "yyyy-MM-dd-HH" e.g., "2025-11-03-14"
        const parts = key.split('-');
        const hourStr = parts[parts.length - 1];
        const dateStr = parts.slice(0, -1).join('-');
        return { date: dateStr, hour: parseInt(hourStr) };
      })
      .sort((a, b) => a.hour - b.hour);

    if (selectedBlocks.length === 0) {
      setSelecting(false);
      setSelectionStart(null);
      setCurrentSelection(new Set());
      setHasMoved(false);
      return;
    }

    const startHour = selectedBlocks[0].hour;
    const endHour = selectedBlocks[selectedBlocks.length - 1].hour + 1;
    const date = selectedBlocks[0].date;

    // Validate time range
    if (startHour >= endHour) {
      toast.error('End time must be after start time');
      setSelecting(false);
      setSelectionStart(null);
      setCurrentSelection(new Set());
      setHasMoved(false);
      return;
    }

    // Check for pending bookings in this time slot
    const startTime = `${startHour.toString().padStart(2, '0')}:00:00`;
    const endTime = `${endHour.toString().padStart(2, '0')}:00:00`;
    
    const hasPendingBooking = invites.some(invite => {
      if (invite.status !== 'pending' && invite.status !== 'accepted') return false;
      if (invite.date !== date) return false;
      
      // Check if there's a time overlap
      return (
        (startTime >= invite.start_time && startTime < invite.end_time) ||
        (endTime > invite.start_time && endTime <= invite.end_time) ||
        (startTime <= invite.start_time && endTime >= invite.end_time)
      );
    });

    if (hasPendingBooking) {
      toast.error('Cannot create availability: there are pending or confirmed bookings for this time slot');
      setSelecting(false);
      setSelectionStart(null);
      setCurrentSelection(new Set());
      setHasMoved(false);
      return;
    }

    try {
      await createAvailability({
        date,
        start_time: startTime,
        end_time: endTime,
        is_available: true,
        privacy_level: 'public',
      });
      toast.success('Availability added successfully');
    } catch (error: any) {
      console.error('Error creating availability:', error);
      const errorMessage = error?.message || 'Failed to add availability';
      toast.error(errorMessage);
    }

    setSelecting(false);
    setSelectionStart(null);
    setCurrentSelection(new Set());
    setHasMoved(false);
  };

  const handleBlockClick = async (date: Date, hour: number, isRightClick = false) => {
    const key = getBlockKey(date, hour);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check if this is an invite slot
    const inviteForBlock = invites.find((invite) => {
      if (invite.date !== dateStr) return false;
      const startHour = parseInt(invite.start_time.split(':')[0]);
      const endHour = parseInt(invite.end_time.split(':')[0]);
      const endMinutes = parseInt(invite.end_time.split(':')[1] || '0');
      const lastHour = endMinutes > 0 ? endHour : endHour - 1;
      return hour >= startHour && hour <= lastHour;
    });
    
    if (inviteForBlock && inviteForBlock.status === 'pending' && inviteForBlock.receiver_id === user?.id) {
      // Open invite response modal for pending invites received
      setSelectedInvite(inviteForBlock);
      setInviteModalOpen(true);
      return;
    }
    
    // Find availability ID for this block
    const availForBlock = availability.find((avail) => {
      if (avail.date !== dateStr) return false;
      const startHour = parseInt(avail.start_time.split(':')[0]);
      const endHour = parseInt(avail.end_time.split(':')[0]);
      const endMinutes = parseInt(avail.end_time.split(':')[1] || '0');
      const lastHour = endMinutes > 0 ? endHour : endHour - 1;
      return hour >= startHour && hour <= lastHour;
    });
    
    if (availForBlock) {
      // Right-click or Shift+Click = Edit, Regular click = Delete
      if (isRightClick) {
        // Edit mode
        if (availForBlock.recurrence_rule) {
          // Show dialog to ask if they want to edit single or all occurrences
          setAvailabilityToEdit(availForBlock);
          setEditDialogOpen(true);
        } else {
          // Edit single availability directly
          setEditingAvailability(availForBlock);
          setModalOpen(true);
        }
      } else {
        // Delete mode (existing behavior)
        if (availForBlock.recurrence_rule) {
          // Show dialog to ask if they want to delete single or all occurrences
          setAvailabilityToDelete(availForBlock);
          setDeleteDialogOpen(true);
        } else {
          // Delete single availability directly
          try {
            await deleteAvailability(availForBlock.id);
            toast.success('Availability removed');
          } catch (error) {
            toast.error('Failed to remove availability');
          }
        }
      }
    } else {
      // Check for pending bookings before opening modal
      const hasPendingBooking = invites.some(invite => {
        if (invite.status !== 'pending' && invite.status !== 'accepted') return false;
        if (invite.date !== dateStr) return false;
        
        const startHour = parseInt(invite.start_time.split(':')[0]);
        const endHour = parseInt(invite.end_time.split(':')[0]);
        const endMinutes = parseInt(invite.end_time.split(':')[1] || '0');
        const lastHour = endMinutes > 0 ? endHour : endHour - 1;
        
        return hour >= startHour && hour <= lastHour;
      });

      if (hasPendingBooking) {
        toast.error('Cannot create availability: there are pending or confirmed bookings for this time slot');
        return;
      }

      // Open modal to create availability
      setSelectedSlot({ date, hour });
      setModalOpen(true);
    }
  };

  const handleEditSingleOccurrence = () => {
    if (!availabilityToEdit) return;
    setEditingAvailability(availabilityToEdit);
    setModalOpen(true);
    setEditDialogOpen(false);
  };

  const handleEditAllOccurrences = async () => {
    if (!availabilityToEdit) return;
    
    // For editing all occurrences, we'll need to show a special modal
    // that updates all slots with the same recurrence_rule
    setEditingAvailability({
      ...availabilityToEdit,
      editAllRecurring: true,
    });
    setModalOpen(true);
    setEditDialogOpen(false);
  };

  const handleDeleteAvailability = async (deleteAll: boolean) => {
    if (!availabilityToDelete) return;

    try {
      if (deleteAll && availabilityToDelete.recurrence_rule) {
        // Delete all occurrences with the same recurrence_rule
        // Find all availability slots with the same recurrence_rule
        const slotsToDelete = availability.filter(
          avail => avail.recurrence_rule === availabilityToDelete.recurrence_rule
        );
        
        await Promise.all(
          slotsToDelete.map(slot => deleteAvailability(slot.id))
        );
        toast.success(`Deleted ${slotsToDelete.length} recurring availability slots`);
      } else {
        // Delete only this occurrence
        await deleteAvailability(availabilityToDelete.id);
        toast.success('Availability removed');
      }
    } catch (error) {
      toast.error('Failed to remove availability');
    } finally {
      setDeleteDialogOpen(false);
      setAvailabilityToDelete(null);
    }
  };

  const clearAllAvailability = async () => {
    try {
      await Promise.all(
        availability.map((avail) => deleteAvailability(avail.id))
      );
      toast.success('All availability cleared');
    } catch (error) {
      toast.error('Failed to clear availability');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (date: Date, hour: number, avail: any) => {
    setDragging(true);
    setDraggedAvailability(avail);
    setDragStartPos({ date, hour });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (date: Date, hour: number) => {
    if (!dragging || !draggedAvailability || !dragStartPos) {
      setDragging(false);
      setDraggedAvailability(null);
      setDragStartPos(null);
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const oldDateStr = draggedAvailability.date;
    
    // Calculate time offset
    const hourOffset = hour - dragStartPos.hour;
    const oldStartHour = parseInt(draggedAvailability.start_time.split(':')[0]);
    const oldStartMinutes = parseInt(draggedAvailability.start_time.split(':')[1] || '0');
    const oldEndHour = parseInt(draggedAvailability.end_time.split(':')[0]);
    const oldEndMinutes = parseInt(draggedAvailability.end_time.split(':')[1] || '0');
    
    const newStartHour = oldStartHour + hourOffset;
    const newEndHour = oldEndHour + hourOffset;
    
    // Validate new times
    if (newStartHour < 0 || newEndHour > 24) {
      toast.error('Cannot reschedule outside valid time range');
      setDragging(false);
      setDraggedAvailability(null);
      setDragStartPos(null);
      return;
    }

    const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${oldStartMinutes.toString().padStart(2, '0')}:00`;
    const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${oldEndMinutes.toString().padStart(2, '0')}:00`;

    try {
      await updateAvailability(draggedAvailability.id, {
        date: dateStr,
        start_time: newStartTime,
        end_time: newEndTime,
      });
      toast.success('Availability rescheduled');
    } catch (error) {
      toast.error('Failed to reschedule availability');
    }

    setDragging(false);
    setDraggedAvailability(null);
    setDragStartPos(null);
  };

  return (
    <>
      <ConflictWarningBanner />
      
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Availability Selection</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllAvailability}
              disabled={availability.length === 0 || loading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>How to use:</strong> Click any red block to create availability. Click green blocks to delete. <strong>Right-click (or Shift+Click) green blocks to edit.</strong> Drag green blocks to reschedule. Each hour shows 15-minute increments for precise availability ranges.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-destructive rounded shadow-sm" />
              <span className="font-medium">Unavailable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 rounded shadow-sm" />
              <span className="font-medium">Your Availability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-purple-500 rounded shadow-sm" />
              <span className="font-medium">Confirmed Match</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-500 rounded shadow-sm" />
              <span className="font-medium">Pending Request</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Header */}
              <div className={cn("grid border-b", view === 'day' ? 'grid-cols-2' : 'grid-cols-8')}>
                <div className="p-2 border-r text-xs font-medium">Time</div>
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="p-2 text-center border-r"
                  >
                    <div className="font-semibold text-xs">{format(day, 'EEE')}</div>
                    <div className="text-lg font-bold">{format(day, 'd')}</div>
                  </div>
                ))}
              </div>

              {/* Time blocks */}
              <div 
                className="relative select-none"
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {HOURS.map((hour) => (
                  <div key={hour} className={cn("grid border-b", view === 'day' ? 'grid-cols-2' : 'grid-cols-8')}>
                    <div className="p-2 text-xs text-muted-foreground border-r flex items-center font-medium">
                      {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                    </div>

                    {days.map((day) => {
                      const key = getBlockKey(day, hour);
                      const quarters = getQuartersForBlock(day, hour);
                      const isSelected = currentSelection.has(key);
                      const isPast = new Date(day).setHours(hour) < new Date().getTime();
                      const hasAvailability = isBlockAvailable(day, hour);
                      const hasMatchInvite = hasInvite(day, hour);
                      
                      // Find the availability for this block for drag support
                      const availForBlock = availability.find((avail) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        if (avail.date !== dateStr) return false;
                        const startHour = parseInt(avail.start_time.split(':')[0]);
                        const endHour = parseInt(avail.end_time.split(':')[0]);
                        const endMinutes = parseInt(avail.end_time.split(':')[1] || '0');
                        const lastHour = endMinutes > 0 ? endHour : endHour - 1;
                        return hour >= startHour && hour <= lastHour && avail.is_available && !avail.is_blocked;
                      });

                      // Helper to get background class for a quarter
                      const getQuarterBgClass = (quarter: QuarterInfo) => {
                        if (quarter.type === 'invite') {
                          return quarter.status === 'accepted' 
                            ? 'bg-purple-500/90' 
                            : 'bg-orange-500/90';
                        } else if (quarter.type === 'available') {
                          return 'bg-green-500/90';
                        } else if (quarter.type === 'others') {
                          return 'bg-blue-500/70';
                        }
                        return 'bg-destructive/80';
                      };

                      return (
                        <div
                          key={key}
                          className={cn(
                            'min-h-[60px] border-r transition-all relative flex flex-col',
                            isPast ? 'opacity-50 cursor-not-allowed' : hasAvailability ? 'cursor-move' : 'cursor-pointer',
                            isSelected && 'ring-2 ring-green-600 ring-inset'
                          )}
                          onMouseDown={() => !isPast && !hasAvailability && handleMouseDown(day, hour)}
                          onMouseEnter={() => !isPast && !hasAvailability && handleMouseEnter(day, hour)}
                          onClick={(e) => {
                            if (isPast || selecting) return;
                            if (hasAvailability || hasMatchInvite) {
                              handleBlockClick(day, hour, e.shiftKey);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (isPast || selecting) return;
                            if (hasAvailability) {
                              handleBlockClick(day, hour, true);
                            }
                          }}
                          draggable={hasAvailability && !isPast}
                          onDragStart={(e) => {
                            if (availForBlock) {
                              handleDragStart(day, hour, availForBlock);
                            }
                          }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(day, hour);
                          }}
                        >
                          {quarters.map((quarter, qIdx) => {
                            const bgClass = getQuarterBgClass(quarter);
                            const minuteLabel = qIdx === 0 ? ':00' : qIdx === 1 ? ':15' : qIdx === 2 ? ':30' : ':45';
                            
                            return (
                              <div
                                key={qIdx}
                                className={cn(
                                  'flex-1 transition-colors relative group',
                                  bgClass,
                                  quarter.type !== 'unavailable' && 'hover:brightness-110'
                                )}
                                title={`${format(day, 'MMM d')} ${hour.toString().padStart(2, '0')}${minuteLabel} - ${quarter.type}`}
                              >
                                {/* Show count for others */}
                                {quarter.type === 'others' && quarter.count && qIdx === 1 && (
                                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                    {quarter.count}
                                  </div>
                                )}
                                {/* Show labels for invites with urgency */}
                                {quarter.type === 'invite' && qIdx === 1 && (() => {
                                  const pendingInvite = quarter.inviteId ? invites.find(inv => inv.id === quarter.inviteId) : null;
                                  const isExpiringSoon = pendingInvite?.expires_at 
                                    ? differenceInHours(new Date(pendingInvite.expires_at), new Date()) < 24 && 
                                      differenceInHours(new Date(pendingInvite.expires_at), new Date()) > 0
                                    : false;
                                  
                                  return (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      {quarter.status === 'pending' && pendingInvite ? (
                                        <QuickActionPopover invite={pendingInvite}>
                                          <div className="text-[9px] font-bold text-white cursor-pointer hover:scale-110 transition-transform">
                                            {isExpiringSoon ? '⚠️ URGENT' : 'PENDING'}
                                          </div>
                                        </QuickActionPopover>
                                      ) : (
                                        <div className="text-[9px] font-bold text-white">
                                          {quarter.status === 'accepted' ? 'Confirmed' : 'Pending'}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EnhancedAvailabilityModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSlot(null);
          setEditingAvailability(null);
        }}
        editingItem={editingAvailability}
        selectedDate={selectedSlot?.date}
        selectedStartTime={selectedSlot ? `${selectedSlot.hour.toString().padStart(2, '0')}:00` : undefined}
        selectedEndTime={selectedSlot ? `${(selectedSlot.hour + 1).toString().padStart(2, '0')}:00` : undefined}
      />

      <RecurringAvailabilityEditDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setAvailabilityToEdit(null);
        }}
        availability={availabilityToEdit}
        onEditSingle={handleEditSingleOccurrence}
        onEditAll={handleEditAllOccurrences}
      />

      <MatchInviteResponseModal
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setSelectedInvite(null);
        }}
        invite={selectedInvite}
        onAccept={async () => {
          if (selectedInvite) {
            await respondToInvite(selectedInvite.id, 'accepted');
            setInviteModalOpen(false);
            setSelectedInvite(null);
          }
        }}
        onDecline={async () => {
          if (selectedInvite) {
            await respondToInvite(selectedInvite.id, 'declined');
            setInviteModalOpen(false);
            setSelectedInvite(null);
          }
        }}
        onProposeNewTime={async (newDate, newStartTime, newEndTime) => {
          if (selectedInvite) {
            await proposeNewTime(selectedInvite.id, newDate, newStartTime, newEndTime);
            setInviteModalOpen(false);
            setSelectedInvite(null);
          }
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Cancel Availability
            </AlertDialogTitle>
            <AlertDialogDescription>
              This availability is part of a recurring series. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <Button 
              variant="outline" 
              onClick={() => handleDeleteAvailability(false)}
            >
              Cancel This Occurrence
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleDeleteAvailability(true)}
            >
              Cancel All in Series
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};