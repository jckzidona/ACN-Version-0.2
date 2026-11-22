CREATE TABLE public.settlement_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  department_id uuid NOT NULL REFERENCES public.departments(id),
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  staff_name text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  narrative jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organization_id, author_id, period_from, period_to)
);
GRANT SELECT, INSERT, UPDATE ON public.settlement_monthly_reports TO authenticated;
GRANT ALL ON public.settlement_monthly_reports TO service_role;
ALTER TABLE public.settlement_monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY settlement_monthly_read ON public.settlement_monthly_reports FOR SELECT TO authenticated USING (
  organization_id = public.current_org_id() AND (
    public.has_role(auth.uid(), 'org_admin') OR
    (department_id = public.current_department_id() AND (author_id = auth.uid() OR public.has_role(auth.uid(), 'manager')))
  )
);
CREATE POLICY settlement_monthly_insert ON public.settlement_monthly_reports FOR INSERT TO authenticated WITH CHECK (
  organization_id = public.current_org_id() AND author_id = auth.uid() AND department_id = public.current_department_id()
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.organization_id = public.current_org_id() AND d.name ILIKE '%settlement%')
);
CREATE POLICY settlement_monthly_update ON public.settlement_monthly_reports FOR UPDATE TO authenticated USING (
  organization_id = public.current_org_id() AND author_id = auth.uid() AND department_id = public.current_department_id()
) WITH CHECK (
  organization_id = public.current_org_id() AND author_id = auth.uid() AND department_id = public.current_department_id()
  AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.organization_id = public.current_org_id() AND d.name ILIKE '%settlement%')
);
CREATE FUNCTION public.guard_settlement_monthly_report() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.period_from <> date_trunc('month', NEW.period_from)::date OR NEW.period_to <> (date_trunc('month', NEW.period_from) + interval '1 month - 1 day')::date THEN
    RAISE EXCEPTION 'Select one complete calendar month.';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.author_id <> OLD.author_id OR NEW.organization_id <> OLD.organization_id OR NEW.department_id <> OLD.department_id OR NEW.period_from <> OLD.period_from OR NEW.period_to <> OLD.period_to) THEN
    RAISE EXCEPTION 'The submission owner and period cannot be changed.';
  END IF;
  NEW.submitted_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER settlement_monthly_guard BEFORE INSERT OR UPDATE ON public.settlement_monthly_reports FOR EACH ROW EXECUTE FUNCTION public.guard_settlement_monthly_report();