CREATE OR REPLACE FUNCTION public.can_access_client(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client
      AND c.organization_id = public.current_org_id()
      AND public.can_access_department(c.department_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_department(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.can_access_group_session(_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_sessions g
    WHERE g.id = _session
      AND g.organization_id = public.current_org_id()
      AND public.can_access_department(g.department_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_department(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_group_session(uuid) TO authenticated;

-- Appointments
DROP POLICY IF EXISTS "staff read appointments" ON public.appointments;
DROP POLICY IF EXISTS "staff write appointments" ON public.appointments;
CREATE POLICY "staff read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_client(client_id));
CREATE POLICY "staff write appointments" ON public.appointments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_client(client_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_client(client_id));

-- Referrals
DROP POLICY IF EXISTS "cr select" ON public.client_referrals;
DROP POLICY IF EXISTS "cr update" ON public.client_referrals;
CREATE POLICY "cr select" ON public.client_referrals FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_client(client_id));
CREATE POLICY "cr update" ON public.client_referrals FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_client(client_id));

-- Documents
DROP POLICY IF EXISTS "staff read documents" ON public.client_documents;
DROP POLICY IF EXISTS "staff review documents" ON public.client_documents;
CREATE POLICY "staff read documents" ON public.client_documents FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_client(client_id));
CREATE POLICY "staff review documents" ON public.client_documents FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_client(client_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_client(client_id));

-- Follow-up tasks: managers only see tasks for their department's clients or staff
DROP POLICY IF EXISTS "fut select" ON public.follow_up_tasks;
DROP POLICY IF EXISTS "fut update" ON public.follow_up_tasks;
CREATE POLICY "fut select" ON public.follow_up_tasks FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND (
    assigned_to = auth.uid() OR created_by = auth.uid() OR (
      public.is_org_manager(auth.uid()) AND (
        (client_id IS NOT NULL AND public.can_access_client(client_id))
        OR (client_id IS NULL AND public.can_access_department(public.user_department(assigned_to)))
      ))));
CREATE POLICY "fut update" ON public.follow_up_tasks FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND (
    assigned_to = auth.uid() OR created_by = auth.uid() OR (
      public.is_org_manager(auth.uid()) AND (
        (client_id IS NOT NULL AND public.can_access_client(client_id))
        OR (client_id IS NULL AND public.can_access_department(public.user_department(assigned_to)))
      ))));

-- Group sessions
DROP POLICY IF EXISTS "gs org select" ON public.group_sessions;
DROP POLICY IF EXISTS "gs org update" ON public.group_sessions;
CREATE POLICY "gs org select" ON public.group_sessions FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_department(department_id));
CREATE POLICY "gs org update" ON public.group_sessions FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_department(department_id));

DROP POLICY IF EXISTS "gsa org all" ON public.group_session_attendees;
CREATE POLICY "gsa org all" ON public.group_session_attendees FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_group_session(session_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_group_session(session_id));

-- Activity history
DROP POLICY IF EXISTS "managers read audit" ON public.audit_logs;
CREATE POLICY "managers read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid())
         AND public.can_access_department(department_id));

-- Staff profiles: managers only see staff in their own department
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (
    organization_id IS NOT NULL AND organization_id = public.current_org_id()
    AND public.is_org_manager(auth.uid()) AND public.can_access_department(department_id)));