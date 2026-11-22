ALTER TABLE public.group_session_attendees
  ADD COLUMN IF NOT EXISTS bus_tokens integer CHECK (bus_tokens IS NULL OR bus_tokens BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS emergency_food boolean,
  ADD COLUMN IF NOT EXISTS meal_provided boolean,
  ADD COLUMN IF NOT EXISTS childminding_count integer CHECK (childminding_count IS NULL OR childminding_count BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS pr_info text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS child_client_ids uuid[] NOT NULL DEFAULT '{}';