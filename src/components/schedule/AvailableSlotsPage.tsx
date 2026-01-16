import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, Trash2, MapPin } from 'lucide-react';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { EnhancedAvailabilityModal } from '@/components/dashboard/EnhancedAvailabilityModal';
import { format, addDays, subDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

interface AvailableSlotsPageProps {
  onBack: () => void;
}

export const AvailableSlotsPage: React.FC<AvailableSlotsPageProps> = ({ onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { availability, loading, deleteAvailability } = useUserAvailability();

  const availableSlots = availability?.filter(slot => slot.is_available && !slot.is_blocked) || [];

  const handlePreviousDay = () => setCurrentDate(subDays(currentDate, 1));
  const handleNextDay = () => setCurrentDate(addDays(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleAddAvailability = (date?: Date) => {
    setSelectedDate(date || currentDate);
    setShowAddModal(true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (window.confirm('Are you sure you want to delete this availability slot?')) {
      await deleteAvailability(slotId);
    }
  };

  const getSlotsForDate = (date: Date) => {
    return availableSlots.filter(slot => 
      isSameDay(parseISO(slot.date), date)
    ).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getWeekDates = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDates = getWeekDates();
  const todaySlots = getSlotsForDate(currentDate);

  const groupSlotsByDate = () => {
    const grouped: Record<string, typeof availableSlots> = {};
    availableSlots.forEach(slot => {
      const dateKey = slot.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const groupedSlots = groupSlotsByDate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Available Slots</h1>
              <p className="text-sm text-muted-foreground">Manage when you're available to play</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => handleAddAvailability()} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              Add Availability
            </Button>
            <Button variant="outline" onClick={handleToday} className="flex-1 sm:flex-none">
              Today
            </Button>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="border-b bg-muted/30">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={handlePreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
            <Button variant="ghost" size="icon" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week Days */}
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const isSelected = isSameDay(date, currentDate);
              const isToday = isSameDay(date, new Date());
              const daySlots = getSlotsForDate(date);
              const hasSlots = daySlots.length > 0;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setCurrentDate(date)}
                  className={`
                    relative p-2 rounded-lg text-center transition-all
                    ${isSelected ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted'}
                    ${isToday && !isSelected ? 'border-2 border-primary' : ''}
                  `}
                >
                  <div className="text-xs font-medium">{format(date, 'EEE')}</div>
                  <div className={`text-lg font-bold ${isSelected ? '' : isToday ? 'text-primary' : ''}`}>
                    {format(date, 'd')}
                  </div>
                  {hasSlots && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                      <div className={`h-1 w-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-6">
        {/* Selected Day Slots */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </CardTitle>
              <Badge variant="secondary">{todaySlots.length} slots</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {todaySlots.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No availability set for this day</p>
                <Button onClick={() => handleAddAvailability(currentDate)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Availability
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <Badge variant={slot.privacy_level === 'public' ? 'default' : 'secondary'}>
                          {slot.privacy_level}
                        </Badge>
                      </div>
                      {slot.notes && (
                        <p className="text-sm text-muted-foreground mb-2">{slot.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Upcoming Slots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Upcoming Availability</CardTitle>
          </CardHeader>
          <CardContent>
            {groupedSlots.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No availability slots set</p>
                <Button onClick={() => handleAddAvailability()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Slot
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedSlots.map(([date, slots]) => (
                  <div key={date}>
                    <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                      {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <div className="space-y-2">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card/50"
                        >
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {slot.start_time} - {slot.end_time}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {slot.privacy_level}
                              </Badge>
                            </div>
                            {slot.notes && (
                              <p className="text-xs text-muted-foreground truncate">{slot.notes}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="shrink-0 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Availability Modal */}
      <EnhancedAvailabilityModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate || undefined}
      />
    </div>
  );
};
