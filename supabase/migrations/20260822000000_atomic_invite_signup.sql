-- Validate and consume the invite code in the same transaction that creates the user.
-- Reading app_metadata in a BEFORE INSERT trigger is unreliable for admin-created users;
-- user_metadata is present when auth.users is inserted and is safe because the code is
-- checked against the server-side invite_codes table here.
CREATE OR REPLACE FUNCTION public.enforce_invite_only_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code TEXT;
  consumed_invite_id UUID;
BEGIN
  normalized_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'invite_code', '')));

  IF normalized_code = '' THEN
    RAISE EXCEPTION 'valid invite code required';
  END IF;

  UPDATE public.invite_codes
  SET
    is_used = true,
    used_by_email = NEW.email,
    used_at = NOW()
  WHERE UPPER(code) = normalized_code
    AND is_used = false
  RETURNING id INTO consumed_invite_id;

  IF consumed_invite_id IS NULL THEN
    RAISE EXCEPTION 'invite code invalid or already used';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invite_only_signup_trigger ON auth.users;
CREATE TRIGGER enforce_invite_only_signup_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invite_only_signup();
