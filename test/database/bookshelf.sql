-- Run against a Supabase database with migrations 001–003 applied.
-- All fixtures and changes are rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.shared_book', (public.create_book_with_authors('{"title":"Bookshelf shared"}')->>'id'), true);
SELECT set_config('test.own_book', (public.create_book_with_authors('{"title":"Bookshelf A"}')->>'id'), true);
SELECT set_config('test.other_book', (public.create_book_with_authors('{"title":"Bookshelf B"}')->>'id'), true);
INSERT INTO public.user_books(user_id, book_id) VALUES
  ('11111111-1111-4111-8111-111111111111', current_setting('test.shared_book')::integer),
  ('11111111-1111-4111-8111-111111111111', current_setting('test.own_book')::integer),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.shared_book')::integer),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.other_book')::integer);
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.user_bookshelf', 'SELECT')
    OR has_function_privilege('anon', 'public.save_bookshelf_order(integer[],integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous bookshelf access was granted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'book-spines' AND public = false
    AND file_size_limit = 5242880 AND allowed_mime_types = ARRAY['image/jpeg']) THEN
    RAISE EXCEPTION 'Spine bucket is not private or lacks upload restrictions';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
DO $$ DECLARE ids integer[]; result jsonb; affected bigint; path text; BEGIN
  ids := ARRAY[current_setting('test.own_book')::integer, current_setting('test.shared_book')::integer];
  result := public.save_bookshelf_order(ids, 0);
  IF (result->>'revision')::integer <> 1 OR result->'book_ids' <> to_jsonb(ids) THEN
    RAISE EXCEPTION 'Order or revision was not saved';
  END IF;
  BEGIN
    PERFORM public.save_bookshelf_order(ids, 0);
    RAISE EXCEPTION 'Stale revision was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.save_bookshelf_order(ARRAY[ids[1],ids[1]], 1);
    RAISE EXCEPTION 'Duplicates were accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.save_bookshelf_order(ARRAY[ids[1]], 1);
    RAISE EXCEPTION 'An incomplete order was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.save_bookshelf_order(ARRAY[ids[1],current_setting('test.other_book')::integer], 1);
    RAISE EXCEPTION 'Another user book was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  IF (SELECT revision FROM public.user_bookshelf) <> 1 THEN
    RAISE EXCEPTION 'Failed writes changed the revision';
  END IF;
  BEGIN
    INSERT INTO public.user_bookshelf(user_id) VALUES ('22222222-2222-4222-8222-222222222222');
    RAISE EXCEPTION 'Forged bookshelf owner was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.user_books SET spine_color = '#123456', spine_width = 54, spine_height = 224 WHERE book_id = ids[2];
  BEGIN
    UPDATE public.user_books SET spine_width = 65 WHERE book_id = ids[2];
    RAISE EXCEPTION 'Invalid spine dimensions were accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.user_books SET spine_image_path = '22222222-2222-4222-8222-222222222222/' || ids[2] || '/33333333-3333-4333-8333-333333333333.jpg' WHERE book_id = ids[2];
    RAISE EXCEPTION 'Another user photo was associated';
  EXCEPTION WHEN check_violation THEN NULL; END;
  path := '11111111-1111-4111-8111-111111111111/' || ids[2] || '/33333333-3333-4333-8333-333333333333.jpg';
  INSERT INTO storage.objects(bucket_id, name, owner_id) VALUES ('book-spines', path, auth.uid()::text);
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('book-spines', '22222222-2222-4222-8222-222222222222/' || ids[2] || '/44444444-4444-4444-8444-444444444444.jpg');
    RAISE EXCEPTION 'Another user photo folder was writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('book-spines', '11111111-1111-4111-8111-111111111111/' || current_setting('test.other_book') || '/44444444-4444-4444-8444-444444444444.jpg');
    RAISE EXCEPTION 'Upload for a book outside the library was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.user_books SET spine_image_path = path WHERE book_id = ids[2];
  UPDATE public.user_books SET spine_color = '#ffffff' WHERE user_id = '22222222-2222-4222-8222-222222222222';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Appearance of another user was changed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
DO $$ DECLARE affected bigint; BEGIN
  IF EXISTS (SELECT 1 FROM public.user_bookshelf) OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'book-spines') THEN
    RAISE EXCEPTION 'Order or photo of another user was exposed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_books WHERE spine_color IS NOT NULL OR spine_image_path IS NOT NULL) THEN
    RAISE EXCEPTION 'Personal appearance modified another user copy';
  END IF;
  PERFORM public.save_bookshelf_order(ARRAY[current_setting('test.shared_book')::integer,current_setting('test.other_book')::integer], 0);
  UPDATE public.user_bookshelf SET revision = 100 WHERE user_id = '11111111-1111-4111-8111-111111111111';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another user order was changed'; END IF;
  DELETE FROM storage.objects WHERE bucket_id = 'book-spines';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Another user photo was deleted'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
DO $$ DECLARE affected bigint; BEGIN
  DELETE FROM public.user_books WHERE book_id = current_setting('test.shared_book')::integer;
  DELETE FROM storage.objects WHERE bucket_id = 'book-spines';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Cannot clean up a photo after removing its library entry'; END IF;
  PERFORM public.save_bookshelf_order(ARRAY[current_setting('test.own_book')::integer], 1);
END $$;
RESET ROLE;
ROLLBACK;
