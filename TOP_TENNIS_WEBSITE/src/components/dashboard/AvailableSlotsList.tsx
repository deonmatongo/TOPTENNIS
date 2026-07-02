import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format, parseISO, isAfter, startOfToday } from 'date-fns';

interface AvailableSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

interface HourlySlot {
  parentId: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

interface AvailableSlotsListProps {
  availability: AvailableSlot[];
  onSelectSlots: (slots: HourlySlot[]) => void;
  isBooked?: (date: string, startTime: string, endTime: string) => boolean;
}

export const AvailableSlotsList: React.FC<AvailableSlotsListProps> = ({
  availability,
  onSelectSlots,
  isBooked = () => false,
}) => {
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  // Helper to generate hourly slots from a time range
  const generateHourlySlots = (slot: AvailableSlot): HourlySlot[] => {
    const hourlySlots: HourlySlot[] = [];
    const [startHour] = slot.start_time.split(':').map(Number);
    const [endHour] = slot.end_time.split(':').map(Number);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00:00`;
      
      // Check if this hourly slot is already booked
      if (!isBooked(slot.date, startTime, endTime)) {
        hourlySlots.push({
          parentId: slot.id,
          date: slot.date,
          start_time: startTime,
          end_time: endTime,
          notes: slot.notes
        });
      }
    }
    
    return hourlySlots;
  };

  // Generate all hourly slots from availability
  const hourlySlots = useMemo(() => {
    const today = startOfToday();
    return availability
      .filter(slot => {
        const slotDate = parseISO(slot.date);
        return isAfter(slotDate, today) || format(slotDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      })
      .flatMap(slot => generateHourlySlots(slot))
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [availability, isBooked]);

  // Group hourly slots by date
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, HourlySlot[]>();
    hourlySlots.forEach(slot => {
      if (!grouped.has(slot.date)) {
        grouped.set(slot.date, []);
      }
      grouped.get(slot.date)!.push(slot);
    });
    return grouped;
  }, [hourlySlots]);

  const getSlotKey = (slot: HourlySlot) => `${slot.date}-${slot.start_time}-${slot.end_time}`;

  const handleToggleSlot = (slot: HourlySlot) => {
    const key = getSlotKey(slot);
    const newSelected = new Set(selectedSlots);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelectedSlots(newSelected);
  };

  const handleBookSelected = () => {
    const slotsToBook = hourlySlots.filter(slot => 
      selectedSlots.has(getSlotKey(slot))
    );
    
    if (slotsToBook.length > 0) {
      onSelectSlots(slotsToBook);
      setSelectedSlots(new Set());
    }
  };

  if (hourlySlots.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No available time slots</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Available Time Slots ({hourlySlots.length} hours)
          </CardTitle>
          {selectedSlots.size > 0 && (
            <Button onClick={handleBookSelected} size="sm">
              Book {selectedSlots.size} {selectedSlots.size === 1 ? 'Hour' : 'Hours'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {Array.from(slotsByDate.entries()).map(([date, slots]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">
                    {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <Badge variant="secondary" className="ml-auto">
                    {slots.length} {slots.length === 1 ? 'hour' : 'hours'}
                  </Badge>
                </div>
                
                <div className="grid gap-2">
                  {slots.map(slot => {
                    const key = getSlotKey(slot);
                    const isSelected = selectedSlots.has(key);
                    
                    return (
                      <div
                        key={key}
                        onClick={() => handleToggleSlot(slot)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border-primary' 
                            : 'bg-card hover:bg-accent/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSlot(slot)}
                        />
                        <Clock className="w-4 h-4 text-primary" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </div>
                          {slot.notes && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {slot.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
