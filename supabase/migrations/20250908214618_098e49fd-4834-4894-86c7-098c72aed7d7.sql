-- Create unmatched_player_requests table for handling players who can't find suitable divisions
CREATE TABLE public.unmatched_player_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  league_id TEXT NOT NULL,
  original_preferences JSONB NOT NULL,
  accepts_outside_criteria BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unmatched_player_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for unmatched_player_requests
CREATE POLICY "Users can create their own unmatched requests" 
ON public.unmatched_player_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own unmatched requests" 
ON public.unmatched_player_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own unmatched requests" 
ON public.unmatched_player_requests 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage all unmatched requests" 
ON public.unmatched_player_requests 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_unmatched_requests_updated_at
BEFORE UPDATE ON public.unmatched_player_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();