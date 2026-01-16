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
      event_type, 
      event_name, 
      description, 
      location_name,
      location_type,
      latitude,
      longitude,
      virtual_location,
      start_time_utc, 
      end_time_utc,
      privacy_level = 'public',
      reminder_offset_minutes = 30,
      is_recurring = false,
      recurrence_rule,
      participants = [],
      color_code,
      check_conflicts = true
    } = await req.json()

    // Validate required fields
    if (!event_type || !event_name || !start_time_utc || !end_time_utc) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event_type, event_name, start_time_utc, end_time_utc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate event type
    const validTypes = ['match', 'lesson', 'tournament', 'practice']
    if (!validTypes.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid event_type. Must be one of: match, lesson, tournament, practice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set default duration based on event type
    const defaultDurations = {
      match: 120,
      lesson: 60,
      tournament: 240,
      practice: 90
    }
    const default_duration = defaultDurations[event_type as keyof typeof defaultDurations]

    // Check conflicts for all participants if requested
    let conflicts = []
    if (check_conflicts) {
      const allParticipants = [...participants, user.id]
      
      for (const participantId of allParticipants) {
        const { data: userConflicts, error: conflictError } = await supabaseClient
          .rpc('check_event_conflicts', {
            p_user_id: participantId,
            p_start_time: start_time_utc,
            p_end_time: end_time_utc,
            p_exclude_event_id: null
          })

        if (conflictError) {
          console.error('Error checking conflicts:', conflictError)
        } else if (userConflicts && userConflicts.length > 0) {
          conflicts.push({
            user_id: participantId,
            conflicts: userConflicts
          })
        }
      }
    }

    // Determine initial status
    let initialStatus = 'scheduled'
    if (conflicts.length > 0) {
      initialStatus = 'pending_conflict'
    }

    // Create event
    const { data: event, error: eventError } = await supabaseClient
      .from('calendar_events')
      .insert({
        creator_id: user.id,
        event_type,
        event_name,
        description,
        location_name,
        location_type,
        latitude,
        longitude,
        virtual_location,
        start_time_utc,
        end_time_utc,
        privacy_level,
        reminder_offset_minutes,
        is_recurring,
        recurrence_rule: is_recurring ? recurrence_rule : null,
        status: initialStatus,
        color_code,
        default_duration
      })
      .select()
      .single()

    if (eventError) {
      console.error('Error creating event:', eventError)
      return new Response(
        JSON.stringify({ error: 'Failed to create event', details: eventError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add participants
    const participantRecords = participants.map((userId: string) => ({
      event_id: event.id,
      user_id: userId,
      role: 'participant',
      rsvp_status: 'invited',
      availability_status: conflicts.some(c => c.user_id === userId) ? 'busy' : 'available'
    }))

    if (participantRecords.length > 0) {
      const { error: participantsError } = await supabaseClient
        .from('event_participants')
        .insert(participantRecords)

      if (participantsError) {
        console.error('Error adding participants:', participantsError)
      }
    }

    // Log conflicts for tracking
    if (conflicts.length > 0) {
      const conflictRecords = conflicts.flatMap(c => 
        c.conflicts.map((conflict: any) => ({
          event_id: event.id,
          user_id: c.user_id,
          conflict_type: conflict.conflict_type,
          conflict_details: conflict
        }))
      )

      await supabaseClient
        .from('availability_conflicts')
        .insert(conflictRecords)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event,
        conflicts: conflicts.length > 0 ? conflicts : null,
        message: conflicts.length > 0 
          ? 'Event created with scheduling conflicts. Participants have been notified.'
          : 'Event created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-event function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})