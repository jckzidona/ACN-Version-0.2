
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_department_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_department(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_department_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_department(uuid) TO authenticated, service_role;
