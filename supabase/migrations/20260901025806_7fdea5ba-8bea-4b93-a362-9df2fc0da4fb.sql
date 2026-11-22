
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('worker','manager','org_admin','system_admin');
CREATE TYPE public.note_status AS ENUM ('draft','generated','final','deleted');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  join_code text NOT NULL UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#1f4d5c',
  secondary_color text NOT NULL DEFAULT '#0f766e',
  timezone text NOT NULL DEFAULT 'UTC',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_departments_org ON public.departments(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  full_name text NOT NULL DEFAULT '',
  email text,
  job_title text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'manager') OR public.has_role(_user_id,'org_admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_department(_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _dept IS NULL
     OR _dept = public.current_department_id()
     OR public.is_org_manager(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ORG / DEPT / PROFILE POLICIES
CREATE POLICY "org members read org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "org admins update org" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));

CREATE POLICY "org members read departments" ON public.departments FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage departments" ON public.departments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));

CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (organization_id IS NOT NULL AND organization_id = public.current_org_id()));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "read roles in org" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (organization_id IS NOT NULL AND organization_id = public.current_org_id()));

-- CLIENTS
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  client_identifier text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  preferred_name text,
  contact_information jsonb NOT NULL DEFAULT '{}'::jsonb,
  intake_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_identifier)
);
CREATE INDEX idx_clients_org_name ON public.clients(organization_id, last_name, first_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read clients in scope" ON public.clients FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_department(department_id));
CREATE POLICY "create clients in org" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "update clients in scope" ON public.clients FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_department(department_id));
CREATE POLICY "admins delete clients" ON public.clients FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));

-- NOTE TEMPLATES
CREATE TABLE public.note_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_instructions text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_org ON public.note_templates(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_templates TO authenticated;
GRANT ALL ON public.note_templates TO service_role;
ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read templates in org" ON public.note_templates FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "admins manage templates" ON public.note_templates FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));

-- CASE NOTES
CREATE TABLE public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  interaction_type text NOT NULL DEFAULT 'Office Appointment',
  interaction_date date NOT NULL DEFAULT (now()::date),
  raw_input text NOT NULL DEFAULT '',
  transcription text,
  generated_note text,
  final_note text,
  status public.note_status NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_notes_org_author ON public.case_notes(organization_id, author_id, created_at DESC);
CREATE INDEX idx_notes_client ON public.case_notes(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_notes TO authenticated;
GRANT ALL ON public.case_notes TO service_role;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or managed notes" ON public.case_notes FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id()
         AND (author_id = auth.uid()
              OR (public.is_org_manager(auth.uid()) AND public.can_access_department(department_id))));
CREATE POLICY "create own notes" ON public.case_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND author_id = auth.uid());
CREATE POLICY "update own notes" ON public.case_notes FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (author_id = auth.uid() OR public.has_role(auth.uid(),'org_admin')));
CREATE POLICY "admins purge notes" ON public.case_notes FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (author_id = auth.uid() OR public.has_role(auth.uid(),'org_admin')));

-- VERSIONS
CREATE TABLE public.case_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_note_id uuid NOT NULL REFERENCES public.case_notes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_versions_note ON public.case_note_versions(case_note_id, version_number DESC);
GRANT SELECT, INSERT ON public.case_note_versions TO authenticated;
GRANT ALL ON public.case_note_versions TO service_role;
ALTER TABLE public.case_note_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read versions of visible notes" ON public.case_note_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.case_notes n WHERE n.id = case_note_id));
CREATE POLICY "insert versions for own notes" ON public.case_note_versions FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

-- DRAFTS
CREATE TABLE public.drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  case_note_id uuid REFERENCES public.case_notes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drafts_author ON public.drafts(author_id, last_saved_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drafts TO authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drafts" ON public.drafts FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND author_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND author_id = auth.uid());

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_time ON public.audit_logs(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()));
CREATE POLICY "members write audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

-- AI GENERATION LOGS
CREATE TABLE public.ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  case_note_id uuid REFERENCES public.case_notes(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text,
  operation text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_logs_org_time ON public.ai_generation_logs(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.ai_generation_logs TO authenticated;
GRANT ALL ON public.ai_generation_logs TO service_role;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read ai logs" ON public.ai_generation_logs FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_manager(auth.uid()));
CREATE POLICY "members write ai logs" ON public.ai_generation_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER t_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_dept_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_profile_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_client_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_template_updated BEFORE UPDATE ON public.note_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_notes_updated BEFORE UPDATE ON public.case_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
