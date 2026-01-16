-- Fix Security Definer View issue by recreating admin_profiles_view with security_invoker
-- This makes the view use the querying user's permissions instead of the view creator's

-- Drop the existing view
DROP VIEW IF EXISTS public.admin_profiles_view;

-- Recreate the view with security_invoker = true
CREATE VIEW public.admin_profiles_view
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.is_active,
  p.created_at as profile_created_at,
  p.profile_completed,
  COALESCE(
    ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL),
    ARRAY['user']::app_role[]
  ) as roles,
  p.email,
  p.membership_id,
  p.first_name,
  p.last_name
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
GROUP BY p.id, p.is_active, p.created_at, p.profile_completed, p.email, p.membership_id, p.first_name, p.last_name;

-- Grant access to authenticated users
GRANT SELECT ON public.admin_profiles_view TO authenticated;

-- The view will now use the RLS policies from the underlying profiles and user_roles tables
-- Only users who can access those tables according to their RLS policies will see data in this view