-- Create security definer function to check division membership without RLS recursion
CREATE OR REPLACE FUNCTION public.check_same_division(_user_id uuid, _division_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.division_assignments
    WHERE user_id = _user_id
      AND division_id = _division_id
      AND status = 'active'
  )
$$;

-- Fix the division_assignments policy to avoid recursion
DROP POLICY IF EXISTS "Division members can view each other's assignments" ON public.division_assignments;

CREATE POLICY "Division members can view each other's assignments"
ON public.division_assignments
FOR SELECT
USING (
  auth.uid() = user_id OR
  public.check_same_division(auth.uid(), division_id)
);