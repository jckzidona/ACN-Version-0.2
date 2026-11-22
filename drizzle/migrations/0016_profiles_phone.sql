ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.phone IS 'Mobile phone in international format (e.g. +12045550123), used to text sign-in verification codes.';