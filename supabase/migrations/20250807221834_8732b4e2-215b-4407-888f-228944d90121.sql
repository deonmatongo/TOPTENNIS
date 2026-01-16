-- Add membership_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN membership_id TEXT UNIQUE;

-- Create a function to generate unique membership ID
CREATE OR REPLACE FUNCTION generate_membership_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate a membership ID in format: TL-YYYYMMDD-XXXX
    new_id := 'TL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Check if this ID already exists
    SELECT COUNT(*) INTO exists_check 
    FROM public.profiles 
    WHERE membership_id = new_id;
    
    -- If it doesn't exist, we can use it
    IF exists_check = 0 THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;