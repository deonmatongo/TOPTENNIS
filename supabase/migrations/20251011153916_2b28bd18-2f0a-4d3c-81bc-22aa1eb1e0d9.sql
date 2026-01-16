-- Add foreign key relationship between user_availability and profiles
ALTER TABLE public.user_availability 
ADD CONSTRAINT user_availability_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;