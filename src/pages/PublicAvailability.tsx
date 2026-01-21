import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, MapPin, Mail, Loader2, Globe } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
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

  const requestMatch = async (availabilityId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error('Please sign in to request a match');
      navigate('/login');
      return;
    }

    try {
      const slot = availability.find(a => a.id === availabilityId);
      if (!slot) return;

      // If this is from a league context, create a league match
      if (isLeagueContext && divisionId) {
        const { data, error } = await supabase.rpc('create_league_match_with_invite', {
          p_division_id: divisionId,
          p_player1_id: user.id,
          p_player2_id: userId,
          p_scheduled_date: slot.date,
          p_scheduled_time: slot.start_time,
          p_timezone: slot.timezone || 'America/New_York',
          p_court_location: slot.location || null,
          p_message: `League match request for ${divisionName || 'your division'}`
        });

        if (error) throw error;
        toast.success('League match request sent!');
        
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
            start_time: slot.start_time,
            end_time: slot.end_time,
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
                        
                        return (
                          <Card key={slot.id} className="hover:border-primary transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {displayStartTime.slice(0, 5)} - {displayEndTime.slice(0, 5)}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {getTimezoneDisplayName(viewerTimezone)}
                                    </Badge>
                                  </div>
                                  {slotTimezone !== viewerTimezone && (
                                    <div className="text-xs text-muted-foreground ml-6">
                                      Original: {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} ({getTimezoneDisplayName(slotTimezone)})
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => requestMatch(slot.id)}
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
      </div>
    </div>
  );
}
