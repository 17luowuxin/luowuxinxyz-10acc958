-- Only the server-side register-with-invite function may create new accounts.
-- Client supplied user_metadata cannot set raw_app_meta_data, so this cannot be bypassed
-- by calling the public auth signup endpoint directly.
CREATE OR REPLACE FUNCTION public.enforce_invite_only_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.raw_app_meta_data ->> 'invite_registration', '') <> 'true' THEN
    RAISE EXCEPTION 'invite registration required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invite_only_signup_trigger ON auth.users;
CREATE TRIGGER enforce_invite_only_signup_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invite_only_signup();
