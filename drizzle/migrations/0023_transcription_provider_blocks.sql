CREATE TABLE public.transcription_provider_blocks (model text PRIMARY KEY, status integer NOT NULL DEFAULT 403, message text NOT NULL, blocked_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.transcription_provider_blocks TO service_role;
REVOKE ALL ON public.transcription_provider_blocks FROM anon, authenticated;
ALTER TABLE public.transcription_provider_blocks ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.transcription_provider_blocks IS 'Server-only durable circuit breaker for terminal provider access denials. Clear only after provider access is restored; never stores recordings or transcripts.';