import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Users, Clock, MapPin, Loader2, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface TimeSlot {
  start: string;
  end: string;
  participants_available: string[];
}

interface SmartSchedulingAssistantProps {
  onSelectTime?: (start: string, end: string, participants: string[]) => void;
}

export const SmartSchedulingAssistant: React.FC<SmartSchedulingAssistantProps> = ({
  onSelectTime,
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState(60);
  const [suggestions, setSuggestions] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .ilike('email', `%${searchEmail.trim()}%`)
        .limit(5);

      if (error) throw error;

      if (data && data.length > 0) {
        const user = data[0];
        const participant = {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
        };

        if (!participants.some(p => p.id === participant.id)) {
          setParticipants([...participants, participant]);
          setSearchEmail('');
          toast.success(`Added ${participant.name}`);
        } else {
          toast.info('User already added');
        }
      } else {
        toast.error('No user found with that email');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      toast.error('Failed to search user');
    } finally {
      setSearching(false);
    }
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const findCommonTimes = async () => {
    if (participants.length === 0) {
      toast.error('Add at least one participant');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduling-assistant', {
        body: {
          participants: participants.map(p => p.id),
          start_date: startDate,
          end_date: endDate,
          duration_minutes: duration,
        },
      });

      if (error) throw error;

      if (data && data.suggestions) {
        setSuggestions(data.suggestions);
        if (data.suggestions.length === 0) {
          toast.info('No common availability found in the selected date range');
        } else {
          toast.success(`Found ${data.suggestions.length} available time slots!`);
        }
      }
    } catch (error) {
      console.error('Error finding common times:', error);
      toast.error('Failed to find common times');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Scheduling Assistant
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Find the best time for everyone to play
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Participants */}
        <div className="space-y-2">
          <Label>Add Players</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUser()}
            />
            <Button 
              onClick={searchUser} 
              disabled={searching}
              variant="outline"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </div>

        {/* Participants List */}
        {participants.length > 0 && (
          <div className="space-y-2">
            <Label>Playing with ({participants.length})</Label>
            <div className="space-y-2">
              {participants.map(participant => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {participant.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{participant.name}</div>
                      <div className="text-xs text-muted-foreground">{participant.email}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParticipant(participant.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date Range and Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Match Duration (minutes)</Label>
          <Input
            type="number"
            min="30"
            max="180"
            step="15"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
          />
        </div>

        {/* Find Times Button */}
        <Button
          onClick={findCommonTimes}
          disabled={loading || participants.length === 0}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finding available times...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Find Common Availability
            </>
          )}
        </Button>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <Label>Suggested Times ({suggestions.length})</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {suggestions.map((slot, index) => (
                <Card key={index} className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {format(parseISO(slot.start), 'EEEE, MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(parseISO(slot.start), 'h:mm a')} - {format(parseISO(slot.end), 'h:mm a')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            All {participants.length + 1} players available
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onSelectTime?.(slot.start, slot.end, slot.participants_available)}
                      >
                        Select
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
