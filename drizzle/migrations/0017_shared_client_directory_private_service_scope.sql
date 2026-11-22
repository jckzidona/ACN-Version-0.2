CREATE OR REPLACE FUNCTION public.shared_client_directory() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg((to_jsonb(c) - ARRAY['auth_user_id','contact_information','intake_data','accessibility_needs','consent_accepted_at']) || jsonb_build_object('contact_information','{}'::jsonb,'accessibility_needs',NULL,'intake_data',coalesce((SELECT jsonb_object_agg(k,v) FROM jsonb_each(c.intake_data) e(k,v) WHERE k = ANY(ARRAY['uci','gender','marital_status','country_of_birth','citizenship','city','province','postal_code','alt_phone','other_languages','clb_level','intended_destination','education','employment_status','occupation','enrollments'])), '{}'::jsonb),'household',c.household - 'notes')), '[]'::jsonb)
 FROM public.clients c WHERE c.organization_id = public.current_org_id() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.status='active');
$$;
REVOKE ALL ON FUNCTION public.shared_client_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_client_directory() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.shared_client_update(_id uuid, _patch jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.clients; allowed text[] := ARRAY['first_name','last_name','preferred_name','client_identifier','status','date_of_birth','arrival_date','preferred_language','phone','email','address','immigration_status','household','emergency_contact','communication_preferences','intake_data','enrollment_date','enrolled_program','parent_client_id','family_relationship']; k text; v jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active' AND organization_id=public.current_org_id()) THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO c FROM public.clients WHERE id=_id AND organization_id=public.current_org_id() FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;
 IF c.department_id = public.current_department_id() OR public.has_role(auth.uid(),'org_admin') THEN RAISE EXCEPTION 'Use the department client editor'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_patch) t(key) WHERE NOT(key=ANY(allowed))) THEN RAISE EXCEPTION 'Private client fields cannot be changed across departments'; END IF;
 IF _patch ? 'parent_client_id' AND _patch->>'parent_client_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=(_patch->>'parent_client_id')::uuid AND organization_id=c.organization_id AND id<>c.id) THEN RAISE EXCEPTION 'Invalid family link'; END IF;
 IF _patch ? 'intake_data' THEN
  FOR k,v IN SELECT * FROM jsonb_each(_patch->'intake_data') LOOP
   IF NOT(k=ANY(ARRAY['uci','gender','marital_status','country_of_birth','citizenship','city','province','postal_code','alt_phone','other_languages','clb_level','intended_destination','education','employment_status','occupation','enrollments'])) THEN RAISE EXCEPTION 'Private intake fields cannot be shared'; END IF;
  END LOOP;
  _patch := jsonb_set(_patch,'{intake_data}',c.intake_data || (_patch->'intake_data'));
 END IF;
 IF _patch ? 'household' THEN _patch := jsonb_set(_patch,'{household}',c.household || ((_patch->'household') - 'notes')); END IF;
 c := jsonb_populate_record(c,_patch);
 UPDATE public.clients SET first_name=c.first_name,last_name=c.last_name,preferred_name=c.preferred_name,client_identifier=c.client_identifier,status=c.status,date_of_birth=c.date_of_birth,arrival_date=c.arrival_date,preferred_language=c.preferred_language,phone=c.phone,email=c.email,address=c.address,immigration_status=c.immigration_status,household=c.household,emergency_contact=c.emergency_contact,communication_preferences=c.communication_preferences,intake_data=c.intake_data,enrollment_date=c.enrollment_date,enrolled_program=c.enrolled_program,parent_client_id=c.parent_client_id,family_relationship=c.family_relationship WHERE id=_id;
