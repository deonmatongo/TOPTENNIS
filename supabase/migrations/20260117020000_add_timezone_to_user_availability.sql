-- Add timezone column to user_availability table
ALTER TABLE public.user_availability 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Create index for timezone queries
CREATE INDEX IF NOT EXISTS idx_user_availability_timezone 
ON public.user_availability(timezone);

-- Update existing records to use Eastern Time as default
UPDATE public.user_availability 
SET timezone = 'America/New_York' 
WHERE timezone IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.user_availability.timezone IS 'IANA timezone identifier (e.g., America/New_York). Defaults to Eastern Time.';
