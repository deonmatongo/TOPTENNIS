import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, Clock } from 'lucide-react';

export const ReminderNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check for upcoming reminders
    const checkReminders = async () => {
      try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        const { data: reminders, error } = await supabase
          .from('match_reminders')
          .select(`
            *,
            match_booking:match_bookings(
              date,
              start_time,
              end_time,
              court_location,
              opponent:profiles!match_bookings_opponent_id_fkey(
                first_name,
                last_name
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('sent', false)
          .lte('scheduled_for', oneHourFromNow.toISOString())
          .gte('scheduled_for', now.toISOString());

        if (error) throw error;

        reminders?.forEach((reminder: any) => {
          const match = reminder.match_booking;
          const opponentName = `${match.opponent.first_name} ${match.opponent.last_name}`;
          
          if (reminder.reminder_type === '24h') {
            toast.info(`Match reminder: Tomorrow at ${match.start_time}`, {
              description: `You have a match with ${opponentName} at ${match.court_location || 'TBD'}`,
              duration: 10000,
              icon: <Calendar className="h-4 w-4" />,
            });
          } else if (reminder.reminder_type === '1h') {
            toast.info(`Match starting soon: ${match.start_time}`, {
              description: `Your match with ${opponentName} starts in 1 hour at ${match.court_location || 'TBD'}`,
              duration: 10000,
              icon: <Clock className="h-4 w-4" />,
            });
          }

          // Mark reminder as sent
          supabase
            .from('match_reminders')
            .update({ sent: true })
            .eq('id', reminder.id)
            .then();
        });
      } catch (error) {
        console.error('Error checking reminders:', error);
      }
    };

    // Check immediately
    checkReminders();

    // Check every 5 minutes
    const interval = setInterval(checkReminders, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  return null;
};
