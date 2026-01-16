import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Trash2, Plus } from 'lucide-react';
import { format, isSameDay, isBefore, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { cn } from '@/lib/utils';
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

type MatchInvite = Tables<'match_invites'> & {
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  receiver?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
};

interface ScheduleSidebarProps {
  selectedDate: Date;
  availability: Tables<'user_availability'>[];
  upcomingMatches: MatchInvite[];
  userId?: string;
  onAddAvailability?: () => void;
}

export const ScheduleSidebar: React.FC<ScheduleSidebarProps> = ({
  selectedDate,
  availability,
  upcomingMatches,
  userId,
  onAddAvailability,
}) => {
  const { deleteAvailability } = useUserAvailability();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const dayOfWeek = format(selectedDate, 'EEEE');
  const fullDate = format(selectedDate, 'MMMM d');
  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

  // Get availability slots for the selected date
  const selectedDateAvailability = availability.filter(
    (slot) => isSameDay(new Date(slot.date), selectedDate) && slot.is_available && !slot.is_blocked
  );

  // Get confirmed matches sorted by date
  const confirmedMatches = upcomingMatches
    .filter(m => m.status === 'accepted')
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.start_time}`);
      const dateB = new Date(`${b.date}T${b.start_time}`);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  const handleDeleteClick = (slotId: string) => {
    setSlotToDelete(slotId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!slotToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteAvailability(slotToDelete);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSlotToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selected Date Card */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">{dayOfWeek}, {fullDate}</CardTitle>
            {!isPastDate && onAddAvailability && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onAddAvailability}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedDateAvailability.length > 0 ? (
            <div className="space-y-3">
              {selectedDateAvailability.map((slot, index) => (
                <div 
                  key={slot.id} 
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10",
                    "hover:bg-primary/10 transition-colors group animate-scale-in"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </p>
                      <p className="text-xs text-muted-foreground">Available</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(slot.id)}
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-3 rounded-full bg-muted mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No availability set</p>
              {!isPastDate ? (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={onAddAvailability}
                  className="text-xs mt-1"
                >
                  Add availability for this day
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">This date is in the past</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Matches Card */}
      <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Upcoming Matches</CardTitle>
        </CardHeader>
        <CardContent>
          {confirmedMatches.length > 0 ? (
            <div className="space-y-3">
              {confirmedMatches.map((match, index) => {
                const opponent = match.sender_id === userId ? match.receiver : match.sender;
                const opponentName = opponent ? `${opponent.first_name} ${opponent.last_name}` : 'Unknown';
                
                return (
                  <div 
                    key={match.id} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-muted/70 transition-colors animate-scale-in"
                    style={{ animationDelay: `${(index + 1) * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{opponentName}</p>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(match.date), 'MMM d')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {match.start_time.slice(0, 5)}
                      </span>
                      {match.court_location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {match.court_location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-3 rounded-full bg-muted mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No upcoming matches</p>
              <p className="text-xs text-muted-foreground mt-1">Accepted match invites will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Availability</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this availability slot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
