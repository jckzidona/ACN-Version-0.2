CREATE TABLE public.login_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.login_verification_codes TO service_role;

ALTER TABLE public.login_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX login_verification_codes_user_idx ON public.login_verification_codes (user_id, created_at DESC);

COMMENT ON TABLE public.login_verification_codes IS 'Short-lived sign-in verification codes. Server-only access via service role; no client policies by design.';