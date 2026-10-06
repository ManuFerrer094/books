-- Run after migrations 001–004, before deploying photo covers.
BEGIN;
ALTER TABLE public.user_books ADD COLUMN IF NOT EXISTS cover_image_path text;
ALTER TABLE public.user_books DROP CONSTRAINT IF EXISTS user_books_cover_image_path;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_cover_image_path
  CHECK (cover_image_path IS NULL OR cover_image_path ~
    ('^' || user_id::text || '/' || book_id::text || '/[0-9a-f-]{36}[.]jpg$'));

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('book-covers', 'book-covers', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS cover_select_own ON storage.objects;
CREATE POLICY cover_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS cover_insert_own ON storage.objects;
CREATE POLICY cover_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.user_books b WHERE b.user_id = (SELECT auth.uid())
      AND b.book_id::text = (storage.foldername(name))[2])
    AND name ~ ('^' || (SELECT auth.uid())::text || '/[1-9][0-9]*/[0-9a-f-]{36}[.]jpg$'));
DROP POLICY IF EXISTS cover_delete_own ON storage.objects;
CREATE POLICY cover_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Restore all personal metadata and the cover together, preserving the spine/status.
CREATE OR REPLACE FUNCTION public.update_personal_book_metadata(
  requested_book_id integer, metadata_patch jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp AS $$
DECLARE changed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF metadata_patch IS NOT NULL AND NOT public.valid_personal_book_metadata(metadata_patch) THEN
    RAISE EXCEPTION 'Invalid personal book metadata' USING ERRCODE = '22023';
  END IF;
  UPDATE public.user_books
    SET metadata = CASE WHEN metadata_patch IS NULL THEN '{}'::jsonb ELSE metadata || metadata_patch END,
        cover_image_path = CASE WHEN metadata_patch IS NULL THEN NULL ELSE cover_image_path END,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = auth.uid() AND book_id = requested_book_id
    RETURNING true INTO changed;
  RETURN COALESCE(changed, false);
END $$;
REVOKE ALL ON FUNCTION public.update_personal_book_metadata(integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_personal_book_metadata(integer, jsonb) TO authenticated, service_role;
COMMIT;
