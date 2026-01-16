import { supabase } from '@/integrations/supabase/client';

/**
 * Apply the notification types fix to add missing notification types
 * This fixes the constraint violation error when accepting/declining invites
 */
export async function applyNotificationTypesFix() {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          -- Drop the old constraint if it exists
          ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
          
          -- Add the new constraint with all required notification types
          ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
            CHECK (type IN (
              'friend_request',
              'message_received', 
              'match_invite',
              'match_confirmed',
              'match_cancelled',
              'match_accepted',
              'match_declined',
              'match_rescheduled',
              'booking_confirmed',
              'booking_cancelled',
              'league_update',
              'system_notification'
            ));
        END $$;
      `
    });

    if (error) {
      console.error('Error applying notification types fix:', error);
      return false;
    }

    console.log('Successfully applied notification types fix');
    return true;
  } catch (error) {
    console.error('Error applying notification types fix:', error);
    return false;
  }
}
