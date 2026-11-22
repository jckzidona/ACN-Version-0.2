ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS client_appearance text,
  ADD COLUMN IF NOT EXISTS appearance_note text,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer,
  ADD COLUMN IF NOT EXISTS note_format text NOT NULL DEFAULT 'standard';

CREATE TABLE public.follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_note_id uuid REFERENCES public.case_notes(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX follow_up_tasks_org_assignee_idx ON public.follow_up_tasks(organization_id, assigned_to, status, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_tasks TO authenticated;
GRANT ALL ON public.follow_up_tasks TO service_role;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fut select" ON public.follow_up_tasks FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid() OR public.is_org_manager(auth.uid())));
CREATE POLICY "fut insert" ON public.follow_up_tasks FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND created_by = auth.uid());
CREATE POLICY "fut update" ON public.follow_up_tasks FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND (assigned_to = auth.uid() OR created_by = auth.uid() OR public.is_org_manager(auth.uid())));
CREATE POLICY "fut delete" ON public.follow_up_tasks FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_org_manager(auth.uid())));
CREATE TRIGGER t_fut_updated BEFORE UPDATE ON public.follow_up_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();