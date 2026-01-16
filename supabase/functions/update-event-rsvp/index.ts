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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { 
      event_id,
      rsvp_status,
      proposed_time_start,
      proposed_time_end,
      notes
    } = await req.json()

    if (!event_id || !rsvp_status) {
      return new Response(
        JSON.stringify({ error: 'event_id and rsvp_status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate RSVP status
    const validStatuses = ['invited', 'accepted', 'declined', 'tentative']
    if (!validStatuses.includes(rsvp_status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid rsvp_status. Must be one of: invited, accepted, declined, tentative' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get event details
    const { data: event, error: eventError } = await supabaseClient
      .from('calendar_events')
      .select(`
        *,
        creator:profiles!calendar_events_creator_id_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update participant RSVP
    const { data: participant, error: updateError } = await supabaseClient
      .from('event_participants')
      .update({
        rsvp_status,
        responded_at: new Date().toISOString(),
        proposed_time_start,
        proposed_time_end,
        notes
      })
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating RSVP:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update RSVP', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile for notifications
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    const userName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Someone'

    // Notify event creator of RSVP
    let notificationMessage = ''
    let notificationType = 'event_rsvp'
    
    switch (rsvp_status) {
      case 'accepted':
        notificationMessage = `${userName} accepted your invitation to "${event.event_name}"`
        notificationType = 'event_accepted'
        break
      case 'declined':
        notificationMessage = `${userName} declined your invitation to "${event.event_name}"`
        notificationType = 'event_declined'
        break
      case 'tentative':
        notificationMessage = `${userName} marked as tentative for "${event.event_name}"`
        if (proposed_time_start && proposed_time_end) {
          notificationMessage += ` and proposed a new time`
        }
        break
    }

    if (notificationMessage) {
      await supabaseClient.rpc('create_notification', {
        target_user_id: event.creator_id,
        notification_type: notificationType,
        notification_title: 'Event Response',
        notification_message: notificationMessage,
        notification_action_url: '/dashboard?tab=schedule',
        notification_metadata: {
          event_id: event.id,
          participant_id: user.id,
          rsvp_status,
          proposed_time_start,
          proposed_time_end
        }
      })
    }

    // If all participants accepted, update event status to confirmed
    if (rsvp_status === 'accepted') {
      const { data: allParticipants } = await supabaseClient
        .from('event_participants')
        .select('rsvp_status')
        .eq('event_id', event_id)

      const allAccepted = allParticipants?.every(p => p.rsvp_status === 'accepted')
      
      if (allAccepted) {
        await supabaseClient
          .from('calendar_events')
          .update({ status: 'confirmed' })
          .eq('id', event_id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        participant,
        message: `RSVP updated to ${rsvp_status}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in update-event-rsvp function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})