END;
$$;
REVOKE ALL ON FUNCTION public.shared_client_update(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_client_update(uuid,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_shared_client(_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid := public.current_org_id(); dept uuid := coalesce(nullif(_data->>'department_id','')::uuid,public.current_department_id()); existing uuid; new_id uuid; first text := btrim(_data->>'first_name'); last text := btrim(_data->>'last_name'); dob date := nullif(_data->>'date_of_birth','')::date;
BEGIN
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active' AND organization_id=org) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF first IS NULL OR last IS NULL OR length(first)=0 OR length(last)=0 THEN RAISE EXCEPTION 'First and last name are required'; END IF;
 IF dept IS NULL OR NOT EXISTS(SELECT 1 FROM public.departments WHERE id=dept AND organization_id=org) OR (NOT public.has_role(auth.uid(),'org_admin') AND dept IS DISTINCT FROM public.current_department_id()) THEN RAISE EXCEPTION 'Invalid department'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text || lower(first) || '|' || lower(last),0));
 SELECT id INTO existing FROM public.clients WHERE organization_id=org AND lower(btrim(first_name))=lower(first) AND lower(btrim(last_name))=lower(last) AND (dob IS NULL OR date_of_birth IS NULL OR date_of_birth=dob) ORDER BY created_at LIMIT 1;
 IF existing IS NOT NULL THEN RETURN jsonb_build_object('id',existing,'duplicate',true); END IF;
 INSERT INTO public.clients(organization_id,department_id,first_name,last_name,preferred_name,client_identifier,date_of_birth,phone,email,contact_information,intake_data,created_by)
 VALUES(org,dept,first,last,nullif(_data->>'preferred_name',''),coalesce(_data->>'client_identifier',''),dob,nullif(_data->>'phone',''),nullif(_data->>'email',''),coalesce(_data->'contact_information','{}'::jsonb),coalesce(_data->'intake_data','{}'::jsonb),auth.uid()) RETURNING id INTO new_id;
 RETURN jsonb_build_object('id',new_id,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.register_shared_client(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_shared_client(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_shared_client(_client uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.clients c JOIN public.profiles p ON p.id=auth.uid() AND p.organization_id=c.organization_id AND p.status='active' WHERE c.id=_client); $$;
REVOKE ALL ON FUNCTION public.can_access_shared_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_shared_client(uuid) TO authenticated,service_role;
ALTER POLICY "cr select" ON public.client_referrals USING (organization_id=public.current_org_id() AND public.can_access_shared_client(client_id));
ALTER POLICY "cr update" ON public.client_referrals USING (organization_id=public.current_org_id() AND public.can_access_shared_client(client_id)) WITH CHECK (organization_id=public.current_org_id() AND public.can_access_shared_client(client_id));
ALTER POLICY "staff read documents" ON public.client_documents USING (organization_id=public.current_org_id() AND public.can_access_shared_client(client_id));
ALTER POLICY "staff review documents" ON public.client_documents USING (organization_id=public.current_org_id() AND public.can_access_shared_client(client_id)) WITH CHECK (organization_id=public.current_org_id() AND public.can_access_shared_client(client_id));
ALTER POLICY "staff read client docs" ON storage.objects USING (bucket_id='client-documents' AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id::text=(storage.foldername(name))[1] AND public.can_access_shared_client(c.id)));
ALTER POLICY "staff upload client docs" ON storage.objects WITH CHECK (bucket_id='client-documents' AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id::text=(storage.foldername(name))[1] AND public.can_access_shared_client(c.id)));
ALTER POLICY "staff read appointments" ON public.appointments USING (organization_id=public.current_org_id() AND public.can_access_department(department_id));
ALTER POLICY "staff write appointments" ON public.appointments USING (organization_id=public.current_org_id() AND public.can_access_department(department_id)) WITH CHECK (organization_id=public.current_org_id() AND public.can_access_department(department_id) AND public.can_access_shared_client(client_id));
ALTER POLICY "read own or managed notes" ON public.case_notes USING (organization_id=public.current_org_id() AND public.can_access_department(department_id) AND (author_id=auth.uid() OR public.is_org_manager(auth.uid())));
ALTER POLICY "create own notes" ON public.case_notes WITH CHECK (organization_id=public.current_org_id() AND author_id=auth.uid() AND public.can_access_department(department_id) AND (client_id IS NULL OR public.can_access_shared_client(client_id)));
ALTER POLICY "update own notes" ON public.case_notes USING (organization_id=public.current_org_id() AND public.can_access_department(department_id) AND (author_id=auth.uid() OR public.has_role(auth.uid(),'org_admin'))) WITH CHECK (organization_id=public.current_org_id() AND public.can_access_department(department_id) AND (author_id=auth.uid() OR public.has_role(auth.uid(),'org_admin')));
ALTER POLICY "fut select" ON public.follow_up_tasks USING (organization_id=public.current_org_id() AND public.can_access_department(public.user_department(assigned_to)) AND (assigned_to=auth.uid() OR created_by=auth.uid() OR public.is_org_manager(auth.uid())));
ALTER POLICY "fut update" ON public.follow_up_tasks USING (organization_id=public.current_org_id() AND public.can_access_department(public.user_department(assigned_to)) AND (assigned_to=auth.uid() OR created_by=auth.uid() OR public.is_org_manager(auth.uid()))) WITH CHECK (organization_id=public.current_org_id() AND public.can_access_department(public.user_department(assigned_to)));