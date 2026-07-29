-- Fix auth.uid() → (SELECT auth.uid()) in all RLS policies
-- This prevents auth.uid() being re-evaluated per-row (initplan) and
-- makes it evaluate once per query instead (significant performance gain)

DROP POLICY IF EXISTS "Users can manage their own app_settings" ON public.app_settings;
CREATE POLICY "Users can manage their own app_settings" ON public.app_settings
  AS PERMISSIVE
  TO public
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Event creators can view event conflicts" ON public.availability_conflicts;
CREATE POLICY "Event creators can view event conflicts" ON public.availability_conflicts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM calendar_events
  WHERE ((calendar_events.id = availability_conflicts.event_id) AND (calendar_events.creator_id = (SELECT auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their own conflicts" ON public.availability_conflicts;
CREATE POLICY "Users can view their own conflicts" ON public.availability_conflicts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create their own templates" ON public.availability_templates;
CREATE POLICY "Users can create their own templates" ON public.availability_templates
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.availability_templates;
CREATE POLICY "Users can delete their own templates" ON public.availability_templates
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own templates" ON public.availability_templates;
CREATE POLICY "Users can update their own templates" ON public.availability_templates
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own templates" ON public.availability_templates;
CREATE POLICY "Users can view their own templates" ON public.availability_templates
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create blocks" ON public.blocked_users;
CREATE POLICY "Users can create blocks" ON public.blocked_users
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = blocker_id));

DROP POLICY IF EXISTS "Users can delete their own blocks" ON public.blocked_users;
CREATE POLICY "Users can delete their own blocks" ON public.blocked_users
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = blocker_id));

DROP POLICY IF EXISTS "Users can view their own blocks" ON public.blocked_users;
CREATE POLICY "Users can view their own blocks" ON public.blocked_users
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = blocker_id));

DROP POLICY IF EXISTS "Users can create their own bookings" ON public.calendar_bookings;
CREATE POLICY "Users can create their own bookings" ON public.calendar_bookings
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own bookings" ON public.calendar_bookings;
CREATE POLICY "Users can update their own bookings" ON public.calendar_bookings
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own bookings" ON public.calendar_bookings;
CREATE POLICY "Users can view their own bookings" ON public.calendar_bookings
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Creators can delete their own events" ON public.calendar_events;
CREATE POLICY "Creators can delete their own events" ON public.calendar_events
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = creator_id));

DROP POLICY IF EXISTS "Creators can update their own events" ON public.calendar_events;
CREATE POLICY "Creators can update their own events" ON public.calendar_events
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = creator_id));

DROP POLICY IF EXISTS "Users can create their own events" ON public.calendar_events;
CREATE POLICY "Users can create their own events" ON public.calendar_events
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = creator_id));

DROP POLICY IF EXISTS "Users can view events they have access to" ON public.calendar_events;
CREATE POLICY "Users can view events they have access to" ON public.calendar_events
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (can_view_event(id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "call_insert" ON public.calls;
CREATE POLICY "call_insert" ON public.calls
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((caller_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "call_select" ON public.calls;
CREATE POLICY "call_select" ON public.calls
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((caller_id = (SELECT auth.uid())) OR (callee_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "call_update" ON public.calls;
CREATE POLICY "call_update" ON public.calls
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((caller_id = (SELECT auth.uid())) OR (callee_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "calls_insert_caller" ON public.calls;
CREATE POLICY "calls_insert_caller" ON public.calls
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = caller_id));

DROP POLICY IF EXISTS "calls_select_participants" ON public.calls;
CREATE POLICY "calls_select_participants" ON public.calls
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) = caller_id) OR ((SELECT auth.uid()) = callee_id)));

DROP POLICY IF EXISTS "calls_update_participants" ON public.calls;
CREATE POLICY "calls_update_participants" ON public.calls
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((((SELECT auth.uid()) = caller_id) OR ((SELECT auth.uid()) = callee_id)));

DROP POLICY IF EXISTS "Users can file content reports" ON public.content_reports;
CREATE POLICY "Users can file content reports" ON public.content_reports
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = reporter_id));

DROP POLICY IF EXISTS "Users can read their own reports" ON public.content_reports;
CREATE POLICY "Users can read their own reports" ON public.content_reports
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = reporter_id));

DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;
CREATE POLICY "Admins can remove members" ON public.conversation_members
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((user_id = (SELECT auth.uid())) OR is_conversation_admin(conversation_id)));

DROP POLICY IF EXISTS "Members can join conversations" ON public.conversation_members;
CREATE POLICY "Members can join conversations" ON public.conversation_members
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((((SELECT auth.uid()) = user_id) OR is_conversation_admin(conversation_id)));

DROP POLICY IF EXISTS "Members can update their own membership" ON public.conversation_members;
CREATE POLICY "Members can update their own membership" ON public.conversation_members
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Members can send messages" ON public.conversation_messages;
CREATE POLICY "Members can send messages" ON public.conversation_messages
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((((SELECT auth.uid()) = sender_id) AND is_conversation_member(conversation_id)));

DROP POLICY IF EXISTS "Sender can delete their own messages" ON public.conversation_messages;
CREATE POLICY "Sender can delete their own messages" ON public.conversation_messages
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = sender_id));

DROP POLICY IF EXISTS "Sender can edit their own messages" ON public.conversation_messages;
CREATE POLICY "Sender can edit their own messages" ON public.conversation_messages
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = sender_id));

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = created_by));

DROP POLICY IF EXISTS "Division members can view each other's assignments" ON public.division_assignments;
CREATE POLICY "Division members can view each other's assignments" ON public.division_assignments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) = user_id) OR check_same_division((SELECT auth.uid()), division_id)));

DROP POLICY IF EXISTS "Users can view their division assignments" ON public.division_assignments;
CREATE POLICY "Users can view their division assignments" ON public.division_assignments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Event creators can manage participants" ON public.event_participants;
CREATE POLICY "Event creators can manage participants" ON public.event_participants
  AS PERMISSIVE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM calendar_events
  WHERE ((calendar_events.id = event_participants.event_id) AND (calendar_events.creator_id = (SELECT auth.uid()))))));

DROP POLICY IF EXISTS "Users can update their own participant record" ON public.event_participants;
CREATE POLICY "Users can update their own participant record" ON public.event_participants
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view participants of events they can see" ON public.event_participants;
CREATE POLICY "Users can view participants of events they can see" ON public.event_participants
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (can_view_event(event_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can view their own reminders" ON public.event_reminders_queue;
CREATE POLICY "Users can view their own reminders" ON public.event_reminders_queue
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "fr_delete" ON public.friend_requests;
CREATE POLICY "fr_delete" ON public.friend_requests
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "fr_insert" ON public.friend_requests;
CREATE POLICY "fr_insert" ON public.friend_requests
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = sender_id));

DROP POLICY IF EXISTS "fr_select" ON public.friend_requests;
CREATE POLICY "fr_select" ON public.friend_requests
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "fr_update" ON public.friend_requests;
CREATE POLICY "fr_update" ON public.friend_requests
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)))
  WITH CHECK ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can create matches in their division" ON public.league_matches;
CREATE POLICY "Users can create matches in their division" ON public.league_matches
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((((SELECT auth.uid()) = player1_id) OR ((SELECT auth.uid()) = player2_id)) AND (EXISTS ( SELECT 1
   FROM division_assignments da
  WHERE ((da.division_id = league_matches.division_id) AND (da.user_id = (SELECT auth.uid())) AND (da.status = 'active'::text))))));

DROP POLICY IF EXISTS "Users can update their league matches" ON public.league_matches;
CREATE POLICY "Users can update their league matches" ON public.league_matches
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((((SELECT auth.uid()) = player1_id) OR ((SELECT auth.uid()) = player2_id)))
  WITH CHECK ((((SELECT auth.uid()) = player1_id) OR ((SELECT auth.uid()) = player2_id)));

DROP POLICY IF EXISTS "Users can view their division matches" ON public.league_matches;
CREATE POLICY "Users can view their division matches" ON public.league_matches
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM division_assignments da
  WHERE ((da.division_id = league_matches.division_id) AND (da.user_id = (SELECT auth.uid())) AND (da.status = 'active'::text)))));

