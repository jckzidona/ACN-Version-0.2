ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS bus_tokens integer,
  ADD COLUMN IF NOT EXISTS emergency_food boolean,
  ADD COLUMN IF NOT EXISTS meal_provided boolean,
  ADD COLUMN IF NOT EXISTS childminding_count integer,
  ADD COLUMN IF NOT EXISTS child_client_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pr_info text,
  ADD COLUMN IF NOT EXISTS client_date_of_birth date,
  ADD COLUMN IF NOT EXISTS client_language text,
  ADD COLUMN IF NOT EXISTS interpretation_needed boolean,
  ADD COLUMN IF NOT EXISTS services_note text;