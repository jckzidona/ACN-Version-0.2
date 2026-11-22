DROP POLICY IF EXISTS "org admins update org" ON public.organizations;

CREATE POLICY "organization managers update org"
ON public.organizations FOR UPDATE TO authenticated
USING (
  id = public.current_org_id()
  AND public.is_org_manager(auth.uid())
)
WITH CHECK (
  id = public.current_org_id()
  AND public.is_org_manager(auth.uid())
);