DROP POLICY IF EXISTS "Users can view their own league matches" ON public.league_matches;
CREATE POLICY "Users can view their own league matches" ON public.league_matches
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) = player1_id) OR ((SELECT auth.uid()) = player2_id)));

DROP POLICY IF EXISTS "Users can create their own registrations" ON public.league_registrations;
CREATE POLICY "Users can create their own registrations" ON public.league_registrations
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own registrations" ON public.league_registrations;
CREATE POLICY "Users can update their own registrations" ON public.league_registrations
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own registrations" ON public.league_registrations;
CREATE POLICY "Users can view their own registrations" ON public.league_registrations
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete invites they sent or received" ON public.match_invites;
CREATE POLICY "Users can delete invites they sent or received" ON public.match_invites
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can send match invites" ON public.match_invites;
CREATE POLICY "Users can send match invites" ON public.match_invites
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = sender_id));

DROP POLICY IF EXISTS "Users can update invites they sent or received" ON public.match_invites;
CREATE POLICY "Users can update invites they sent or received" ON public.match_invites
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)))
  WITH CHECK ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can view invites they sent or received" ON public.match_invites;
CREATE POLICY "Users can view invites they sent or received" ON public.match_invites
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.match_reminders;
CREATE POLICY "Users can delete their own reminders" ON public.match_reminders
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert their own reminders" ON public.match_reminders;
CREATE POLICY "Users can insert their own reminders" ON public.match_reminders
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own reminders" ON public.match_reminders;
CREATE POLICY "Users can update their own reminders" ON public.match_reminders
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own reminders" ON public.match_reminders;
CREATE POLICY "Users can view their own reminders" ON public.match_reminders
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create responses for their matches" ON public.match_responses;
CREATE POLICY "Users can create responses for their matches" ON public.match_responses
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own responses" ON public.match_responses;
CREATE POLICY "Users can update their own responses" ON public.match_responses
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view responses for their matches" ON public.match_responses;
CREATE POLICY "Users can view responses for their matches" ON public.match_responses
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = match_responses.match_id) AND ((m.player1_id IN ( SELECT players.id
           FROM players
          WHERE (players.user_id = (SELECT auth.uid())))) OR (m.player2_id IN ( SELECT players.id
           FROM players
          WHERE (players.user_id = (SELECT auth.uid())))))))));

DROP POLICY IF EXISTS "Match participants can manage sets" ON public.match_sets;
CREATE POLICY "Match participants can manage sets" ON public.match_sets
  AS PERMISSIVE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM ((matches m
     JOIN players p1 ON ((m.player1_id = p1.id)))
     JOIN players p2 ON ((m.player2_id = p2.id)))
  WHERE ((m.id = match_sets.match_id) AND ((p1.user_id = (SELECT auth.uid())) OR (p2.user_id = (SELECT auth.uid())))))));

DROP POLICY IF EXISTS "Users can update their match suggestions status" ON public.match_suggestions;
CREATE POLICY "Users can update their match suggestions status" ON public.match_suggestions
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = match_suggestions.player_id) AND (players.user_id = (SELECT auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their own match suggestions" ON public.match_suggestions;
CREATE POLICY "Users can view their own match suggestions" ON public.match_suggestions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = match_suggestions.player_id) AND (players.user_id = (SELECT auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = match_suggestions.suggested_player_id) AND (players.user_id = (SELECT auth.uid())))))));

DROP POLICY IF EXISTS "Players can create matches" ON public.matches;
CREATE POLICY "Players can create matches" ON public.matches
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = matches.player1_id) AND (players.user_id = (SELECT auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = matches.player2_id) AND (players.user_id = (SELECT auth.uid())))))));

DROP POLICY IF EXISTS "Players can update their matches" ON public.matches;
CREATE POLICY "Players can update their matches" ON public.matches
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = matches.player1_id) AND (players.user_id = (SELECT auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = matches.player2_id) AND (players.user_id = (SELECT auth.uid())))))));

DROP POLICY IF EXISTS "Users can view division members' matches" ON public.matches;
CREATE POLICY "Users can view division members' matches" ON public.matches
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ((players p1
     JOIN division_assignments da1 ON ((da1.user_id = p1.user_id)))
     JOIN division_assignments da2 ON ((da2.division_id = da1.division_id)))
  WHERE (((p1.id = matches.player1_id) OR (p1.id = matches.player2_id)) AND (da2.user_id = (SELECT auth.uid())) AND (da1.status = 'active'::text) AND (da2.status = 'active'::text)))));

