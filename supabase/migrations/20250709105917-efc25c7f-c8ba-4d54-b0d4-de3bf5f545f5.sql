
-- Create a table to store league registrations
CREATE TABLE public.league_registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    league_id TEXT NOT NULL,
    league_name TEXT NOT NULL,
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT CHECK (status IN ('active', 'cancelled', 'completed')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on league_registrations
ALTER TABLE public.league_registrations ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to view their own registrations
CREATE POLICY "Users can view their own registrations" 
    ON public.league_registrations 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Create policy that allows users to insert their own registrations
CREATE POLICY "Users can create their own registrations" 
    ON public.league_registrations 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Create policy that allows users to update their own registrations
CREATE POLICY "Users can update their own registrations" 
    ON public.league_registrations 
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create unique constraint to prevent duplicate registrations
ALTER TABLE public.league_registrations 
ADD CONSTRAINT unique_user_league UNIQUE (user_id, league_id);
