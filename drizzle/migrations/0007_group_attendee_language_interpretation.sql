ALTER TABLE public.group_session_attendees
  ADD COLUMN client_language text,
  ADD COLUMN interpretation_needed boolean;

COMMENT ON COLUMN public.group_session_attendees.client_language IS 'Language recorded for the client at this group session.';
COMMENT ON COLUMN public.group_session_attendees.interpretation_needed IS 'Whether the client needed interpretation at this group session.';