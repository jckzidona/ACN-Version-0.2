CREATE TABLE public.group_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  title text NOT NULL,
  topic text,
  session_type text NOT NULL DEFAULT 'Workshop',
  session_date date NOT NULL,
  start_time text,
  duration_minutes integer,
  location text,
  delivery_mode text NOT NULL DEFAULT 'In person',
  language text,
  facilitator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  co_facilitators text,
  partner_organization text,
  status text NOT NULL DEFAULT 'scheduled',
  session_note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_sessions TO authenticated;
GRANT ALL ON public.group_sessions TO service_role;
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gs org select" ON public.group_sessions FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "gs org insert" ON public.group_sessions FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "gs org update" ON public.group_sessions FOR UPDATE TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "gs manager delete" ON public.group_sessions FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_org_manager(auth.uid())));
CREATE TRIGGER t_group_sessions_updated BEFORE UPDATE ON public.group_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_session_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  attendance text NOT NULL DEFAULT 'registered',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_session_attendees TO authenticated;
GRANT ALL ON public.group_session_attendees TO service_role;
ALTER TABLE public.group_session_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsa org all" ON public.group_session_attendees FOR ALL TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX ON public.group_session_attendees (client_id);
CREATE INDEX ON public.group_sessions (organization_id, session_date);