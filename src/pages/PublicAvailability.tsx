import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, Mail, Loader2, Globe } from 'lucide-react';
import { format, parseISO, isSameDay, isPast, startOfDay } from 'date-fns';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { TimezoneSelect } from '@/components/ui/TimezoneSelect';
import { convertTimeBetweenTimezones, getTimezoneDisplayName } from '@/utils/timezoneConversion';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture_url?: string;
}

interface Availability {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  timezone?: string;
}

export default function PublicAvailability() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Availability | null>(null);
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  
  // Check if this is from a league context
  const searchParams = new URLSearchParams(window.location.search);
  const isLeagueContext = searchParams.get('source') === 'league';
  const divisionId = searchParams.get('divisionId');
  const divisionName = searchParams.get('divisionName');
  
  const [viewerTimezone, setViewerTimezone] = useState<string>(() => {
    // Try to detect user's timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timezoneMap: Record<string, string> = {
        'America/New_York': 'America/New_York',
        'US/Eastern': 'America/New_York',
        'America/Chicago': 'America/Chicago',
        'US/Central': 'America/Chicago',
        'America/Denver': 'America/Denver',
        'US/Mountain': 'America/Denver',
        'America/Los_Angeles': 'America/Los_Angeles',
        'US/Pacific': 'America/Los_Angeles',
        'America/Anchorage': 'America/Anchorage',
        'US/Alaska': 'America/Anchorage',
        'Pacific/Honolulu': 'Pacific/Honolulu',
        'US/Hawaii': 'Pacific/Honolulu',
      };
      return timezoneMap[detected] || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  });

  useEffect(() => {
    if (userId) {
      fetchPublicData();
    }
  }, [userId]);

  const fetchPublicData = async () => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, profile_picture_url')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch public availability
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('user_availability')
        .select('id, date, start_time, end_time, timezone')
        .eq('user_id', userId)
        .eq('is_available', true)
        .eq('is_blocked', false)
        .eq('privacy_level', 'public')
        .gte('date', format(new Date(), 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(50);

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);
    } catch (error) {
      console.error('Error fetching public availability:', error);
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot: Availability) => {
    // Calculate duration in hours
    const [startHour, startMin] = slot.start_time.split(':').map(Number);
    const [endHour, endMin] = slot.end_time.split(':').map(Number);
    const durationHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;

    // If slot is more than 1 hour, show time selector
    if (durationHours > 1) {
      setSelectedSlot(slot);
      setCustomStartTime(slot.start_time);
      setCustomEndTime(slot.end_time);
      setShowTimeSelector(true);
    } else {
      // Book the entire slot
      requestMatch(slot.id, slot.start_time, slot.end_time);
    }
  };

  const requestMatch = async (availabilityId: string, startTime?: string, endTime?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error('Please sign in to request a match');
      navigate('/login');
      return;
    }

    try {
      const slot = availability.find(a => a.id === availabilityId);
      if (!slot) return;

      // Use custom times if provided, otherwise use slot times
      const matchStartTime = startTime || slot.start_time;
      const matchEndTime = endTime || slot.end_time;

      // If this is from a league context, create a league match
      if (isLeagueContext && divisionId) {
        const { data, error } = await supabase.rpc('create_league_match_with_invite' as any, {
          p_division_id: divisionId,
          p_player1_id: user.id,
          p_player2_id: userId,
          p_scheduled_date: slot.date,
          p_scheduled_time: matchStartTime,
          p_timezone: slot.timezone || 'America/New_York',
          p_court_location: slot.location || null,
          p_message: `League match request for ${divisionName || 'your division'}`
        });

        if (error) throw error;
        toast.success('League match request sent! 🎾');
        
        // Navigate back to league page after a short delay
        setTimeout(() => {
          navigate('/dashboard?tab=leagues');
        }, 1500);
      } else {
        // Regular match invite
        const { error } = await supabase
          .from('match_invites')
          .insert({
            sender_id: user.id,
            receiver_id: userId,
            availability_id: availabilityId,
            date: slot.date,
            start_time: matchStartTime,
            end_time: matchEndTime,
            timezone: slot.timezone || 'America/New_York',
            court_location: slot.location,
            status: 'pending',
          });

        if (error) throw error;
        toast.success('Match request sent!');
      }
    } catch (error: any) {
      console.error('Error requesting match:', error);
      toast.error(error.message || 'Failed to send match request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-20">
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The user you're looking for doesn't exist or hasn't made their availability public.
              </p>
              <Button onClick={() => navigate('/')}>Go Home</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Group availability by date
  const groupedAvailability = availability.reduce((acc, slot) => {
    const dateKey = slot.date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, Availability[]>);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-20 px-4 max-w-4xl">
        {/* League Context Banner */}
        {isLeagueContext && (
          <Card className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <Calendar className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                    🏆 League Match Scheduling
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {divisionName ? `Scheduling a match for ${divisionName}` : 'Scheduling a league match'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.profile_picture_url} />
                <AvatarFallback className="text-2xl">
                  {profile.first_name[0]}{profile.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">
                  {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Availability */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Available Times
              </CardTitle>
              
              {/* Timezone Selector */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">View in:</span>
                <div className="flex-1 sm:flex-initial min-w-[200px]">
                  <TimezoneSelect
                    value={viewerTimezone}
                    onValueChange={setViewerTimezone}
                    placeholder="Select timezone"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {availability.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No public availability at the moment
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedAvailability).map(([date, slots]) => (
                  <div key={date}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <div className="grid gap-2">
                      {slots.map(slot => {
                        // Convert times to viewer's timezone
                        const slotTimezone = slot.timezone || 'America/New_York';
                        const displayStartTime = slotTimezone !== viewerTimezone
                          ? convertTimeBetweenTimezones(slot.start_time, slotTimezone, viewerTimezone, slot.date)
                          : slot.start_time;
                        const displayEndTime = slotTimezone !== viewerTimezone
                          ? convertTimeBetweenTimezones(slot.end_time, slotTimezone, viewerTimezone, slot.date)
                          : slot.end_time;
                        
                        // Check if this slot is in the past
                        const slotDate = parseISO(slot.date);
                        const isPastDate = isPast(startOfDay(slotDate)) && !isSameDay(slotDate, new Date());
                        
                        return (
                          <Card key={slot.id} className={`transition-colors ${isPastDate ? 'opacity-50 bg-muted/50' : 'hover:border-primary'}`}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className={`font-medium ${isPastDate ? 'text-muted-foreground' : ''}`}>
                                      {displayStartTime.slice(0, 5)} - {displayEndTime.slice(0, 5)}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {getTimezoneDisplayName(viewerTimezone)}
                                    </Badge>
                                    {isPastDate && (
                                      <Badge variant="secondary" className="text-xs">
                                        Past
                                      </Badge>
                                    )}
                                  </div>
                                  {slotTimezone !== viewerTimezone && (
                                    <div className="text-xs text-muted-foreground ml-6">
                                      Original: {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} ({getTimezoneDisplayName(slotTimezone)})
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleSlotClick(slot)}
                                  disabled={isPastDate}
                                  className={`flex-shrink-0 ${isLeagueContext ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                                >
                                  {isLeagueContext ? 'Request League Match' : 'Request Match'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Range Selector Dialog */}
        <Dialog open={showTimeSelector} onOpenChange={setShowTimeSelector}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Your Match Time</DialogTitle>
              <DialogDescription>
                This availability slot is {selectedSlot && (() => {
                  const [startHour, startMin] = selectedSlot.start_time.split(':').map(Number);
                  const [endHour, endMin] = selectedSlot.end_time.split(':').map(Number);
                  const durationHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
                  return `${durationHours} hours long`;
                })()}. Choose the specific time range you'd like to book.
              </DialogDescription>
            </DialogHeader>

            {selectedSlot && (() => {
              // Generate time options in 30-minute increments
              const [slotStartHour, slotStartMin] = selectedSlot.start_time.split(':').map(Number);
              const [slotEndHour, slotEndMin] = selectedSlot.end_time.split(':').map(Number);
              const slotStartMinutes = slotStartHour * 60 + slotStartMin;
              const slotEndMinutes = slotEndHour * 60 + slotEndMin;

              const timeOptions: string[] = [];
              for (let minutes = slotStartMinutes; minutes <= slotEndMinutes; minutes += 30) {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                timeOptions.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
              }

              // Validate that end time is after start time and at least 1 hour duration
              const [customStartHour, customStartMin] = customStartTime.split(':').map(Number);
              const [customEndHour, customEndMin] = customEndTime.split(':').map(Number);
              const customStartMinutes = customStartHour * 60 + customStartMin;
              const customEndMinutes = customEndHour * 60 + customEndMin;
              const customDuration = customEndMinutes - customStartMinutes;
              const isValidSelection = customDuration >= 60; // At least 1 hour

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Available:</strong> {selectedSlot.start_time.slice(0, 5)} - {selectedSlot.end_time.slice(0, 5)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="start-time">Start Time</Label>
                      <Select value={customStartTime} onValueChange={setCustomStartTime}>
                        <SelectTrigger id="start-time">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.slice(0, -1).map(time => (
                            <SelectItem key={time} value={time}>
                              {time.slice(0, 5)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="end-time">End Time</Label>
                      <Select value={customEndTime} onValueChange={setCustomEndTime}>
                        <SelectTrigger id="end-time">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.slice(1).map(time => {
                            // Only show end times that are after the selected start time
                            const [timeHour, timeMin] = time.split(':').map(Number);
                            const timeMinutes = timeHour * 60 + timeMin;
                            return timeMinutes > customStartMinutes ? (
                              <SelectItem key={time} value={time}>
                                {time.slice(0, 5)}
                              </SelectItem>
                            ) : null;
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {customStartTime && customEndTime && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          <strong>Selected Duration:</strong> {(customDuration / 60).toFixed(1)} hours
                        </p>
                        {!isValidSelection && (
                          <p className="text-sm text-destructive mt-1">
                            ⚠️ Match must be at least 1 hour
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTimeSelector(false);
                        setSelectedSlot(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (isValidSelection && selectedSlot) {
                          requestMatch(selectedSlot.id, customStartTime, customEndTime);
                          setShowTimeSelector(false);
                          setSelectedSlot(null);
                        }
                      }}
                      disabled={!isValidSelection}
                      className={isLeagueContext ? 'bg-orange-500 hover:bg-orange-600' : ''}
                    >
                      Confirm Booking
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
