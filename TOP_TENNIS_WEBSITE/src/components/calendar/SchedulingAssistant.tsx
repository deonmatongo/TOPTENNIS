import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isSameHour } from 'date-fns';
import { Clock, Users, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParticipantAvailability, ParticipantAvailability } from '@/hooks/useParticipantAvailability';
import { EventParticipant } from '@/types/calendar';

interface SchedulingAssistantProps {
  participants: EventParticipant[];
  selectedDate: Date;
  onSelectTime?: (start: Date, end: Date) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 9 PM

export const SchedulingAssistant: React.FC<SchedulingAssistantProps> = ({
  participants,
  selectedDate,
  onSelectTime,
}) => {
  const { availabilityData, loading } = useParticipantAvailability(
    participants.map(p => p.userId),
    { start: selectedDate, end: selectedDate }
  );

  const getSlotStatus = (hour: number, participant: ParticipantAvailability) => {
    return participant.availability.some(slot => {
      const slotHour = slot.startTime.getHours();
      return slotHour === hour;
    });
  };

  const isSlotAvailableForAll = (hour: number) => {
    return availabilityData.every(p => getSlotStatus(hour, p));
  };

  const suggestedTimes = HOURS.filter(hour => isSlotAvailableForAll(hour)).slice(0, 5);

  if (participants.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Add participants to see scheduling suggestions
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Suggested Times</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading suggestions...</div>
          ) : suggestedTimes.length > 0 ? (
            <div className="space-y-2">
              {suggestedTimes.map(hour => {
                const startTime = new Date(selectedDate);
                startTime.setHours(hour, 0, 0, 0);
                const endTime = new Date(startTime);
                endTime.setHours(hour + 1);

                return (
                  <button
                    key={hour}
                    onClick={() => onSelectTime?.(startTime, endTime)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                      </span>
                    </div>
                    <Badge variant="outline" className="bg-green-50">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      All Available
                    </Badge>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No common availability found</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participant Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-4">
              {availabilityData.map((participant, idx) => (
                <div key={participant.userId}>
                  <div className="font-medium text-sm mb-2">
                    {participants[idx]?.userName || 'Player'}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className={cn(
                          "h-8 rounded text-xs flex items-center justify-center",
                          getSlotStatus(hour, participant)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {hour % 12 || 12}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
