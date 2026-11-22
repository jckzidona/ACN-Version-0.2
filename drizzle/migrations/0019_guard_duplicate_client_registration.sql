CREATE OR REPLACE FUNCTION public.guard_duplicate_client_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || lower(btrim(NEW.first_name)) || '|' || lower(btrim(NEW.last_name)),0));
 IF EXISTS(SELECT 1 FROM public.clients c WHERE c.organization_id=NEW.organization_id AND lower(btrim(c.first_name))=lower(btrim(NEW.first_name)) AND lower(btrim(c.last_name))=lower(btrim(NEW.last_name)) AND (NEW.date_of_birth IS NULL OR c.date_of_birth IS NULL OR NEW.date_of_birth=c.date_of_birth)) THEN RAISE EXCEPTION 'Client already exists. Open the existing client file instead of registering a duplicate.'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER clients_guard_duplicate_registration BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_duplicate_client_registration();