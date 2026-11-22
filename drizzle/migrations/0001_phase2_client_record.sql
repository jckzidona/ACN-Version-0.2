ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS enrollment_date date,
  ADD COLUMN IF NOT EXISTS intake_date date,
  ADD COLUMN IF NOT EXISTS enrolled_program text,
  ADD COLUMN IF NOT EXISTS consent_to_share boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidentiality_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS parent_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS family_relationship text;

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS mime_type text;

CREATE POLICY "staff insert documents" ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND uploaded_by = auth.uid());
CREATE POLICY "managers delete documents" ON public.client_documents FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND (uploaded_by = auth.uid() OR public.is_org_manager(auth.uid())));

CREATE POLICY "staff upload client docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id::text = (storage.foldername(name))[1] AND c.organization_id = public.current_org_id()));
CREATE POLICY "staff delete client docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id::text = (storage.foldername(name))[1] AND c.organization_id = public.current_org_id()));

CREATE TABLE public.client_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_to text NOT NULL,
  reason text NOT NULL,
  referral_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'sent',
  follow_up_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_referrals_org_client_idx ON public.client_referrals(organization_id, client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_referrals TO authenticated;
GRANT ALL ON public.client_referrals TO service_role;
ALTER TABLE public.client_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr select" ON public.client_referrals FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "cr insert" ON public.client_referrals FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND created_by = auth.uid());
CREATE POLICY "cr update" ON public.client_referrals FOR UPDATE TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "cr delete" ON public.client_referrals FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_org_manager(auth.uid())));
CREATE TRIGGER t_cr_updated BEFORE UPDATE ON public.client_referrals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();