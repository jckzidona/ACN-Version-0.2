ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS outlook_event_id text,
  ADD COLUMN IF NOT EXISTS outlook_sync_error text,
  ADD COLUMN IF NOT EXISTS worker_note text;