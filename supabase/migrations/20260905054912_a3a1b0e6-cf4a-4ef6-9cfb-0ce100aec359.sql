DROP POLICY IF EXISTS "admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins delete roles" ON public.user_roles;

CREATE POLICY "managers insert roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND organization_id = current_org_id()
  AND user_id <> auth.uid()
  AND public.is_org_manager(auth.uid())
  AND (role <> 'org_admin' OR public.has_role(auth.uid(), 'org_admin'))
);

CREATE POLICY "managers update roles" ON public.user_roles FOR UPDATE TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = current_org_id()
  AND user_id <> auth.uid()
  AND public.is_org_manager(auth.uid())
  AND (role <> 'org_admin' OR public.has_role(auth.uid(), 'org_admin'))
)
WITH CHECK (
  organization_id = current_org_id()
  AND user_id <> auth.uid()
  AND public.is_org_manager(auth.uid())
  AND (role <> 'org_admin' OR public.has_role(auth.uid(), 'org_admin'))
);

CREATE POLICY "managers delete roles" ON public.user_roles FOR DELETE TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = current_org_id()
  AND user_id <> auth.uid()
  AND public.is_org_manager(auth.uid())
  AND (role <> 'org_admin' OR public.has_role(auth.uid(), 'org_admin'))
);