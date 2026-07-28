
CREATE POLICY "tomelo_media_select_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tomelo-media');
CREATE POLICY "tomelo_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tomelo-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tomelo_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tomelo-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tomelo_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tomelo-media' AND auth.uid()::text = (storage.foldername(name))[1]);
