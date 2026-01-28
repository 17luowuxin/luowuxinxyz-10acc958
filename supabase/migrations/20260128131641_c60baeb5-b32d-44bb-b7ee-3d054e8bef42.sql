-- Fix critical security vulnerability: Remove the policy that allows users to grant themselves any role
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- Add a trigger to automatically assign 'user' role on signup (if not already exists)
CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_user_role();