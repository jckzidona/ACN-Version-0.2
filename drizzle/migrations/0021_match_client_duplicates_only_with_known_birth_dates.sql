CREATE OR REPLACE FUNCTION public.client_registration_identity_matches(first_a text, last_a text, dob_a date, first_b text, last_b text, dob_b date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT coalesce(dob_a IS NOT NULL AND dob_b IS NOT NULL AND dob_a = dob_b
   AND lower(btrim(first_a)) = lower(btrim(first_b))
   AND lower(btrim(last_a)) = lower(btrim(last_b)), false);
$$;
REVOKE ALL ON FUNCTION public.client_registration_identity_matches(text,text,date,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_registration_identity_matches(text,text,date,text,text,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_shared_client(_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid := public.current_org_id(); dept uuid := coalesce(nullif(_data->>'department_id','')::uuid,public.current_department_id()); existing uuid; new_id uuid; first text := btrim(_data->>'first_name'); last text := btrim(_data->>'last_name'); dob date := nullif(_data->>'date_of_birth','')::date;
BEGIN
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active' AND organization_id=org) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF first IS NULL OR last IS NULL OR length(first)=0 OR length(last)=0 THEN RAISE EXCEPTION 'First and last name are required'; END IF;
 IF dept IS NULL OR NOT EXISTS(SELECT 1 FROM public.departments WHERE id=dept AND organization_id=org) OR (NOT public.has_role(auth.uid(),'org_admin') AND dept IS DISTINCT FROM public.current_department_id()) THEN RAISE EXCEPTION 'Invalid department'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text || lower(first) || '|' || lower(last),0));
 SELECT id INTO existing FROM public.clients WHERE organization_id=org AND public.client_registration_identity_matches(first_name,last_name,date_of_birth,first,last,dob) ORDER BY created_at LIMIT 1;
 IF existing IS NOT NULL THEN RETURN jsonb_build_object('id',existing,'duplicate',true); END IF;
 INSERT INTO public.clients(organization_id,department_id,first_name,last_name,preferred_name,client_identifier,date_of_birth,phone,email,contact_information,intake_data,created_by)
 VALUES(org,dept,first,last,nullif(_data->>'preferred_name',''),coalesce(_data->>'client_identifier',''),dob,nullif(_data->>'phone',''),nullif(_data->>'email',''),coalesce(_data->'contact_information','{}'::jsonb),coalesce(_data->'intake_data','{}'::jsonb),auth.uid()) RETURNING id INTO new_id;
 RETURN jsonb_build_object('id',new_id,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.register_shared_client(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_shared_client(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_duplicate_client_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || lower(btrim(NEW.first_name)) || '|' || lower(btrim(NEW.last_name)),0));
 IF EXISTS(SELECT 1 FROM public.clients c WHERE c.organization_id=NEW.organization_id AND public.client_registration_identity_matches(c.first_name,c.last_name,c.date_of_birth,NEW.first_name,NEW.last_name,NEW.date_of_birth)) THEN RAISE EXCEPTION 'Client already exists. Open the existing client file instead of registering a duplicate.'; END IF;
 RETURN NEW;
END;
$$;