DROP POLICY IF EXISTS "Users can view matches they participate in" ON public.matches;
CREATE POLICY "Users can view matches they participate in" ON public.matches
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM players p
  WHERE (((p.id = matches.player1_id) OR (p.id = matches.player2_id)) AND (p.user_id = (SELECT auth.uid()))))));

DROP POLICY IF EXISTS "members can manage reactions" ON public.message_reactions;
CREATE POLICY "members can manage reactions" ON public.message_reactions
  AS PERMISSIVE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM conversation_messages msg
  WHERE ((msg.id = message_reactions.message_id) AND is_conversation_member(msg.conversation_id)))))
  WITH CHECK (((user_id = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM conversation_messages msg
  WHERE ((msg.id = message_reactions.message_id) AND is_conversation_member(msg.conversation_id))))));

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = sender_id));

DROP POLICY IF EXISTS "Users can update messages they received (mark as read)" ON public.messages;
CREATE POLICY "Users can update messages they received (mark as read)" ON public.messages
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = receiver_id))
  WITH CHECK (((SELECT auth.uid()) = receiver_id));

DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
CREATE POLICY "Users can view messages they sent or received" ON public.messages
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) = sender_id) OR ((SELECT auth.uid()) = receiver_id)));

DROP POLICY IF EXISTS "Users can create their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can create their own notification preferences" ON public.notification_preferences
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert own notification settings" ON public.notification_settings;
CREATE POLICY "Users can insert own notification settings" ON public.notification_settings
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can manage their own notification_settings" ON public.notification_settings;
CREATE POLICY "Users can manage their own notification_settings" ON public.notification_settings
  AS PERMISSIVE
  TO public
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update own notification settings" ON public.notification_settings;
CREATE POLICY "Users can update own notification settings" ON public.notification_settings
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view own notification settings" ON public.notification_settings;
CREATE POLICY "Users can view own notification settings" ON public.notification_settings
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) IS NOT NULL));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Users can update their own reset tokens" ON public.password_reset_tokens
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Users can view their own reset tokens" ON public.password_reset_tokens
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;
CREATE POLICY "Users can insert their own player profile" ON public.players
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;
CREATE POLICY "Users can update their own player profile" ON public.players
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own player profile" ON public.players;
CREATE POLICY "Users can view their own player profile" ON public.players
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "admins manage brackets" ON public.playoff_brackets;
CREATE POLICY "admins manage brackets" ON public.playoff_brackets
  AS PERMISSIVE
  TO public
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (SELECT auth.uid())) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'moderator'::app_role]))))));

DROP POLICY IF EXISTS "division members read bracket" ON public.playoff_brackets;
CREATE POLICY "division members read bracket" ON public.playoff_brackets
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM division_assignments da
  WHERE ((da.division_id = playoff_brackets.division_id) AND (da.user_id = (SELECT auth.uid())) AND (da.status = 'active'::text)))));

DROP POLICY IF EXISTS "Admins can view user management data" ON public.profiles;
CREATE POLICY "Admins can view user management data" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((has_role((SELECT auth.uid()), 'admin'::app_role) OR (id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;
CREATE POLICY "Authenticated users can view basic profile info" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.role() = 'authenticated'::text) AND (id <> (SELECT auth.uid()))));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
CREATE POLICY "Users can view their own full profile" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users manage their own support messages" ON public.support_messages;
CREATE POLICY "Users manage their own support messages" ON public.support_messages
  AS PERMISSIVE
  TO public
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create their own unmatched requests" ON public.unmatched_player_requests;
CREATE POLICY "Users can create their own unmatched requests" ON public.unmatched_player_requests
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own unmatched requests" ON public.unmatched_player_requests;
CREATE POLICY "Users can update their own unmatched requests" ON public.unmatched_player_requests
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own unmatched requests" ON public.unmatched_player_requests;
CREATE POLICY "Users can view their own unmatched requests" ON public.unmatched_player_requests
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own activity" ON public.user_activity_log;
CREATE POLICY "Users can view their own activity" ON public.user_activity_log
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Authenticated users can view public availability" ON public.user_availability;
CREATE POLICY "Authenticated users can view public availability" ON public.user_availability
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((((SELECT auth.uid()) IS NOT NULL) AND ((privacy_level = 'public'::text) OR (privacy_level IS NULL))));

