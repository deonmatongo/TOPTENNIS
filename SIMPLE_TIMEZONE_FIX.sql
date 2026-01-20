-- ============================================
-- SIMPLE TIMEZONE FIX
-- Run this single query in Supabase SQL Editor
-- ============================================

-- This query checks if the profiles table exists first,
-- then adds the timezone column if the table exists

DO $$
BEGIN
    -- Check if profiles table exists
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    ) THEN
        -- Add the column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles' 
            AND column_name = 'preferred_timezone'
        ) THEN
            ALTER TABLE public.profiles 
            ADD COLUMN preferred_timezone TEXT DEFAULT 'America/New_York';
            
            -- Add comment
            COMMENT ON COLUMN public.profiles.preferred_timezone IS 
            'User''s preferred timezone for displaying times in the calendar (IANA timezone identifier)';
            
            -- Create index
            CREATE INDEX idx_profiles_preferred_timezone 
            ON public.profiles(preferred_timezone);
            
            RAISE NOTICE 'Successfully added preferred_timezone column to profiles table';
        ELSE
            RAISE NOTICE 'Column preferred_timezone already exists';
        END IF;
    ELSE
        RAISE NOTICE 'WARNING: profiles table does not exist yet. The timezone feature will work with localStorage only.';
    END IF;
END $$;
