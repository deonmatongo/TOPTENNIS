import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, MapPin, Mail, Loader2 } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import Header from '@/components/Header';
import { toast } from 'sonner';

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
}

export default function PublicAvailability() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('id, date, start_time, end_time')
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
      toast.error('Please log in to request a match');
      navigate('/login?redirect=/public-availability/' + userId);
      return;
    }

    const slot = availability.find(a => a.id === availabilityId);
    if (!slot) return;

    try {
      const { error } = await supabase
        .from('match_invites')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          availability_id: availabilityId,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: 'pending',
        });

      if (error) throw error;
      toast.success('Match request sent!');
    } catch (error) {
      console.error('Error requesting match:', error);
      toast.error('Failed to send match request');
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
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Available Times
            </CardTitle>
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
                      {slots.map(slot => (
                        <Card key={slot.id} className="hover:border-primary transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => requestMatch(slot.id)}
                              >
                                Request Match
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
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
