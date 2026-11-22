ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'case_notes',
  ADD COLUMN IF NOT EXISTS visible_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS default_roles text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE TABLE public.organization_funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  reporting_designation text,
  submits_funder_report boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_funders TO authenticated;
GRANT ALL ON public.organization_funders TO service_role;
ALTER TABLE public.organization_funders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read funders" ON public.organization_funders FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage funders" ON public.organization_funders FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin')) WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));
CREATE TRIGGER t_organization_funders_updated BEFORE UPDATE ON public.organization_funders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.program_funders (
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  funder_id uuid NOT NULL REFERENCES public.organization_funders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, funder_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_funders TO authenticated;
GRANT ALL ON public.program_funders TO service_role;
ALTER TABLE public.program_funders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read program funders" ON public.program_funders FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage program funders" ON public.program_funders FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin')) WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));

CREATE TABLE public.service_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  client_facing boolean NOT NULL DEFAULT true,
  applicable_to text NOT NULL DEFAULT 'both',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_activities TO authenticated;
GRANT ALL ON public.service_activities TO service_role;
ALTER TABLE public.service_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read activities" ON public.service_activities FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage activities" ON public.service_activities FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin')) WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));
CREATE TRIGGER t_service_activities_updated BEFORE UPDATE ON public.service_activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.activity_programs (
  activity_id uuid NOT NULL REFERENCES public.service_activities(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_programs TO authenticated;
GRANT ALL ON public.activity_programs TO service_role;
ALTER TABLE public.activity_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read activity programs" ON public.activity_programs FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage activity programs" ON public.activity_programs FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin')) WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));

CREATE TABLE public.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'external',
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  contact_information text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_partners TO authenticated;
GRANT ALL ON public.referral_partners TO service_role;
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read referral partners" ON public.referral_partners FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage referral partners" ON public.referral_partners FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin')) WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));
CREATE TRIGGER t_referral_partners_updated BEFORE UPDATE ON public.referral_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.immigration_status_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  system_defined boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.immigration_status_options TO authenticated;
GRANT ALL ON public.immigration_status_options TO service_role;
ALTER TABLE public.immigration_status_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read immigration statuses" ON public.immigration_status_options FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org admins manage immigration statuses" ON public.immigration_status_options FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin')) WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'org_admin'));
CREATE TRIGGER t_immigration_status_options_updated BEFORE UPDATE ON public.immigration_status_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();