CREATE TABLE public.counselling_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  department_id uuid REFERENCES public.departments(id),
  author_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id),
  interaction_date date NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX counselling_monthly_reports_scope_idx ON public.counselling_monthly_reports (organization_id, department_id, interaction_date);
GRANT SELECT, INSERT, UPDATE ON public.counselling_monthly_reports TO authenticated;
GRANT ALL ON public.counselling_monthly_reports TO service_role;
ALTER TABLE public.counselling_monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmr read own or manager" ON public.counselling_monthly_reports FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() AND public.can_access_department(department_id)
  AND (author_id = auth.uid() OR public.is_org_manager(auth.uid())));
CREATE POLICY "cmr insert own" ON public.counselling_monthly_reports FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND organization_id = public.current_org_id() AND public.can_access_department(department_id));
CREATE POLICY "cmr update own" ON public.counselling_monthly_reports FOR UPDATE TO authenticated
USING (author_id = auth.uid() AND organization_id = public.current_org_id())
WITH CHECK (author_id = auth.uid() AND organization_id = public.current_org_id());
CREATE TRIGGER t_counselling_monthly_reports_updated BEFORE UPDATE ON public.counselling_monthly_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
COMMENT ON TABLE public.counselling_reports IS 'DEPRECATED for new entries: report is now standalone in counselling_monthly_reports; old rows still listed';