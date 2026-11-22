CREATE POLICY "organization managers upload branding images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-branding'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_manager(auth.uid())
);

CREATE POLICY "organization members view branding images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'organization-branding'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);

CREATE POLICY "organization managers update branding images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-branding'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_manager(auth.uid())
)
WITH CHECK (
  bucket_id = 'organization-branding'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_manager(auth.uid())
);

CREATE POLICY "organization managers delete branding images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-branding'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_manager(auth.uid())
);