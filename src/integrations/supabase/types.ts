export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      availability_conflicts: {
        Row: {
          conflict_details: Json | null
          conflict_type: string
          created_at: string
          event_id: string
          id: string
          resolved: boolean | null
          user_id: string
        }
        Insert: {
          conflict_details?: Json | null
          conflict_type: string
          created_at?: string
          event_id: string
          id?: string
          resolved?: boolean | null
          user_id: string
        }
        Update: {
          conflict_details?: Json | null
          conflict_type?: string
          created_at?: string
          event_id?: string
          id?: string
          resolved?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_conflicts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          template_data: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          template_data: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          template_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      calendar_bookings: {
        Row: {
          availability_id: string | null
          confirmation_sent: boolean
          created_at: string
          date: string
          end_time: string
          id: string
          notes: string | null
          phone_number: string | null
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_id?: string | null
          confirmation_sent?: boolean
          created_at?: string
          date: string
          end_time: string
          id?: string
          notes?: string | null
          phone_number?: string | null
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_id?: string | null
          confirmation_sent?: boolean
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          phone_number?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "user_availability"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color_code: string | null
          created_at: string
          creator_id: string
          default_duration: number | null
          description: string | null
          duration_minutes: number | null
          end_time_utc: string
          event_name: string
          event_type: string
          id: string
          is_recurring: boolean | null
          latitude: number | null
          location_name: string | null
          location_type: string | null
          longitude: number | null
          privacy_level: string
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          reminder_offset_minutes: number | null
          start_time_utc: string
          status: string
          updated_at: string
          virtual_location: string | null
        }
        Insert: {
          color_code?: string | null
          created_at?: string
          creator_id: string
          default_duration?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time_utc: string
          event_name: string
          event_type: string
          id?: string
          is_recurring?: boolean | null
          latitude?: number | null
          location_name?: string | null
          location_type?: string | null
          longitude?: number | null
          privacy_level?: string
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          reminder_offset_minutes?: number | null
          start_time_utc: string
          status?: string
          updated_at?: string
          virtual_location?: string | null
        }
        Update: {
          color_code?: string | null
          created_at?: string
          creator_id?: string
          default_duration?: number | null
          description?: string | null
          duration_minutes?: number | null
          end_time_utc?: string
          event_name?: string
          event_type?: string
          id?: string
          is_recurring?: boolean | null
          latitude?: number | null
          location_name?: string | null
          location_type?: string | null
          longitude?: number | null
          privacy_level?: string
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          reminder_offset_minutes?: number | null
          start_time_utc?: string
          status?: string
          updated_at?: string
          virtual_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      division_assignments: {
        Row: {
          assigned_at: string
          division_id: string | null
          id: string
          league_registration_id: string | null
          matches_completed: number
          matches_required: number
          playoff_eligible: boolean
          status: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          division_id?: string | null
          id?: string
          league_registration_id?: string | null
          matches_completed?: number
          matches_required?: number
          playoff_eligible?: boolean
          status?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          division_id?: string | null
          id?: string
          league_registration_id?: string | null
          matches_completed?: number
          matches_required?: number
          playoff_eligible?: boolean
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "division_assignments_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "division_assignments_league_registration_id_fkey"
            columns: ["league_registration_id"]
            isOneToOne: false
            referencedRelation: "league_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          age_range: string
          competitiveness: string
          created_at: string
          current_players: number
          division_name: string
          gender_preference: string
          id: string
          league_id: string
          max_players: number
          season: string
          skill_level_range: string
          status: string
          tournament_status: string | null
          updated_at: string
        }
        Insert: {
          age_range: string
          competitiveness: string
          created_at?: string
          current_players?: number
          division_name: string
          gender_preference: string
          id?: string
          league_id: string
          max_players?: number
          season: string
          skill_level_range: string
          status?: string
          tournament_status?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string
          competitiveness?: string
          created_at?: string
          current_players?: number
          division_name?: string
          gender_preference?: string
          id?: string
          league_id?: string
          max_players?: number
          season?: string
          skill_level_range?: string
          status?: string
          tournament_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          availability_status: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          proposed_time_end: string | null
          proposed_time_start: string | null
          responded_at: string | null
          role: string
          rsvp_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          proposed_time_end?: string | null
          proposed_time_start?: string | null
          responded_at?: string | null
          role?: string
          rsvp_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          proposed_time_end?: string | null
          proposed_time_start?: string | null
          responded_at?: string | null
          role?: string
          rsvp_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders_queue: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notification_type: string | null
          reminder_time: string
          sent: boolean | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notification_type?: string | null
          reminder_time: string
          sent?: boolean | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notification_type?: string | null
          reminder_time?: string
          sent?: boolean | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      league_registrations: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          league_name: string
          registration_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          league_name: string
          registration_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          league_name?: string
          registration_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      match_invites: {
        Row: {
          availability_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          court_location: string | null
          created_at: string
          date: string
          end_time: string
          expires_at: string
          home_away_indicator: string | null
          id: string
          message: string | null
          proposed_at: string | null
          proposed_by_user_id: string | null
          proposed_date: string | null
          proposed_end_time: string | null
          proposed_start_time: string | null
          receiver_id: string
          response_at: string | null
          sender_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          availability_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          court_location?: string | null
          created_at?: string
          date: string
          end_time: string
          expires_at?: string
          home_away_indicator?: string | null
          id?: string
          message?: string | null
          proposed_at?: string | null
          proposed_by_user_id?: string | null
          proposed_date?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          receiver_id: string
          response_at?: string | null
          sender_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          availability_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          court_location?: string | null
          created_at?: string
          date?: string
          end_time?: string
          expires_at?: string
          home_away_indicator?: string | null
          id?: string
          message?: string | null
          proposed_at?: string | null
          proposed_by_user_id?: string | null
          proposed_date?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          receiver_id?: string
          response_at?: string | null
          sender_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_invites_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "user_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_invites_proposed_by_user_id_fkey"
            columns: ["proposed_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_invites_proposed_by_user_id_fkey"
            columns: ["proposed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reminders: {
        Row: {
          created_at: string | null
          id: string
          match_booking_id: string | null
          reminder_type: string
          scheduled_for: string
          sent: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_booking_id?: string | null
          reminder_type: string
          scheduled_for: string
          sent?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          match_booking_id?: string | null
          reminder_type?: string
          scheduled_for?: string
          sent?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      match_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          match_id: string
          proposed_end: string | null
          proposed_start: string | null
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          match_id: string
          proposed_end?: string | null
          proposed_start?: string | null
          response: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          match_id?: string
          proposed_end?: string | null
          proposed_start?: string | null
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_responses_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sets: {
        Row: {
          created_at: string | null
          id: string
          match_id: string | null
          player1_games: number | null
          player2_games: number | null
          set_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          player1_games?: number | null
          player2_games?: number | null
          set_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          player1_games?: number | null
          player2_games?: number | null
          set_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_suggestions: {
        Row: {
          compatibility_score: number
          created_at: string | null
          id: string
          match_reasons: string[] | null
          player_id: string | null
          status: string | null
          suggested_player_id: string | null
        }
        Insert: {
          compatibility_score?: number
          created_at?: string | null
          id?: string
          match_reasons?: string[] | null
          player_id?: string | null
          status?: string | null
          suggested_player_id?: string | null
        }
        Update: {
          compatibility_score?: number
          created_at?: string | null
          id?: string
          match_reasons?: string[] | null
          player_id?: string | null
          status?: string | null
          suggested_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_suggestions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_suggested_player_id_fkey"
            columns: ["suggested_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_player_id: string | null
          court_location: string | null
          created_at: string | null
          duration_minutes: number | null
          home_player_id: string | null
          id: string
          invitation_status: string | null
          league_id: string | null
          match_date: string | null
          player1_id: string | null
          player1_score: number | null
          player2_id: string | null
          player2_score: number | null
          proposed_end: string | null
          proposed_start: string | null
          reported_at: string | null
          reported_by_user_id: string | null
          reschedule_count: number | null
          set1_player1: number | null
          set1_player2: number | null
          set2_player1: number | null
          set2_player2: number | null
          set3_player1: number | null
          set3_player2: number | null
          status: string | null
          tiebreak_player1: number | null
          tiebreak_player2: number | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          away_player_id?: string | null
          court_location?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          home_player_id?: string | null
          id?: string
          invitation_status?: string | null
          league_id?: string | null
          match_date?: string | null
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          proposed_end?: string | null
          proposed_start?: string | null
          reported_at?: string | null
          reported_by_user_id?: string | null
          reschedule_count?: number | null
          set1_player1?: number | null
          set1_player2?: number | null
          set2_player1?: number | null
          set2_player2?: number | null
          set3_player1?: number | null
          set3_player2?: number | null
          status?: string | null
          tiebreak_player1?: number | null
          tiebreak_player2?: number | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          away_player_id?: string | null
          court_location?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          home_player_id?: string | null
          id?: string
          invitation_status?: string | null
          league_id?: string | null
          match_date?: string | null
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          proposed_end?: string | null
          proposed_start?: string | null
          reported_at?: string | null
          reported_by_user_id?: string | null
          reschedule_count?: number | null
          set1_player1?: number | null
          set1_player2?: number | null
          set2_player1?: number | null
          set2_player2?: number | null
          set3_player1?: number | null
          set3_player2?: number | null
          status?: string | null
          tiebreak_player1?: number | null
          tiebreak_player2?: number | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          phone_number: string | null
          sms_enabled: boolean
          sms_matches: boolean
          sms_messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number?: string | null
          sms_enabled?: boolean
          sms_matches?: boolean
          sms_messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string | null
          sms_enabled?: boolean
          sms_matches?: boolean
          sms_messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          browser_notifications: boolean | null
          created_at: string | null
          email_notifications: boolean | null
          enable_friend_requests: boolean | null
          enable_league_updates: boolean | null
          enable_match_accepted: boolean | null
          enable_match_cancelled: boolean | null
          enable_match_declined: boolean | null
          enable_match_invites: boolean | null
          enable_match_rescheduled: boolean | null
          group_similar_notifications: boolean | null
          id: string
          notification_sound: string | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          respect_tab_focus: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          browser_notifications?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          enable_friend_requests?: boolean | null
          enable_league_updates?: boolean | null
          enable_match_accepted?: boolean | null
          enable_match_cancelled?: boolean | null
          enable_match_declined?: boolean | null
          enable_match_invites?: boolean | null
          enable_match_rescheduled?: boolean | null
          group_similar_notifications?: boolean | null
          id?: string
          notification_sound?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          respect_tab_focus?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          browser_notifications?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          enable_friend_requests?: boolean | null
          enable_league_updates?: boolean | null
          enable_match_accepted?: boolean | null
          enable_match_cancelled?: boolean | null
          enable_match_declined?: boolean | null
          enable_match_invites?: boolean | null
          enable_match_rescheduled?: boolean | null
          group_similar_notifications?: boolean | null
          id?: string
          notification_sound?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          respect_tab_focus?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          used?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      players: {
        Row: {
          age_competition_preference: string | null
          age_range: string | null
          best_streak: number | null
          city: string | null
          competitiveness: string | null
          created_at: string | null
          current_streak: number | null
          email: string
          gender: string | null
          gender_preference: string | null
          hours_played: number | null
          id: string
          location: string | null
          losses: number | null
          name: string
          phone: string | null
          skill_level: number | null
          total_matches: number | null
          travel_distance: string | null
          updated_at: string | null
          user_id: string | null
          usta_rating: string | null
          wins: number | null
          zip_code: string | null
        }
        Insert: {
          age_competition_preference?: string | null
          age_range?: string | null
          best_streak?: number | null
          city?: string | null
          competitiveness?: string | null
          created_at?: string | null
          current_streak?: number | null
          email: string
          gender?: string | null
          gender_preference?: string | null
          hours_played?: number | null
          id?: string
          location?: string | null
          losses?: number | null
          name: string
          phone?: string | null
          skill_level?: number | null
          total_matches?: number | null
          travel_distance?: string | null
          updated_at?: string | null
          user_id?: string | null
          usta_rating?: string | null
          wins?: number | null
          zip_code?: string | null
        }
        Update: {
          age_competition_preference?: string | null
          age_range?: string | null
          best_streak?: number | null
          city?: string | null
          competitiveness?: string | null
          created_at?: string | null
          current_streak?: number | null
          email?: string
          gender?: string | null
          gender_preference?: string | null
          hours_played?: number | null
          id?: string
          location?: string | null
          losses?: number | null
          name?: string
          phone?: string | null
          skill_level?: number | null
          total_matches?: number | null
          travel_distance?: string | null
          updated_at?: string | null
          user_id?: string | null
          usta_rating?: string | null
          wins?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          last_name: string | null
          location: string | null
          membership_id: string | null
          networking_enabled: boolean
          phone: string | null
          preferred_language: string | null
          profile_completed: boolean
          profile_picture_url: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          location?: string | null
          membership_id?: string | null
          networking_enabled?: boolean
          phone?: string | null
          preferred_language?: string | null
          profile_completed?: boolean
          profile_picture_url?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          location?: string | null
          membership_id?: string | null
          networking_enabled?: boolean
          phone?: string | null
          preferred_language?: string | null
          profile_completed?: boolean
          profile_picture_url?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      unmatched_player_requests: {
        Row: {
          accepts_outside_criteria: boolean
          created_at: string
          id: string
          league_id: string
          original_preferences: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepts_outside_criteria?: boolean
          created_at?: string
          id?: string
          league_id: string
          original_preferences: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepts_outside_criteria?: boolean
          created_at?: string
          id?: string
          league_id?: string
          original_preferences?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_availability: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          is_available: boolean
          is_blocked: boolean
          notes: string | null
          privacy_level: string | null
          recurrence_rule: string | null
          start_time: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          is_available?: boolean
          is_blocked?: boolean
          notes?: string | null
          privacy_level?: string | null
          recurrence_rule?: string | null
          start_time: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          is_available?: boolean
          is_blocked?: boolean
          notes?: string | null
          privacy_level?: string | null
          recurrence_rule?: string | null
          start_time?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_schedule_settings: {
        Row: {
          buffer_minutes: number
          created_at: string
          end_hour: number
          id: string
          start_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          end_hour?: number
          id?: string
          start_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          end_hour?: number
          id?: string
          start_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_profiles_view: {
        Row: {
          email: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          membership_id: string | null
          profile_completed: boolean | null
          profile_created_at: string | null
          roles: Database["public"]["Enums"]["app_role"][] | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_player_to_division: {
        Args: {
          p_age_range: string
          p_competitiveness: string
          p_gender_preference: string
          p_league_id: string
          p_league_registration_id: string
          p_skill_level: string
          p_user_id: string
        }
        Returns: string
      }
      calculate_player_compatibility: {
        Args: { player1_id: string; player2_id: string }
        Returns: {
          compatibility_score: number
          match_reasons: string[]
        }[]
      }
      can_view_division_calendar: {
        Args: { p_requesting_user_id: string; p_target_user_id: string }
        Returns: boolean
      }
      can_view_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      check_availability_conflict: {
        Args: {
          p_date: string
          p_end_time: string
          p_exclude_id?: string
          p_start_time: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_event_conflicts: {
        Args: {
          p_end_time: string
          p_exclude_event_id?: string
          p_start_time: string
          p_user_id: string
        }
        Returns: {
          conflict_end: string
          conflict_event_id: string
          conflict_start: string
          conflict_title: string
          conflict_type: string
        }[]
      }
      check_same_division: {
        Args: { _division_id: string; _user_id: string }
        Returns: boolean
      }
      create_notification: {
        Args: {
          notification_action_url?: string
          notification_message: string
          notification_metadata?: Json
          notification_title: string
          notification_type: string
          target_user_id: string
        }
        Returns: string
      }
      expire_pending_match_invites: { Args: never; Returns: number }
      find_player_matches: {
        Args: {
          competitiveness_filter?: string
          limit_results?: number
          min_compatibility_score?: number
          target_player_id: string
        }
        Returns: {
          compatibility_score: number
          match_reasons: string[]
          player_name: string
          suggested_player_id: string
        }[]
      }
      generate_match_suggestions: {
        Args: { competitiveness_filter?: string; target_player_id: string }
        Returns: number
      }
      generate_membership_id: { Args: never; Returns: string }
      get_available_slots: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: {
          date: string
          end_time: string
          has_conflict: boolean
          start_time: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      regenerate_membership_id: { Args: { user_uuid: string }; Returns: string }
      validate_password_strength: { Args: { password: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
