-- Create divisions table
CREATE TABLE public.divisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id TEXT NOT NULL,
  division_name TEXT NOT NULL,
  season TEXT NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 7,
  current_players INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  skill_level_range TEXT NOT NULL,
  competitiveness TEXT NOT NULL,
  age_range TEXT NOT NULL,
  gender_preference TEXT NOT NULL
);

-- Create division_assignments table
CREATE TABLE public.division_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  division_id UUID REFERENCES public.divisions(id) ON DELETE CASCADE,
  league_registration_id UUID REFERENCES public.league_registrations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  matches_completed INTEGER NOT NULL DEFAULT 0,
  matches_required INTEGER NOT NULL DEFAULT 5,
  playoff_eligible BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, division_id)
);

-- Enable RLS
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.division_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for divisions
CREATE POLICY "Anyone can view divisions" 
ON public.divisions 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage divisions" 
ON public.divisions 
FOR ALL 
USING (true);

-- Create policies for division_assignments
CREATE POLICY "Users can view their division assignments" 
ON public.division_assignments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Division members can view each other's assignments" 
ON public.division_assignments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.division_assignments da2 
    WHERE da2.division_id = division_assignments.division_id 
    AND da2.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage division assignments" 
ON public.division_assignments 
FOR ALL 
USING (true);

-- Create function to assign player to division
CREATE OR REPLACE FUNCTION public.assign_player_to_division(
  p_user_id UUID,
  p_league_registration_id UUID,
  p_league_id TEXT,
  p_skill_level TEXT,
  p_competitiveness TEXT,
  p_age_range TEXT,
  p_gender_preference TEXT
) RETURNS UUID AS $$
DECLARE
  v_division_id UUID;
  v_division_name TEXT;
  v_season TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
BEGIN
  -- First try to find an existing compatible division with space
  SELECT id INTO v_division_id
  FROM public.divisions
  WHERE league_id = p_league_id
    AND season = v_season
    AND skill_level_range = p_skill_level
    AND competitiveness = p_competitiveness
    AND age_range = p_age_range
    AND gender_preference = p_gender_preference
    AND current_players < max_players
    AND status = 'active'
  ORDER BY current_players DESC
  LIMIT 1;

  -- If no compatible division found, create a new one
  IF v_division_id IS NULL THEN
    v_division_name := 'Division ' || (
      SELECT COALESCE(COUNT(*) + 1, 1)
      FROM public.divisions
      WHERE league_id = p_league_id AND season = v_season
    );

    INSERT INTO public.divisions (
      league_id,
      division_name,
      season,
      skill_level_range,
      competitiveness,
      age_range,
      gender_preference
    ) VALUES (
      p_league_id,
      v_division_name,
      v_season,
      p_skill_level,
      p_competitiveness,
      p_age_range,
      p_gender_preference
    ) RETURNING id INTO v_division_id;
  END IF;

  -- Assign player to division
  INSERT INTO public.division_assignments (
    user_id,
    division_id,
    league_registration_id
  ) VALUES (
    p_user_id,
    v_division_id,
    p_league_registration_id
  );

  -- Update division player count
  UPDATE public.divisions
  SET 
    current_players = current_players + 1,
    updated_at = NOW()
  WHERE id = v_division_id;

  RETURN v_division_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_divisions_updated_at
BEFORE UPDATE ON public.divisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check division calendar access
CREATE OR REPLACE FUNCTION public.can_view_division_calendar(
  p_target_user_id UUID,
  p_requesting_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if both users are in the same division
  RETURN EXISTS (
    SELECT 1 
    FROM public.division_assignments da1
    JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = p_target_user_id
      AND da2.user_id = p_requesting_user_id
      AND da1.status = 'active'
      AND da2.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;