-- Supabase/PostgreSQL with migrations 001–004 applied. All test data is rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.metadata_book', (public.create_book_with_authors(
  '{"title":"Shared title","isbn":"9780140328721","authors":[{"name":"Shared author"}],"pages":200,"cover_url":"https://example.com/shared.jpg"}'
)->>'id'), true);
SELECT set_config('test.other_book', (public.create_book_with_authors('{"title":"Other user only"}')->>'id'), true);
INSERT INTO public.user_books(user_id, book_id, status) VALUES
  ('11111111-1111-4111-8111-111111111111', current_setting('test.metadata_book')::integer, 'reading'),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.metadata_book')::integer, 'read'),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.other_book')::integer, 'pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE invalid jsonb; changed integer; BEGIN
  IF NOT public.update_personal_book_metadata(current_setting('test.metadata_book')::integer,
    '{"title":"My title","authors":[{"name":"My author"}],"isbn":"9780140328721","cover_url":null}') THEN
    RAISE EXCEPTION 'Personal book not updated';
  END IF;
  PERFORM public.update_personal_book_metadata(current_setting('test.metadata_book')::integer,
    '{"pages":123,"publisher":null,"language":"es","publication_date":"2020-02-29"}');
  IF (SELECT metadata->>'title' FROM public.user_books) <> 'My title'
    OR (SELECT metadata->>'pages' FROM public.user_books) <> '123'
    OR (SELECT metadata->'cover_url' FROM public.user_books) <> 'null'::jsonb
    OR (SELECT status FROM public.user_books) <> 'reading' THEN
    RAISE EXCEPTION 'Partial update lost existing personal fields or changed status';
  END IF;
  IF public.update_personal_book_metadata(current_setting('test.other_book')::integer, '{"title":"Forged title"}')
    OR public.update_personal_book_metadata(current_setting('test.other_book')::integer, NULL) THEN
    RAISE EXCEPTION 'Modified a book outside the caller library';
  END IF;
  UPDATE public.user_books SET metadata = '{"title":"Forged direct edit"}'
    WHERE user_id = '22222222-2222-4222-8222-222222222222';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'RLS allowed a direct edit to another user'; END IF;
  FOREACH invalid IN ARRAY ARRAY[
    '[]'::jsonb, '{"id":99}', '{"user_id":"victim"}', '{"title":null}', '{"title":" "}',
    '{"authors":null}', '{"authors":[{"id":1,"name":"Forged"}]}', '{"authors":[{"name":" "}]}',
    '{"authors":[{}]}', '{"pages":-1}', '{"pages":1.5}', '{"pages":2147483648}', '{"pages":"200"}',
    '{"cover_url":"javascript:alert(1)"}', '{"publication_date":"2023-02-29"}'
  ] LOOP
    BEGIN
      PERFORM public.update_personal_book_metadata(current_setting('test.metadata_book')::integer, invalid);
      RAISE EXCEPTION 'Invalid metadata accepted: %', invalid;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
      UPDATE public.user_books SET metadata = invalid;
      RAISE EXCEPTION 'Direct invalid metadata accepted: %', invalid;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    UPDATE public.books SET title = 'Changed catalog' WHERE id = current_setting('test.metadata_book')::integer;
    RAISE EXCEPTION 'Catalog write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT title FROM public.books WHERE id = current_setting('test.metadata_book')::integer) <> 'Shared title'
    OR (SELECT name FROM public.authors WHERE name = 'Shared author') IS NULL
    OR EXISTS (SELECT 1 FROM public.authors WHERE name = 'My author')
    OR (SELECT metadata FROM public.user_books WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND book_id = current_setting('test.metadata_book')::integer) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Personal edit affected catalog or another reader';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ BEGIN
  PERFORM public.update_personal_book_metadata(current_setting('test.metadata_book')::integer, '{"authors":[]}');
  IF (SELECT metadata->'authors' FROM public.user_books) <> '[]'::jsonb THEN RAISE EXCEPTION 'Could not clear authors'; END IF;
  PERFORM public.update_personal_book_metadata(current_setting('test.metadata_book')::integer, NULL);
  IF (SELECT metadata FROM public.user_books) <> '{}'::jsonb
    OR (SELECT status FROM public.user_books) <> 'reading' THEN RAISE EXCEPTION 'Reset changed status or retained overrides'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.update_personal_book_metadata(current_setting('test.metadata_book')::integer, '{}');
    RAISE EXCEPTION 'Anonymous update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
