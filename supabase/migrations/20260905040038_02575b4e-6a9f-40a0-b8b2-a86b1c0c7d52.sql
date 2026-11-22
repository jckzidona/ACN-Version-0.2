CREATE POLICY "clients manage own docs" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = public.current_client_id()::text)
  WITH CHECK (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = public.current_client_id()::text);

CREATE POLICY "staff read client docs" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND c.organization_id = public.current_org_id()
    )
  );