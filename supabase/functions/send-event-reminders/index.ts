import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // This function should be called by a cron job or scheduled task
    // It doesn't require user authentication as it's a system function
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for system operations
    )

    // Get all due reminders
    const now = new Date()
    const { data: dueReminders, error: remindersError } = await supabaseClient
      .from('event_reminders_queue')
      .select(`
        *,
        event:calendar_events(
          id,
          event_name,
          event_type,
          start_time_utc,
          end_time_utc,
          location_name
        ),
        user:profiles!event_reminders_queue_user_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('sent', false)
      .lte('reminder_time', now.toISOString())
      .limit(100) // Process in batches

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reminders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders to send', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sentCount = 0
    const failedReminders = []

    // Send notifications for each reminder
    for (const reminder of dueReminders) {
      try {
        const event = reminder.event
        const user = reminder.user

        if (!event || !user) {
          console.error('Missing event or user data for reminder:', reminder.id)
          failedReminders.push(reminder.id)
          continue
        }

        // Format the event time for display (24-hour format)
        const startTime = new Date(event.start_time_utc)
        const formattedTime = startTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })

        // Create notification
        const { error: notificationError } = await supabaseClient
          .rpc('create_notification', {
            target_user_id: user.id,
            notification_type: 'event_reminder',
            notification_title: `Upcoming ${event.event_type}: ${event.event_name}`,
            notification_message: `Your ${event.event_type} "${event.event_name}" starts at ${formattedTime}${event.location_name ? ` at ${event.location_name}` : ''}`,
            notification_action_url: '/dashboard?tab=schedule',
            notification_metadata: {
              event_id: event.id,
              event_type: event.event_type,
              start_time: event.start_time_utc
            }
          })

        if (notificationError) {
          console.error('Error creating notification:', notificationError)
          failedReminders.push(reminder.id)
          continue
        }

        // Mark reminder as sent
        const { error: updateError } = await supabaseClient
          .from('event_reminders_queue')
          .update({ sent: true, sent_at: now.toISOString() })
          .eq('id', reminder.id)

        if (updateError) {
          console.error('Error marking reminder as sent:', updateError)
        } else {
          sentCount++
        }

      } catch (error) {
        console.error('Error processing reminder:', error)
        failedReminders.push(reminder.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        sent_count: sentCount,
        failed_count: failedReminders.length,
        failed_reminder_ids: failedReminders,
        message: `Sent ${sentCount} reminders${failedReminders.length > 0 ? `, ${failedReminders.length} failed` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-event-reminders function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})