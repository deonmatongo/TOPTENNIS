import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimeSlot {
  start: string
  end: string
}

interface BusyBlock {
  user_id: string
  user_name: string
  busy_blocks: TimeSlot[]
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
      participants = [],
      start_date,
      end_date,
      desired_duration = 120, // minutes
      preferred_times = [] // Array of { day_of_week, start_hour, end_hour }
    } = await req.json()

    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'start_date and end_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Include the current user in participants
    const allParticipants = [user.id, ...participants]

    // Fetch busy blocks for all participants
    const busyBlocksPromises = allParticipants.map(async (userId) => {
      // Get user name
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single()

      const userName = profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown User'

      // Get existing events
      const { data: events } = await supabaseClient
        .from('calendar_events')
        .select('start_time_utc, end_time_utc, event_name')
        .gte('start_time_utc', start_date)
        .lte('start_time_utc', end_date)
        .eq('status', 'confirmed')
        .or(`creator_id.eq.${userId},event_participants.user_id.eq.${userId}`)

      // Get blocked availability
      const { data: blockedSlots } = await supabaseClient
        .from('user_availability')
        .select('date, start_time, end_time')
        .gte('date', start_date)
        .lte('date', end_date)
        .eq('user_id', userId)
        .eq('is_blocked', true)

      const busyBlocks: TimeSlot[] = []

      // Add events to busy blocks
      if (events) {
        events.forEach(event => {
          busyBlocks.push({
            start: event.start_time_utc,
            end: event.end_time_utc
          })
        })
      }

      // Add blocked slots
      if (blockedSlots) {
        blockedSlots.forEach(slot => {
          busyBlocks.push({
            start: `${slot.date}T${slot.start_time}`,
            end: `${slot.date}T${slot.end_time}`
          })
        })
      }

      return {
        user_id: userId,
        user_name: userName,
        busy_blocks: busyBlocks
      }
    })

    const allBusyBlocks: BusyBlock[] = await Promise.all(busyBlocksPromises)

    // Find available time slots
    const suggestions = findAvailableSlots(
      allBusyBlocks,
      start_date,
      end_date,
      desired_duration,
      preferred_times
    )

    return new Response(
      JSON.stringify({ 
        success: true,
        participants: allBusyBlocks,
        suggestions,
        message: suggestions.length > 0 
          ? `Found ${suggestions.length} available time slots`
          : 'No common availability found for all participants'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in scheduling-assistant function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function findAvailableSlots(
  busyBlocks: BusyBlock[],
  startDate: string,
  endDate: string,
  durationMinutes: number,
  preferredTimes: any[]
): TimeSlot[] {
  const suggestions: TimeSlot[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Iterate through each day in the range
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay()
    
    // Default working hours: 6 AM to 10 PM
    let searchStartHour = 6
    let searchEndHour = 22

    // Apply preferred times if specified
    const preferredForDay = preferredTimes.find(pt => pt.day_of_week === dayOfWeek)
    if (preferredForDay) {
      searchStartHour = preferredForDay.start_hour
      searchEndHour = preferredForDay.end_hour
    }

    // Check every 30-minute slot
    for (let hour = searchStartHour; hour < searchEndHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(date)
        slotStart.setHours(hour, minute, 0, 0)
        
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes)

        // Check if this slot conflicts with any participant's busy blocks
        const hasConflict = busyBlocks.some(participant => 
          participant.busy_blocks.some(busy => {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            
            return (
              (slotStart >= busyStart && slotStart < busyEnd) ||
              (slotEnd > busyStart && slotEnd <= busyEnd) ||
              (slotStart <= busyStart && slotEnd >= busyEnd)
            )
          })
        )

        if (!hasConflict) {
          suggestions.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString()
          })
        }
      }
    }
  }

  // Return top 10 suggestions
  return suggestions.slice(0, 10)
}