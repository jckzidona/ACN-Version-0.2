CREATE SEQUENCE IF NOT EXISTS public.client_file_number_seq START 10000;

CREATE OR REPLACE FUNCTION public.assign_client_file_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.client_identifier IS NULL OR btrim(NEW.client_identifier) = '' THEN
    NEW.client_identifier := 'ACN-' || nextval('public.client_file_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_assign_file_number
BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.assign_client_file_number();