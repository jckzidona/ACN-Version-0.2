CREATE OR REPLACE FUNCTION public.can_access_department(_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _dept IS NULL
      OR _dept = public.current_department_id()
      OR public.has_role(auth.uid(), 'org_admin');
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_department()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'org_admin')
     AND (NEW.department_id IS DISTINCT FROM OLD.department_id
          OR NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
    RAISE EXCEPTION 'Only an organization admin can change a department.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_department ON public.profiles;
CREATE TRIGGER profiles_guard_department BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_department();