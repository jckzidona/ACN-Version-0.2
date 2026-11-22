-- link client records to a login + newcomer profile fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS immigration_status text,
  ADD COLUMN IF NOT EXISTS arrival_date date,
  ADD COLUMN IF NOT EXISTS household jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS communication_preferences jsonb NOT NULL DEFAULT '{"email":true,"sms":false,"in_app":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS accessibility_needs text,
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_client_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "clients read own record" ON public.clients
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "clients update own record" ON public.clients
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- PROGRAMS
CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Settlement services',
  description text NOT NULL DEFAULT '',
  eligibility text,
  location text,
  schedule text,
  languages text[] NOT NULL DEFAULT ARRAY['English'],
  registration_required boolean NOT NULL DEFAULT true,
  capacity integer,
  contact_information text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read programs" ON public.programs FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "clients read active programs" ON public.programs FOR SELECT TO authenticated
  USING (active AND organization_id = public.current_client_org());
CREATE POLICY "staff manage programs" ON public.programs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()));
CREATE POLICY "staff update programs" ON public.programs FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()));
CREATE POLICY "admins delete programs" ON public.programs FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));
CREATE TRIGGER t_programs_updated BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROGRAM REGISTRATIONS
CREATE TABLE public.program_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','waitlisted','cancelled','completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_registrations TO authenticated;
GRANT ALL ON public.program_registrations TO service_role;
ALTER TABLE public.program_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read registrations" ON public.program_registrations FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "staff write registrations" ON public.program_registrations FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()))
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()));
CREATE POLICY "clients read own registrations" ON public.program_registrations FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients create own registrations" ON public.program_registrations FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND organization_id = public.current_client_org());
CREATE POLICY "clients update own registrations" ON public.program_registrations FOR UPDATE TO authenticated
  USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());
CREATE TRIGGER t_registrations_updated BEFORE UPDATE ON public.program_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  appointment_type text NOT NULL DEFAULT 'Settlement appointment',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  meeting_link text,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled','reschedule_requested','no_show')),
  client_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_worker_time ON public.appointments (worker_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "staff write appointments" ON public.appointments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "clients read own appointments" ON public.appointments FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients book own appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND organization_id = public.current_client_org());
CREATE POLICY "clients update own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());
CREATE TRIGGER t_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MESSAGES
CREATE TABLE public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('client','worker')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_messages TO authenticated;
GRANT ALL ON public.client_messages TO service_role;
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read messages" ON public.client_messages FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "staff send messages" ON public.client_messages FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND sender_type = 'worker' AND sender_user_id = auth.uid());
CREATE POLICY "clients read own messages" ON public.client_messages FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients send own messages" ON public.client_messages FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND sender_type = 'client' AND sender_user_id = auth.uid());
CREATE POLICY "clients mark read" ON public.client_messages FOR UPDATE TO authenticated
  USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());

-- DOCUMENTS
CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  document_type text NOT NULL DEFAULT 'Other',
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','more_info_required')),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read documents" ON public.client_documents FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "staff review documents" ON public.client_documents FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "clients read own documents" ON public.client_documents FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients upload own documents" ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND organization_id = public.current_client_org());
CREATE POLICY "clients delete own documents" ON public.client_documents FOR DELETE TO authenticated
  USING (client_id = public.current_client_id());
CREATE TRIGGER t_client_documents_updated BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REFERRAL REQUESTS
CREATE TABLE public.referral_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  category text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_progress','completed','closed')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_requests TO authenticated;
GRANT ALL ON public.referral_requests TO service_role;
ALTER TABLE public.referral_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read referrals" ON public.referral_requests FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "staff update referrals" ON public.referral_requests FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "clients read own referrals" ON public.referral_requests FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients create own referrals" ON public.referral_requests FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND organization_id = public.current_client_org());
CREATE TRIGGER t_referrals_updated BEFORE UPDATE ON public.referral_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FEEDBACK
CREATE TABLE public.service_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.service_feedback TO authenticated;
GRANT ALL ON public.service_feedback TO service_role;
ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read feedback" ON public.service_feedback FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()));
CREATE POLICY "clients read own feedback" ON public.service_feedback FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients create own feedback" ON public.service_feedback FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND organization_id = public.current_client_org());

-- NOTIFICATIONS
CREATE TABLE public.client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'general',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_notifications TO authenticated;
GRANT ALL ON public.client_notifications TO service_role;
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notifications" ON public.client_notifications FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "staff create notifications" ON public.client_notifications FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "clients read own notifications" ON public.client_notifications FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY "clients update own notifications" ON public.client_notifications FOR UPDATE TO authenticated
  USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());