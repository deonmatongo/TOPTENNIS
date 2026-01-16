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

    const url = new URL(req.url)
    const query = url.searchParams.get('q') || ''
    const event_type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const start_date = url.searchParams.get('start_date')
    const end_date = url.searchParams.get('end_date')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let queryBuilder = supabaseClient
      .from('calendar_events')
      .select(`
        *,
        creator:profiles!calendar_events_creator_id_fkey(
          id,
          first_name,
          last_name,
          profile_picture_url
        ),
        participants:event_participants(
          user_id,
          rsvp_status,
          availability_status,
          user:profiles!event_participants_user_id_fkey(
            first_name,
            last_name,
            profile_picture_url
          )
        )
      `, { count: 'exact' })
      .order('start_time_utc', { ascending: true })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (event_type) {
      queryBuilder = queryBuilder.eq('event_type', event_type)
    }

    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }

    if (start_date) {
      queryBuilder = queryBuilder.gte('start_time_utc', start_date)
    }

    if (end_date) {
      queryBuilder = queryBuilder.lte('start_time_utc', end_date)
    }

    // Text search
    if (query) {
      queryBuilder = queryBuilder.or(`event_name.ilike.%${query}%,description.ilike.%${query}%,location_name.ilike.%${query}%`)
    }

    const { data: events, error: searchError, count } = await queryBuilder

    if (searchError) {
      console.error('Search error:', searchError)
      return new Response(
        JSON.stringify({ error: 'Failed to search events', details: searchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter events based on privacy and user access
    const filteredEvents = events?.filter(event => {
      // Creator can see all their events
      if (event.creator_id === user.id) return true

      // Check if user is a participant
      const isParticipant = event.participants?.some(p => p.user_id === user.id)
      if (isParticipant) return true

      // Public events are visible to all
      if (event.privacy_level === 'public') return true

      // Friends-only requires friend relationship (simplified check)
      if (event.privacy_level === 'friends-only') {
        // In a real implementation, check friend_requests table
        return false
      }

      // Private events only visible to creator and participants
      return false
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        events: filteredEvents || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in event-search function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})