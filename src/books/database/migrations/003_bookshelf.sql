-- Apply after migrations 001 and 002, before deploying the bookshelf feature.
BEGIN;
ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS spine_color text,
  ADD COLUMN IF NOT EXISTS spine_width integer,
  ADD COLUMN IF NOT EXISTS spine_height integer,
  ADD COLUMN IF NOT EXISTS spine_image_path text;
ALTER TABLE public.user_books
  ADD CONSTRAINT user_books_spine_color CHECK (spine_color IS NULL OR spine_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT user_books_spine_width CHECK (spine_width BETWEEN 28 AND 64),
  ADD CONSTRAINT user_books_spine_height CHECK (spine_height BETWEEN 160 AND 240),
  ADD CONSTRAINT user_books_spine_image_path CHECK (spine_image_path IS NULL OR
    spine_image_path ~ ('^' || user_id::text || '/' || book_id::text || '/[0-9a-f-]{36}[.]jpg$'));

CREATE TABLE public.user_bookshelf (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  book_ids integer[] NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
ALTER TABLE public.user_bookshelf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_bookshelf FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.user_bookshelf TO authenticated;
GRANT ALL ON public.user_bookshelf TO service_role;
CREATE POLICY bookshelf_select_own ON public.user_bookshelf FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY bookshelf_insert_own ON public.user_bookshelf FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY bookshelf_update_own ON public.user_bookshelf FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE FUNCTION public.save_bookshelf_order(requested_book_ids integer[], expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_revision integer; library_ids integer[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF requested_book_ids IS NULL OR expected_revision IS NULL OR expected_revision < 0
    OR EXISTS (SELECT 1 FROM unnest(requested_book_ids) id WHERE id IS NULL OR id < 1)
    OR cardinality(requested_book_ids) <> (SELECT count(DISTINCT id) FROM unnest(requested_book_ids) id) THEN
    RAISE EXCEPTION 'Invalid book order' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_bookshelf(user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM public.user_bookshelf
    WHERE user_id = auth.uid() FOR UPDATE;
  IF current_revision <> expected_revision THEN
    RAISE EXCEPTION 'Bookshelf changed' USING ERRCODE = '40001';
  END IF;
  SELECT COALESCE(array_agg(book_id ORDER BY book_id), '{}'::integer[]) INTO library_ids
    FROM public.user_books WHERE user_id = auth.uid();
  IF (SELECT COALESCE(array_agg(id ORDER BY id), '{}'::integer[]) FROM unnest(requested_book_ids) id)
      IS DISTINCT FROM library_ids THEN
    RAISE EXCEPTION 'Library membership changed' USING ERRCODE = '40001';
  END IF;
  UPDATE public.user_bookshelf SET book_ids = requested_book_ids, revision = revision + 1
    WHERE user_id = auth.uid();
  RETURN jsonb_build_object('book_ids', requested_book_ids, 'revision', current_revision + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.save_bookshelf_order(integer[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_bookshelf_order(integer[], integer) TO authenticated;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('book-spines', 'book-spines', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE POLICY spine_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-spines' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY spine_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-spines'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.user_books b WHERE b.user_id = (SELECT auth.uid())
      AND b.book_id::text = (storage.foldername(name))[2])
    AND name ~ ('^' || (SELECT auth.uid())::text || '/[1-9][0-9]*/[0-9a-f-]{36}[.]jpg$'));
CREATE POLICY spine_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-spines' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
COMMIT;
