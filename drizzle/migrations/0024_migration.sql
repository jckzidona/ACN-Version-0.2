-- Only active staff resolve to an organization (former/pending staff lose org-scoped access)
CREATE OR REPLACE FUNCTION public.current_org_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active'; $$;

CREATE OR REPLACE FUNCTION public.current_department_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT department_id FROM public.profiles WHERE id = auth.uid() AND status = 'active'; $$;

-- Role helpers answer only about the caller (or trusted server code with no user session)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = _role
      AND (ur.organization_id IS NULL OR ur.organization_id = p.organization_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.has_role(_user_id,'manager') OR public.has_role(_user_id,'org_admin'); $$;

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.user_department(_uid uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT department_id FROM public.profiles WHERE id = _uid AND (auth.uid() IS NULL OR _uid = auth.uid()); $$;
REVOKE EXECUTE ON FUNCTION public.user_department(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_department(uuid) TO authenticated, service_role;

-- Staff cannot change their own status or organization; only an admin of the same org can change another's status
CREATE OR REPLACE FUNCTION public.guard_profile_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Organization cannot be changed here';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.id = auth.uid()
       OR NOT public.has_role(auth.uid(), 'org_admin')
       OR OLD.organization_id IS DISTINCT FROM public.current_org_id() THEN
      RAISE EXCEPTION 'Not allowed to change account status';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard_status ON public.profiles;
CREATE TRIGGER profiles_guard_status BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_status();

-- Clients editing their own record cannot move it to another organization or department
CREATE OR REPLACE FUNCTION public.guard_client_scope()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id AND OLD.auth_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Client organization cannot be changed';
  END IF;
  IF OLD.auth_user_id = auth.uid() AND NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'Client department cannot be changed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clients_guard_scope ON public.clients;
CREATE TRIGGER clients_guard_scope BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_scope();