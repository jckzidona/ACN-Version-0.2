REVOKE EXECUTE ON FUNCTION public.current_department_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_department_id() TO authenticated, service_role;