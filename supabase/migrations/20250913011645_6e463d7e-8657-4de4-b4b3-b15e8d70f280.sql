-- Enable real-time updates for matches, friend_requests, and messages tables
-- Add tables to the supabase_realtime publication to enable real-time functionality

-- Add matches table to real-time publication
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- Add friend_requests table to real-time publication  
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;

-- Add messages table to real-time publication
ALTER TABLE public.messages REPLICA IDENTITY FULL; 
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add user_availability table to real-time publication (for calendar updates)
ALTER TABLE public.user_availability REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_availability;