DROP POLICY IF EXISTS "Users can create their own availability" ON public.user_availability;
CREATE POLICY "Users can create their own availability" ON public.user_availability
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can delete their own availability" ON public.user_availability;
CREATE POLICY "Users can delete their own availability" ON public.user_availability
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can insert their own availability" ON public.user_availability;
CREATE POLICY "Users can insert their own availability" ON public.user_availability
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own availability" ON public.user_availability;
CREATE POLICY "Users can update their own availability" ON public.user_availability
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view division members' availability" ON public.user_availability;
CREATE POLICY "Users can view division members' availability" ON public.user_availability
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((is_available = true) AND (is_blocked = false) AND (user_id IN ( SELECT da2.user_id
   FROM (division_assignments da1
     JOIN division_assignments da2 ON ((da1.division_id = da2.division_id)))
  WHERE ((da1.user_id = (SELECT auth.uid())) AND (da1.status = 'active'::text) AND (da2.status = 'active'::text))))));

DROP POLICY IF EXISTS "Users can view friends' availability" ON public.user_availability;
CREATE POLICY "Users can view friends' availability" ON public.user_availability
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((is_available = true) AND (is_blocked = false) AND (user_id IN ( SELECT
        CASE
            WHEN (friend_requests.sender_id = (SELECT auth.uid())) THEN friend_requests.receiver_id
            ELSE friend_requests.sender_id
        END AS sender_id
   FROM friend_requests
  WHERE ((friend_requests.status = 'accepted'::text) AND ((friend_requests.sender_id = (SELECT auth.uid())) OR (friend_requests.receiver_id = (SELECT auth.uid()))))))));

DROP POLICY IF EXISTS "Users can view match invite participants' availability" ON public.user_availability;
CREATE POLICY "Users can view match invite participants' availability" ON public.user_availability
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((is_available = true) AND (is_blocked = false) AND ((user_id IN ( SELECT match_invites.sender_id
   FROM match_invites
  WHERE ((match_invites.receiver_id = (SELECT auth.uid())) AND (match_invites.status = ANY (ARRAY['pending'::text, 'accepted'::text]))))) OR (user_id IN ( SELECT match_invites.receiver_id
   FROM match_invites
  WHERE ((match_invites.sender_id = (SELECT auth.uid())) AND (match_invites.status = ANY (ARRAY['pending'::text, 'accepted'::text]))))))));

DROP POLICY IF EXISTS "Users can view match participants' availability" ON public.user_availability;
CREATE POLICY "Users can view match participants' availability" ON public.user_availability
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((is_available = true) AND (is_blocked = false) AND (user_id IN ( SELECT p1.user_id
   FROM ((matches m
     JOIN players p1 ON ((m.player1_id = p1.id)))
     JOIN players p2 ON ((m.player2_id = p2.id)))
  WHERE (p2.user_id = (SELECT auth.uid()))
UNION
 SELECT p2.user_id
   FROM ((matches m
     JOIN players p1 ON ((m.player1_id = p1.id)))
     JOIN players p2 ON ((m.player2_id = p2.id)))
  WHERE (p1.user_id = (SELECT auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their own availability" ON public.user_availability;
CREATE POLICY "Users can view their own availability" ON public.user_availability
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "insert_own_presence" ON public.user_presence;
CREATE POLICY "insert_own_presence" ON public.user_presence
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "update_own_presence" ON public.user_presence;
CREATE POLICY "update_own_presence" ON public.user_presence
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;
CREATE POLICY "Admins can manage all user roles" ON public.user_roles
  AS PERMISSIVE
  TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_schedule_settings;
CREATE POLICY "Users can insert their own settings" ON public.user_schedule_settings
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_schedule_settings;
CREATE POLICY "Users can update their own settings" ON public.user_schedule_settings
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_schedule_settings;
CREATE POLICY "Users can view their own settings" ON public.user_schedule_settings
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.uid()) = user_id));

