-- Migrations 001–005 must be applied. Test data is rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.cover_book', (public.create_book_with_authors('{"title":"Shared cover","cover_url":"https://example.com/original.jpg"}')->>'id'), true);
SELECT set_config('test.foreign_book', (public.create_book_with_authors('{"title":"Foreign cover"}')->>'id'), true);
INSERT INTO public.user_books(user_id, book_id, status) VALUES
  ('11111111-1111-4111-8111-111111111111', current_setting('test.cover_book')::integer, 'reading'),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.cover_book')::integer, 'read'),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.foreign_book')::integer, 'pending');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'book-covers' AND public = false
    AND file_size_limit = 5242880 AND allowed_mime_types = ARRAY['image/jpeg']) THEN
    RAISE EXCEPTION 'Cover bucket lacks private access or upload restrictions';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE path text; affected integer; BEGIN
  path := auth.uid()::text || '/' || current_setting('test.cover_book') || '/33333333-3333-4333-8333-333333333333.jpg';
  INSERT INTO storage.objects(bucket_id, name, owner_id) VALUES ('book-covers', path, auth.uid()::text);
  UPDATE public.user_books SET cover_image_path = path, spine_color = '#123456' WHERE book_id = current_setting('test.cover_book')::integer;
  BEGIN
    UPDATE public.user_books SET cover_image_path = '22222222-2222-4222-8222-222222222222/' || current_setting('test.cover_book') || '/33333333-3333-4333-8333-333333333333.jpg';
    RAISE EXCEPTION 'Foreign cover path was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.user_books SET cover_image_path = auth.uid()::text || '/' || current_setting('test.foreign_book') || '/33333333-3333-4333-8333-333333333333.jpg';
    RAISE EXCEPTION 'Another book cover path was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('book-covers', '22222222-2222-4222-8222-222222222222/' || current_setting('test.cover_book') || '/44444444-4444-4444-8444-444444444444.jpg');
    RAISE EXCEPTION 'Foreign upload was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('book-covers', auth.uid()::text || '/' || current_setting('test.foreign_book') || '/44444444-4444-4444-8444-444444444444.jpg');
    RAISE EXCEPTION 'Upload outside library was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.user_books SET cover_image_path = NULL WHERE user_id = '22222222-2222-4222-8222-222222222222';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another library was modified'; END IF;
  PERFORM public.update_personal_book_metadata(current_setting('test.cover_book')::integer, '{"title":"My edition"}');
  IF (SELECT cover_image_path FROM public.user_books) <> path THEN RAISE EXCEPTION 'Metadata edit lost cover'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ DECLARE affected integer; BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'book-covers')
    OR EXISTS (SELECT 1 FROM public.user_books WHERE cover_image_path IS NOT NULL) THEN
    RAISE EXCEPTION 'Another reader can see private covers';
  END IF;
  DELETE FROM storage.objects WHERE bucket_id = 'book-covers';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Foreign cover deletion was accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE affected integer; BEGIN
  PERFORM public.update_personal_book_metadata(current_setting('test.cover_book')::integer, NULL);
  IF (SELECT cover_image_path FROM public.user_books) IS NOT NULL
    OR (SELECT metadata FROM public.user_books) <> '{}'::jsonb
    OR (SELECT status FROM public.user_books) <> 'reading'
    OR (SELECT spine_color FROM public.user_books) <> '#123456' THEN
    RAISE EXCEPTION 'Reset did not restore cover independently of status and spine';
  END IF;
  DELETE FROM public.user_books;
  DELETE FROM storage.objects WHERE bucket_id = 'book-covers';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner could not clean up after library removal'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT cover_url FROM public.books WHERE id = current_setting('test.cover_book')::integer) <> 'https://example.com/original.jpg'
    OR (SELECT title FROM public.books WHERE id = current_setting('test.cover_book')::integer) <> 'Shared cover' THEN
    RAISE EXCEPTION 'Shared cover or title was changed';
  END IF;
END $$;
ROLLBACK;
